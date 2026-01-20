-- ============================================================
-- FIX 1: Restrict creators table SELECT to owner only
-- The public_creator_profiles view already exists for public access
-- ============================================================

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public can view creator profiles" ON public.creators;

-- Create owner-only SELECT policy for creators table
CREATE POLICY "Creators can view own profile"
  ON public.creators FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- FIX 2: Restrict collab_requests SELECT access
-- Remove the "true" policy that exposes all data
-- The public_booked_dates view already exists for public access
-- ============================================================

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public can view booked dates only" ON public.collab_requests;

-- ============================================================
-- FIX 3: Allow requesters to access collaboration_messages
-- ============================================================

-- Allow requesters to view messages for their requests
CREATE POLICY "Requesters can view messages for their requests"
  ON public.collaboration_messages FOR SELECT
  USING (
    request_id IN (
      SELECT cr.id 
      FROM collab_requests cr
      WHERE cr.requester_user_id = auth.uid()
    )
  );

-- Allow requesters to insert messages for their requests  
CREATE POLICY "Requesters can insert messages for their requests"
  ON public.collaboration_messages FOR INSERT
  WITH CHECK (
    request_id IN (
      SELECT cr.id 
      FROM collab_requests cr
      WHERE cr.requester_user_id = auth.uid()
    )
  );