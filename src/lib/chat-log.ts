import { createAdminClient } from "@/lib/supabase/server";

// One row per chat request in public.chat_logs (server-only table; see
// supabase/migrations/0008_chat_logs.sql). Used for prompt testing:
// prompt, response, token usage, latency, and retrieved chunks.
export type ChatLogRow = {
  user_id: string | null;
  status: "ok" | "no_chunks" | "error";
  prompt: string;
  retrieval_query?: string | null;
  turn_index?: number | null;
  response?: string | null;
  model?: string | null;
  thinking_level?: string | null;
  prompt_tokens?: number | null;
  output_tokens?: number | null;
  thinking_tokens?: number | null;
  total_tokens?: number | null;
  retrieval_ms?: number | null;
  time_to_first_token_ms?: number | null;
  total_ms?: number | null;
  match_threshold?: number | null;
  chunks?: unknown;
  error?: string | null;
};

// Logging must never break or slow the chat: callers run this via
// `after()` (once the response has finished), and any failure here is
// swallowed after being written to the server log.
export async function logChat(row: ChatLogRow): Promise<void> {
  try {
    const { error } = await createAdminClient().from("chat_logs").insert(row);
    if (error) console.error("chat_logs insert failed:", error.message);
  } catch (e) {
    console.error("chat_logs insert threw:", e);
  }
}
