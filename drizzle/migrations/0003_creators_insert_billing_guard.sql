CREATE OR REPLACE FUNCTION public.reset_creator_billing_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  NEW.subscription_tier := 'free';
  NEW.trial_ends_at := NULL;
  NEW.credits := 3;
  NEW.stripe_customer_id := NULL;
  NEW.stripe_subscription_id := NULL;
  NEW.storage_used_bytes := 0;
  NEW.nudge_count := 0;
  NEW.last_nudge_sent_at := NULL;
  IF NEW.referred_by = NEW.user_id THEN
    NEW.referred_by := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS reset_creator_billing_on_insert_trg ON public.creators;
CREATE TRIGGER reset_creator_billing_on_insert_trg
  BEFORE INSERT ON public.creators
  FOR EACH ROW EXECUTE FUNCTION public.reset_creator_billing_on_insert();

CREATE OR REPLACE FUNCTION public.award_referral_credit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.referred_by IS NOT NULL AND NEW.referred_by <> NEW.user_id THEN
    INSERT INTO public.referral_credits (referrer_user_id, referred_user_id)
    VALUES (NEW.referred_by, NEW.user_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;