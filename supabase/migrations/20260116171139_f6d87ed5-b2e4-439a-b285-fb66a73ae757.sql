-- Fix the Security Definer View issue by setting invoker security
ALTER VIEW public.public_creator_profiles SET (security_invoker = on);