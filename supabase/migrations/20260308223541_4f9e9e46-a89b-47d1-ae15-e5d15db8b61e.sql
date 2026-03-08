
-- Table to store engagement metric snapshots for published collaborations
CREATE TABLE public.collab_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.collab_requests(id) ON DELETE CASCADE,
  snapshot_day integer NOT NULL DEFAULT 0, -- 0=publish, 1, 3, 7
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  creator_post_url text,
  creator_likes integer,
  creator_comments integer,
  requester_post_url text,
  requester_likes integer,
  requester_comments integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id, snapshot_day)
);

ALTER TABLE public.collab_metrics ENABLE ROW LEVEL SECURITY;

-- Creators can view metrics for their own requests
CREATE POLICY "Creators can view own collab metrics"
  ON public.collab_metrics FOR SELECT
  USING (request_id IN (
    SELECT cr.id FROM collab_requests cr
    JOIN creators c ON cr.creator_id = c.id
    WHERE c.user_id = auth.uid()
  ));

-- Requesters can view metrics for their own requests
CREATE POLICY "Requesters can view own collab metrics"
  ON public.collab_metrics FOR SELECT
  USING (request_id IN (
    SELECT cr.id FROM collab_requests cr
    WHERE cr.requester_user_id = auth.uid()
  ));

-- Only edge functions (service role) can insert/update metrics
-- No INSERT/UPDATE policies for regular users
