import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Verify this against whatever's current in Google AI Studio before
// deploying -- Gemini model IDs get renamed/retired periodically.
// Using gemini-3.1-flash-lite instead of gemini-3.6-flash for a much
// higher free-tier daily request quota (1000/day vs 20/day).
export const GEMINI_MODEL = "gemini-3.1-flash-lite";

// text-embedding-004 was retired; gemini-embedding-001 is the current
// stable embedding model. It defaults to 3072 dimensions, so
// outputDimensionality pins it to 768 to match the hoa_document_chunks
// and ideas.embedding column types (and match_hoa_chunks/match_idea_topic's
// VECTOR(768) signatures) -- verify this is still current before
// re-ingesting anything, since Gemini model IDs get renamed/retired.
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

export async function embedText(text: string): Promise<number[]> {
  const res = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });
  return res.embeddings![0].values!;
}
