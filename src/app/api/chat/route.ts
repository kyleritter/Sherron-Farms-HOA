import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Verify this against whatever's current in Google AI Studio before
// deploying — Gemini model IDs get renamed/retired periodically, and
// free-tier rate limits (RPM/RPD) vary by model. gemini-2.0-flash was
// retired; gemini-3.6-flash is Google's current recommended replacement.
const GEMINI_MODEL = "gemini-3.6-flash";

export async function POST(req: NextRequest) {
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

  // 2. Embed user question
  // text-embedding-004 was retired; gemini-embedding-001 is current.
  // outputDimensionality pins it to 768 to match hoa_document_chunks'
  // VECTOR(768) column and match_hoa_chunks' signature -- keep this in
  // sync with src/lib/gemini.ts's EMBEDDING_MODEL/EMBEDDING_DIMENSIONS.
  const embedResponse = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: retrievalQuery,
    config: { outputDimensionality: 768 },
  });
  const queryEmbedding = embedResponse.embeddings![0].values;

  // 3. Retrieve relevant chunks from Supabase RPC
  const { data: chunks, error: rpcError } = await supabase.rpc(
    "match_hoa_chunks",
    {
      query_embedding: queryEmbedding,
      match_threshold: 0.45,
      match_count: 5,
    }
  );

  if (rpcError || !chunks || chunks.length === 0) {
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
You are the official Sherron Farms HOA Document Assistant. Your role is to provide accurate, strictly factual information based ONLY on the provided excerpts from our governing documents (CC&Rs, Bylaws, Guidelines, and Amendments).

BACKGROUND TO APPLY SILENTLY -- use this to judge which facts are current, but do not mention this section, its terminology, or its reasoning in your answer. Never use the words "Declarant" or "Declarant Control" in a response unless the resident's question itself uses that word first.
- This community is past its Period of Declarant Control. There is no current Declarant and no current Declarant Members.
- Any individuals named in the Articles of Incorporation as the initial/organizational Board of Directors are NOT today's Board. Never present them as current directors, and never explain that they aren't (just don't mention them) unless the resident is specifically asking about the community's founding/incorporation history.
- When asked about the CURRENT board size, composition, or members, answer only from the rules that govern the Board today (per the Bylaws). If the documents don't state a specific current count or roster, say so plainly and suggest contacting the Board -- without explaining why (no mention of Declarant Control, transitions, or incorporation history).
- Do not apply a provision that is explicitly scoped to apply only "during the Period of Declarant Control" when answering about current rules -- but don't tell the resident that's why it was excluded; just answer with what currently applies.

RULES:
1. Every statement must cite its exact source document, section, and page number using format: (Document Name, Section X, p. Y).
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

  const responseStream = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    // System instructions go in `config.systemInstruction`, NOT as a
    // {role: "system"} message inside `contents` — Gemini's contents
    // roles are "user" / "model" only.
    config: {
      systemInstruction,
    },
    contents: [...priorTurns, { role: "user", parts: [{ text: finalPrompt }] }],
  });

  // 6. Stream tokens back to the browser
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of responseStream) {
          // `chunk.text` is a property, not a method, in the
          // @google/genai JS SDK.
          const text = chunk.text;
          if (text) controller.enqueue(encoder.encode(text));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
