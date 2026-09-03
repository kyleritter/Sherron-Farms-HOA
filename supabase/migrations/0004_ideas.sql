-- Ideas board: residents submit ideas for the next HOA meeting; similar
-- submissions are grouped into a "topic" by embedding similarity, each
-- topic gets an AI-written summary (main point + variations), and
-- residents vote once per topic (anonymously -- who-voted-which-way is
-- never exposed, even to admins). Admins can mark a topic "addressed"
-- with what was decided.

CREATE TYPE idea_category AS ENUM ('amendment', 'arc', 'event', 'question', 'other');
CREATE TYPE idea_topic_status AS ENUM ('open', 'addressed');

CREATE TABLE public.idea_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  category idea_category NOT NULL,
  status idea_topic_status NOT NULL DEFAULT 'open',
  addressed_at TIMESTAMPTZ,
  addressed_by UUID REFERENCES public.profiles(id),
  decision_summary TEXT,
  addressed_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.idea_topics(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  author_display_name TEXT,      -- null when submitted anonymously
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  embedding VECTOR(768) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON public.ideas USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idea_topic_id_idx ON public.ideas (topic_id);

CREATE TABLE public.idea_votes (
  topic_id UUID NOT NULL REFERENCES public.idea_topics(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES public.profiles(id),
  vote_value SMALLINT NOT NULL CHECK (vote_value IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (topic_id, voter_id)
);

-- Aggregated, anonymous vote counts. SECURITY DEFINER so it reads
-- idea_votes directly without being subject to idea_votes' own
-- default-deny RLS below -- residents see totals, never who cast which
-- vote. (A plain view with security_invoker=false does the same thing
-- but trips Postgres's security-definer-view lint at ERROR; a function
-- is the pattern this project already uses for is_admin().)
CREATE OR REPLACE FUNCTION public.get_idea_vote_counts()
RETURNS TABLE (topic_id UUID, upvotes BIGINT, downvotes BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    topic_id,
    COUNT(*) FILTER (WHERE vote_value = 1) AS upvotes,
    COUNT(*) FILTER (WHERE vote_value = -1) AS downvotes
  FROM public.idea_votes
  GROUP BY topic_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_idea_vote_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_idea_vote_counts() TO authenticated;

-- Matches a new idea's embedding against existing OPEN ideas to find the
-- best topic to fold it into. Only ever called from the service-role
-- client in /api/ideas (never from the browser), so it's locked down to
-- that role.
CREATE OR REPLACE FUNCTION public.match_idea_topic(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.83
)
RETURNS TABLE (topic_id UUID, similarity FLOAT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT i.topic_id, 1 - (i.embedding <=> query_embedding) AS similarity
  FROM public.ideas i
  JOIN public.idea_topics t ON t.id = i.topic_id
  WHERE t.status = 'open'
    AND 1 - (i.embedding <=> query_embedding) > match_threshold
  ORDER BY i.embedding <=> query_embedding
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.match_idea_topic(VECTOR(768), FLOAT) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.idea_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idea_votes ENABLE ROW LEVEL SECURITY;

-- Shared community forum -- any approved resident can read all topics
-- and ideas (not just their own).
CREATE POLICY "Approved residents can read idea topics"
  ON public.idea_topics FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "Approved residents can read ideas"
  ON public.ideas FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'approved')
  );

-- A resident can see their OWN vote only (so the UI can show "you
-- upvoted this"), never anyone else's. Aggregate counts come from
-- idea_topic_vote_counts above, which doesn't expose voter identity.
CREATE POLICY "Residents can read their own vote"
  ON public.idea_votes FOR SELECT
  USING (auth.uid() = voter_id);

-- No INSERT/UPDATE/DELETE policies on any of these three tables: every
-- write (submitting an idea, voting, marking a topic addressed) goes
-- through a server route using the service-role client, which checks
-- eligibility in application code first (approved resident, one vote
-- per topic, admin-only for marking addressed).
