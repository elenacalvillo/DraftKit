CREATE OR REPLACE FUNCTION public.guard_creator_system_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Direct client edits only; trusted server functions run as their owner.
  IF current_user = 'authenticated' AND (
       NEW.storage_used_bytes IS DISTINCT FROM OLD.storage_used_bytes
    OR NEW.nudge_count IS DISTINCT FROM OLD.nudge_count
    OR NEW.last_nudge_sent_at IS DISTINCT FROM OLD.last_nudge_sent_at
  ) THEN
    RAISE EXCEPTION 'Storage usage and reminder counters are managed by DraftKit';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_creator_system_fields_trg ON public.creators;
CREATE TRIGGER guard_creator_system_fields_trg
  BEFORE UPDATE ON public.creators
  FOR EACH ROW EXECUTE FUNCTION public.guard_creator_system_fields();