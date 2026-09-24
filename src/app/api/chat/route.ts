import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { embedQuery } from "@/lib/gemini";
import { logChat } from "@/lib/chat-log";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Verify this against whatever's current in Google AI Studio before
// deploying — Gemini model IDs get renamed/retired periodically, and
// free-tier rate limits (RPM/RPD) vary by model. Using
// gemini-3.5-flash-lite (upgraded from gemini-3.1-flash-lite, same
// free-tier quota): ~500 requests/day and 15/min vs 20/day for the
// 3.5–3.8 Flash models. Keep in sync with src/lib/gemini.ts.
const GEMINI_MODEL = "gemini-3.5-flash-lite";

// Minimum cosine similarity for a chunk to count as relevant. Calibrated
// for gemini-embedding-2 (3072 dims) on 16 typical resident questions plus
// off-topic controls (2026-09-24): relevant top-5 hits scored 0.65-0.82,
// off-topic questions topped out at 0.57. Re-check if the embedding model,
// dimensions, or text formats in src/lib/gemini.ts change.
const CHUNK_MATCH_THRESHOLD = 0.6;

const THINKING_LEVEL = ThinkingLevel.MEDIUM;

export async function POST(req: NextRequest) {
  // Request start, for the latency fields logged to chat_logs.
  const t0 = Date.now();
  const supabase = await createClient();

  // 1. Verify user authentication and approval
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();

  if (profile?.status !== "approved") {
    return NextResponse.json(
      { error: "Account approval required" },
      { status: 403 }
    );
  }

  type ChatMessage = { role: "user" | "assistant"; content: string };
  const { messages } = (await req.json()) as { messages: ChatMessage[] };
  const latestMessage = messages[messages.length - 1].content;

  // Short follow-ups ("is there a max?", "what about pets?") mean
  // nothing on their own to a similarity search -- fold in a bit of
  // recent conversation so retrieval targets the actual topic being
  // discussed, not just the literal follow-up text.
  const CONTEXT_TURNS = 4;
  const recentContext = messages
    .slice(-1 - CONTEXT_TURNS, -1)
    .map((m) => `${m.role === "user" ? "Resident" : "Assistant"}: ${m.content}`)
    .join("\n");
  const retrievalQuery = recentContext
    ? `${recentContext}\nResident: ${latestMessage}`
    : latestMessage;

  // Fields shared by every chat_logs row for this request.
  const logBase = {
    user_id: user.id,
    prompt: latestMessage,
    retrieval_query: retrievalQuery,
    turn_index: messages.filter((m) => m.role === "user").length,
    model: GEMINI_MODEL,
    thinking_level: THINKING_LEVEL,
    match_threshold: CHUNK_MATCH_THRESHOLD,
  };

  // 2. Embed user question (gemini-embedding-2; see src/lib/gemini.ts)
  const tRetrieval = Date.now();
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(retrievalQuery);
  } catch (e) {
    after(() =>
      logChat({ ...logBase, status: "error", error: `embed: ${String(e)}`, total_ms: Date.now() - t0 })
    );
    throw e;
  }

  // 3. Retrieve relevant chunks from Supabase RPC
  const { data: chunks, error: rpcError } = await supabase.rpc(
    "match_hoa_chunks_v2",
    {
      query_embedding: queryEmbedding,
      match_threshold: CHUNK_MATCH_THRESHOLD,
      match_count: 5,
    }
  );

  const retrievalMs = Date.now() - tRetrieval;
  const chunkSummary = (chunks ?? []).map(
    (c: {
      id: number;
      document_name: string;
      page_number: number;
      section_title: string;
      similarity: number;
    }) => ({
      id: c.id,
      document_name: c.document_name,
      page_number: c.page_number,
      section_title: c.section_title,
      similarity: Math.round(c.similarity * 1000) / 1000,
    })
  );

  if (rpcError || !chunks || chunks.length === 0) {
    after(() =>
      logChat({
        ...logBase,
        status: rpcError ? "error" : "no_chunks",
        error: rpcError ? `rpc: ${rpcError.message}` : null,
        retrieval_ms: retrievalMs,
        total_ms: Date.now() - t0,
        chunks: chunkSummary,
      })
    );
    return NextResponse.json({
      role: "assistant",
      content:
        "I could not find any governing documents related to your question. Please verify with the HOA Board.",
    });
  }

  // 4. Construct context with strict citation requirements
  const contextText = chunks
    .map(
      (c: {
        document_name: string;
        section_title: string;
        page_number: number;
        content: string;
      }) =>
        `[SOURCE: ${c.document_name} | Section: ${c.section_title} | Page: ${c.page_number}]\n${c.content}\n`
    )
    .join("\n---\n");

  const systemInstruction = `
You are Sherron Farms HOA Doc Reference Resource, an unofficial, resident-run reference assistant for Sherron Farms HOA documents. Your role is to provide accurate, strictly factual information based ONLY on the provided excerpts from the community's governing documents (CC&Rs, Bylaws, Guidelines, and Amendments) and recent Board meeting minutes. If asked whether you are official or affiliated with the HOA board or management company, clarify that this is an independent, unofficial resident reference tool.

BACKGROUND TO APPLY SILENTLY -- use this to judge which facts are current, but do not mention this section, its terminology, or its reasoning in your answer. Never use the words "Declarant" or "Declarant Control" in a response unless the resident's question itself uses that word first.
- This community is past its Period of Declarant Control. There is no current Declarant and no current Declarant Members.
- Any individuals named in the Articles of Incorporation as the initial/organizational Board of Directors are NOT today's Board. Never present them as current directors, and never explain that they aren't (just don't mention them) unless the resident is specifically asking about the community's founding/incorporation history.
- When asked about the CURRENT board size, composition, or members, answer only from the rules that govern the Board today (per the Bylaws). If the documents don't state a specific current count or roster, say so plainly and suggest contacting the Board -- without explaining why (no mention of Declarant Control, transitions, or incorporation history).
- Do not apply a provision that is explicitly scoped to apply only "during the Period of Declarant Control" when answering about current rules -- but don't tell the resident that's why it was excluded; just answer with what currently applies.

RULES:
1. Every statement must be followed immediately by a citation marker in EXACTLY this machine format, with no other text, spaces, or punctuation inside the brackets: [[cite:DOCUMENT_NAME:PAGE]]
   - DOCUMENT_NAME must be copied character-for-character (including the .pdf extension) from the "SOURCE:" line of the excerpt you are citing -- never paraphrase, shorten, or reformat it.
   - PAGE is the page number from that same excerpt's "SOURCE:" line, digits only.
   - Do not describe the section, use parentheses, or write "p." anywhere -- the app renders a readable citation from the marker automatically. Example: "Sheds must not exceed 120 square feet.[[cite:ARC Guidelines.pdf:14]]"
2. If earlier covenants conflict with later amendments, highlight that the AMENDMENT supersedes the earlier rule.
3. If the excerpts do not explicitly answer the question, state: "The provided HOA documents do not contain explicit rules regarding this topic. Please contact the Architectural Review Committee or HOA Board."
4. Never speculate, guess, or invent legal interpretations.
5. Do not add a closing disclaimer or note to your answer -- the app already shows one below the chat.
`;

  // 5. Call Gemini with streaming, passing prior turns as real
  // conversation history (not just the latest message) so follow-ups
  // like "is there a max?" resolve against what was just discussed.
  const priorTurns = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));
  const finalPrompt = `Context Excerpts:\n${contextText}\n\nResident Question: ${latestMessage}`;

  let responseStream: Awaited<ReturnType<typeof ai.models.generateContentStream>>;
  try {
    responseStream = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      // System instructions go in `config.systemInstruction`, NOT as a
      // {role: "system"} message inside `contents` — Gemini's contents
      // roles are "user" / "model" only.
      config: {
        systemInstruction,
        // gemini-3.5-flash-lite defaults to MINIMAL thinking. MEDIUM gives it
        // room to reconcile multiple excerpts (e.g. CC&Rs vs. ARC Guidelines
        // vs. later minutes) before answering, at the cost of some latency
        // and extra (thinking) output tokens. Options: MINIMAL/LOW/MEDIUM/HIGH.
        thinkingConfig: { thinkingLevel: THINKING_LEVEL },
      },
      contents: [...priorTurns, { role: "user", parts: [{ text: finalPrompt }] }],
    });
  } catch (e) {
    after(() =>
      logChat({
        ...logBase,
        status: "error",
        error: `generate: ${String(e)}`,
        retrieval_ms: retrievalMs,
        total_ms: Date.now() - t0,
        chunks: chunkSummary,
      })
    );
    throw e;
  }

  // 6. Stream tokens back to the browser
  // Collect the full answer, token usage and timing as it streams, then
  // write one chat_logs row via after() once the response has finished --
  // so logging adds no latency for the resident.
  const encoder = new TextEncoder();
  let responseText = "";
  let firstTokenMs: number | null = null;
  let usage: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  } | null = null;
  let streamError: string | null = null;
  let finishStream!: () => void;
  const streamDone = new Promise<void>((resolve) => (finishStream = resolve));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of responseStream) {
          // `chunk.text` is a property, not a method, in the
          // @google/genai JS SDK.
          const text = chunk.text;
          if (chunk.usageMetadata) usage = chunk.usageMetadata;
          if (text) {
            if (firstTokenMs === null) firstTokenMs = Date.now() - t0;
            responseText += text;
            controller.enqueue(encoder.encode(text));
          }
        }
      } catch (e) {
        streamError = `stream: ${String(e)}`;
        throw e;
      } finally {
        controller.close();
        finishStream();
      }
    },
  });

  after(async () => {
    await streamDone;
    const u = usage as typeof usage;
    await logChat({
      ...logBase,
      status: streamError ? "error" : "ok",
      error: streamError,
      response: responseText,
      prompt_tokens: u?.promptTokenCount ?? null,
      output_tokens: u?.candidatesTokenCount ?? null,
      thinking_tokens: u?.thoughtsTokenCount ?? null,
      total_tokens: u?.totalTokenCount ?? null,
      retrieval_ms: retrievalMs,
      time_to_first_token_ms: firstTokenMs,
      total_ms: Date.now() - t0,
      chunks: chunkSummary,
    });
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
