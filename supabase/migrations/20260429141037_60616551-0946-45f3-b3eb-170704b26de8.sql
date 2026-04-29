-- Make collaboration_messages and related policies independent of `creators` table grants.
-- Use the existing SECURITY DEFINER helpers (is_request_owner) which bypass column-grant fragility.

-- collaboration_messages: creator-side policies
DROP POLICY IF EXISTS "Creators can insert messages for their requests" ON public.collaboration_messages;
DROP POLICY IF EXISTS "Creators can view messages for their requests" ON public.collaboration_messages;

CREATE POLICY "Creators can insert messages for their requests"
  ON public.collaboration_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_request_owner(auth.uid(), request_id));

CREATE POLICY "Creators can view messages for their requests"
  ON public.collaboration_messages
  FOR SELECT
  TO authenticated
  USING (public.is_request_owner(auth.uid(), request_id));

-- collab_metrics: creator-side SELECT also JOINs creators; harden it the same way.
DROP POLICY IF EXISTS "Creators can view own collab metrics" ON public.collab_metrics;

CREATE POLICY "Creators can view own collab metrics"
  ON public.collab_metrics
  FOR SELECT
  TO authenticated
  USING (public.is_request_owner(auth.uid(), request_id));