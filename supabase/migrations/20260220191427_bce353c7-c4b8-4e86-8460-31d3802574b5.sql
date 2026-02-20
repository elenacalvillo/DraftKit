
-- Fix: Remove the broad public SELECT policy on creators that exposes sensitive payment fields.
-- The public_creator_profiles view (with security_invoker=on) already correctly excludes
-- stripe_customer_id, stripe_subscription_id, trial_ends_at, subscription_tier, etc.
-- Authenticated creator access is covered by the existing "Creators can view own profile" policy.

DROP POLICY IF EXISTS "Public can view public creator profiles" ON public.creators;
