import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Verify this against whatever's current in Google AI Studio before
// deploying -- Gemini model IDs get renamed/retired periodically.
// Using gemini-3.5-flash-lite (upgraded from gemini-3.1-flash-lite,
// same free-tier quota) instead of a Flash model for a much higher
// free-tier daily request quota (~500/day vs 20/day). Keep in sync with
// GEMINI_MODEL in src/app/api/chat/route.ts.
export const GEMINI_MODEL = "gemini-3.5-flash-lite";

// Embeddings: gemini-embedding-2 at its full 3072 dimensions, stored as
// halfvec(3072) in hoa_document_chunks.embedding_v2 / ideas.embedding_v2
// (see supabase/migrations/0007_embedding_v2.sql). Vectors from
// gemini-embedding-001 (the old `embedding` columns) are NOT comparable.
//
// gemini-embedding-2 has no task_type parameter -- the task is written into
// the text itself, and documents vs. queries use different formats. These
// formats must stay in sync with scripts/backfill_embeddings_v2.py and
// scripts/ingest_from_unstructured.py, or retrieval quality silently drops.
export const EMBEDDING_MODEL = "gemini-embedding-2";
export const EMBEDDING_DIMENSIONS = 3072;

async function embed(text: string): Promise<number[]> {
  const res = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });
  return res.embeddings![0].values!;
}

// A resident's question (plus recent chat context), matched against
// document chunks via match_hoa_chunks_v2.
export function embedQuery(query: string): Promise<number[]> {
  return embed(`task: search result | query: ${query}`);
}

// A document chunk, as stored in hoa_document_chunks.
export function embedDocument(sectionTitle: string | null, content: string): Promise<number[]> {
  return embed(`title: ${sectionTitle || "none"} | text: ${content}`);
}

// An idea submission, compared symmetrically against other ideas via
// match_idea_topic_v2 to group duplicates into one topic.
export function embedIdea(title: string, body: string): Promise<number[]> {
  return embed(`task: sentence similarity | query: ${title}\n${body}`);
}
