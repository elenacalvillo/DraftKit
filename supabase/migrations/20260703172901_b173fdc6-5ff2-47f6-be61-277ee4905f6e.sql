
-- 1. Add is_public flag to creators (default true to preserve existing behavior)
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- 2. Tighten creator_has_public_profile to require the flag as well as a username
CREATE OR REPLACE FUNCTION public.creator_has_public_profile(_creator_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.creators
    WHERE id = _creator_id
      AND username IS NOT NULL
      AND is_public = true
  );
$function$;

-- 3. Add SELECT policy for fulfilled_stripe_sessions so users can audit their own records
DROP POLICY IF EXISTS "Users can view own fulfilled sessions" ON public.fulfilled_stripe_sessions;
CREATE POLICY "Users can view own fulfilled sessions"
ON public.fulfilled_stripe_sessions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 4. Tighten workspace_presence UPDATE policy to re-check workspace access
DROP POLICY IF EXISTS "Users can update own presence" ON public.workspace_presence;
CREATE POLICY "Users can update own presence"
ON public.workspace_presence
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND public.has_workspace_access(auth.uid(), request_id)
)
WITH CHECK (
  user_id = auth.uid()
  AND public.has_workspace_access(auth.uid(), request_id)
);
