-- Adds free-text comments on idea topics (factored into the AI summary)
-- and admin-only archiving of a topic, independent of its addressed
-- status per Kyle's request.

ALTER TABLE public.idea_topics ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.idea_topics ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE public.idea_topics ADD COLUMN archived_by UUID REFERENCES public.profiles(id);

CREATE TABLE public.idea_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.idea_topics(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  author_display_name TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idea_comments_topic_id_idx ON public.idea_comments (topic_id);

ALTER TABLE public.idea_comments ENABLE ROW LEVEL SECURITY;

-- Same shared-forum read pattern as idea_topics/ideas: any approved
-- resident can read all comments.
CREATE POLICY "Approved residents can read idea comments"
  ON public.idea_comments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'approved')
  );

-- No INSERT/UPDATE/DELETE policy: comments are written through
-- /api/ideas/topic/[topicId]/comment using the service-role client,
-- same pattern as ideas/votes/status changes.
