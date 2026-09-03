import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Verify this against whatever's current in Google AI Studio before
// deploying -- Gemini model IDs get renamed/retired periodically.
export const GEMINI_MODEL = "gemini-2.0-flash";

export async function embedText(text: string): Promise<number[]> {
  const res = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: text,
  });
  return res.embeddings![0].values!;
}
