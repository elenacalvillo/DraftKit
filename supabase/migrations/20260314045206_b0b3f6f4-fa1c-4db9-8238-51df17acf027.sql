
-- 1. Create referral_credits table
CREATE TABLE public.referral_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_user_id, referred_user_id)
);

ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
ON public.referral_credits FOR SELECT TO authenticated
USING (referrer_user_id = auth.uid());

-- 2. Add referred_by column to creators
ALTER TABLE public.creators ADD COLUMN referred_by uuid REFERENCES auth.users(id);

-- 3. Create get_host_capacity function
CREATE OR REPLACE FUNCTION public.get_host_capacity(_creator_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'base_limit', 3,
    'referral_bonus', (
      SELECT count(*)::int FROM referral_credits
      WHERE referrer_user_id = (SELECT user_id FROM creators WHERE id = _creator_id)
    ),
    'used', (
      SELECT count(*)::int FROM collab_requests
      WHERE creator_id = _creator_id AND status IN ('approved', 'published')
    )
  )
$$;

-- 4. Trigger to award referral credit when a creator is inserted with referred_by
CREATE OR REPLACE FUNCTION public.award_referral_credit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.referred_by IS NOT NULL THEN
    INSERT INTO public.referral_credits (referrer_user_id, referred_user_id)
    VALUES (NEW.referred_by, NEW.user_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_referral_credit
  AFTER INSERT ON public.creators
  FOR EACH ROW
  EXECUTE FUNCTION public.award_referral_credit();
