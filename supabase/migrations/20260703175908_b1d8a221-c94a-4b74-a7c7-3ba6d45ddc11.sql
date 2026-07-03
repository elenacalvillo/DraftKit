CREATE OR REPLACE FUNCTION public.prevent_creator_billing_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / background jobs bypass (auth.uid() IS NULL).
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admins may override (e.g. VIP grants via admin UI).
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     OR NEW.credits IS DISTINCT FROM OLD.credits
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
  THEN
    RAISE EXCEPTION 'Billing and credit fields can only be modified by billing webhooks or admins';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_creator_billing_self_update_trg ON public.creators;
CREATE TRIGGER prevent_creator_billing_self_update_trg
BEFORE UPDATE ON public.creators
FOR EACH ROW EXECUTE FUNCTION public.prevent_creator_billing_self_update();