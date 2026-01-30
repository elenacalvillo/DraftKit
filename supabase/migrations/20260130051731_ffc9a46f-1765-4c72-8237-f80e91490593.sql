-- Add subscription tracking columns to creators table
ALTER TABLE public.creators ADD COLUMN subscription_tier TEXT DEFAULT 'free';
ALTER TABLE public.creators ADD COLUMN trial_ends_at TIMESTAMPTZ;
ALTER TABLE public.creators ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE public.creators ADD COLUMN stripe_subscription_id TEXT;

-- Create helper function to check pro access (combines user_roles and subscription)
CREATE OR REPLACE FUNCTION public.is_pro_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = _user_id AND role = 'pro'
  )
  OR EXISTS (
    SELECT 1 FROM creators 
    WHERE user_id = _user_id 
    AND subscription_tier = 'pro'
    AND (trial_ends_at IS NULL OR trial_ends_at > NOW())
  )
$$;

-- Create founding member trial trigger (auto-enroll new signups during launch period)
CREATE OR REPLACE FUNCTION public.set_founder_trial()
RETURNS TRIGGER AS $$
BEGIN
  -- Only during founding period (until March 1, 2026)
  IF NOW() < '2026-03-01'::TIMESTAMPTZ THEN
    NEW.subscription_tier := 'pro';
    NEW.trial_ends_at := NOW() + INTERVAL '30 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER creator_founder_trial
BEFORE INSERT ON public.creators
FOR EACH ROW EXECUTE FUNCTION public.set_founder_trial();