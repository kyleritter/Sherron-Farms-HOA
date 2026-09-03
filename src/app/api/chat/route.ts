import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Verify this against whatever's current in Google AI Studio before
// deploying — Gemini model IDs get renamed/retired periodically, and
// free-tier rate limits (RPM/RPD) vary by model.
const GEMINI_MODEL = "gemini-2.0-flash";

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

  const { messages } = await req.json();
  const latestMessage = messages[messages.length - 1].content;

  // 2. Embed user question
  // text-embedding-004 was retired; gemini-embedding-001 is current.
  // outputDimensionality pins it to 768 to match hoa_document_chunks'
  // VECTOR(768) column and match_hoa_chunks' signature -- keep this in
  // sync with src/lib/gemini.ts's EMBEDDING_MODEL/EMBEDDING_DIMENSIONS.
  const embedResponse = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: latestMessage,
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

RULES:
1. Every statement must cite its exact source document, section, and page number using format: (Document Name, Section X, p. Y).
2. If earlier covenants conflict with later amendments, highlight that the AMENDMENT supersedes the earlier rule.
3. If the excerpts do not explicitly answer the question, state: "The provided HOA documents do not contain explicit rules regarding this topic. Please contact the Architectural Review Committee or HOA Board."
4. Never speculate, guess, or invent legal interpretations.
5. Always include this brief closing notice at the end:
   "*Note: This response is for informational convenience. Refer to the signed documents or contact the board for formal interpretations.*"
`;

  // 5. Call Gemini with streaming.
  const prompt = `Context Excerpts:\n${contextText}\n\nResident Question: ${latestMessage}`;

  const responseStream = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    // System instructions go in `config.systemInstruction`, NOT as a
    // {role: "system"} message inside `contents` — Gemini's contents
    // roles are "user" / "model" only.
    config: {
      systemInstruction,
    },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
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
