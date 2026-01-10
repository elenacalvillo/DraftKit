-- Fix: Remove overly permissive "Service can manage writing samples" policy
-- Edge functions use service role which bypasses RLS anyway
DROP POLICY IF EXISTS "Service can manage writing samples" ON public.creator_writing_samples;

-- Fix: Remove duplicate insert policy that's too permissive
DROP POLICY IF EXISTS "Anyone can insert messages with valid request" ON public.collaboration_messages;