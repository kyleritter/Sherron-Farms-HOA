-- Per-question chat telemetry for prompt testing: what was asked, what
-- came back, token usage, latency, and which chunks retrieval matched.
--
-- Contains residents' questions, so it is server-only: RLS is enabled with
-- NO policies (anon/authenticated can't read or write), and only the
-- service role (used by /api/chat via createAdminClient) inserts rows.
-- Consider purging old rows or turning logging off after testing.

CREATE TABLE IF NOT EXISTS public.chat_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  status TEXT NOT NULL,                 -- 'ok' | 'no_chunks' | 'error'
  prompt TEXT NOT NULL,                 -- the resident's latest message
  retrieval_query TEXT,                 -- prompt + recent turns, as embedded
  turn_index INTEGER,                   -- 1 = first question in the conversation
  response TEXT,                        -- full streamed answer text
  model TEXT,
  thinking_level TEXT,
  prompt_tokens INTEGER,                -- usageMetadata.promptTokenCount
  output_tokens INTEGER,                -- usageMetadata.candidatesTokenCount
  thinking_tokens INTEGER,              -- usageMetadata.thoughtsTokenCount
  total_tokens INTEGER,                 -- usageMetadata.totalTokenCount
  retrieval_ms INTEGER,                 -- embed question + vector search
  time_to_first_token_ms INTEGER,       -- request received -> first answer text
  total_ms INTEGER,                     -- request received -> last answer text
  match_threshold DOUBLE PRECISION,
  chunks JSONB,                         -- [{id, document_name, page_number, section_title, similarity}]
  error TEXT
);

CREATE INDEX IF NOT EXISTS chat_logs_created_at_idx ON public.chat_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_logs_user_id_idx ON public.chat_logs (user_id);

ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_logs FROM anon, authenticated;
