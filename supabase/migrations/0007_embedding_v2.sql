-- Migration to gemini-embedding-2 at 3072 dimensions.
--
-- gemini-embedding-2 vectors are not comparable with gemini-embedding-001
-- vectors, so the new vectors live in a parallel `embedding_v2` column and
-- the old `embedding` column is kept (now nullable) as a rollback path
-- until it's dropped in a later cleanup migration.
--
-- pgvector's HNSW index supports at most 2,000 dimensions for `vector`,
-- so 3072-dim vectors are stored as `halfvec` (half precision, indexable up
-- to 4,000 dims) with negligible accuracy loss.

ALTER TABLE public.hoa_document_chunks
  ADD COLUMN IF NOT EXISTS embedding_v2 extensions.halfvec(3072),
  ALTER COLUMN embedding DROP NOT NULL;

ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS embedding_v2 extensions.halfvec(3072),
  ALTER COLUMN embedding DROP NOT NULL;

CREATE INDEX IF NOT EXISTS hoa_document_chunks_embedding_v2_idx
  ON public.hoa_document_chunks
  USING hnsw (embedding_v2 extensions.halfvec_cosine_ops);

CREATE INDEX IF NOT EXISTS ideas_embedding_v2_idx
  ON public.ideas
  USING hnsw (embedding_v2 extensions.halfvec_cosine_ops);

-- Same contract as match_hoa_chunks, over embedding_v2.
CREATE OR REPLACE FUNCTION public.match_hoa_chunks_v2(
  query_embedding extensions.halfvec(3072),
  match_threshold DOUBLE PRECISION DEFAULT 0.5,
  match_count INTEGER DEFAULT 5
)
RETURNS TABLE(
  id BIGINT,
  document_name TEXT,
  document_type TEXT,
  effective_date DATE,
  section_title TEXT,
  page_number INTEGER,
  content TEXT,
  similarity DOUBLE PRECISION
)
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_name,
    c.document_type,
    c.effective_date,
    c.section_title,
    c.page_number,
    c.content,
    1 - (c.embedding_v2 <=> query_embedding) AS similarity
  FROM public.hoa_document_chunks c
  WHERE c.embedding_v2 IS NOT NULL
    AND 1 - (c.embedding_v2 <=> query_embedding) > match_threshold
  ORDER BY c.embedding_v2 <=> query_embedding
  LIMIT match_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.match_hoa_chunks_v2(extensions.halfvec, DOUBLE PRECISION, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_hoa_chunks_v2(extensions.halfvec, DOUBLE PRECISION, INTEGER) TO authenticated, service_role;

-- Same contract as match_idea_topic, over embedding_v2. Server-only.
CREATE OR REPLACE FUNCTION public.match_idea_topic_v2(
  query_embedding extensions.halfvec(3072),
  match_threshold DOUBLE PRECISION DEFAULT 0.83
)
RETURNS TABLE(topic_id UUID, similarity DOUBLE PRECISION)
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
  SELECT i.topic_id, 1 - (i.embedding_v2 <=> query_embedding) AS similarity
  FROM public.ideas i
  JOIN public.idea_topics t ON t.id = i.topic_id
  WHERE t.status = 'open'
    AND i.embedding_v2 IS NOT NULL
    AND 1 - (i.embedding_v2 <=> query_embedding) > match_threshold
  ORDER BY i.embedding_v2 <=> query_embedding
  LIMIT 1;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.match_idea_topic_v2(extensions.halfvec, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_idea_topic_v2(extensions.halfvec, DOUBLE PRECISION) TO service_role;
