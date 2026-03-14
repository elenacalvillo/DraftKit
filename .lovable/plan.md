

# Sync New Creators to Resend Audience

## What We Are Building

When a new creator signs up and their contact row is inserted, automatically sync their info to Resend Audience `84fa3259-a54a-4c06-9493-e0bd9d720fd0`. Incorporates the three fixes from the review.

## Implementation

### 1. Edge Function: `supabase/functions/sync-to-resend/index.ts`

- Receives `{ email, full_name, substack_url }` from the DB trigger
- **First Name Fix**: Splits `full_name` at the first space, sends only the first part as `first_name` to Resend (e.g. "John Doe" becomes "John")
- **Substack URL**: Drops it from the Resend payload entirely. Resend Audiences do not support custom fields, so sending it is wasted code. The URL is already stored in the `creators` table for any personalization needs.
- **Unsubscribe Safety**: Omits the `unsubscribed` field in the POST body. Resend preserves existing unsubscribe status when this field is absent. New contacts default to subscribed.
- POSTs to `https://api.resend.com/audiences/84fa3259-a54a-4c06-9493-e0bd9d720fd0/contacts`
- Uses `RESEND_API_KEY` (already configured as a secret)
- Standard CORS headers for edge function compatibility

### 2. Config: `supabase/config.toml`

Add `[functions.sync-to-resend]` with `verify_jwt = false` (invoked by DB trigger, not browser).

### 3. Database Trigger (Migration)

```sql
CREATE OR REPLACE FUNCTION public.sync_creator_to_resend()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  supabase_url text := 'https://cbgchxesngdsvkevbqwh.supabase.co';
  service_key text;
  creator_row record;
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  SELECT name INTO creator_row
  FROM creators WHERE id = NEW.creator_id;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/sync-to-resend',
    body := jsonb_build_object(
      'email', NEW.email,
      'full_name', creator_row.name
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    )::jsonb
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_creator_to_resend
  AFTER INSERT ON public.creator_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_creator_to_resend();
```

Trigger fires on `creator_contacts` (not `creators`) because that is where the email lives.

### 4. Tagging Note

Resend Audiences API does not support tags on individual contacts. The dedicated audience ID itself serves as the "DraftKit User" segment. All contacts in audience `84fa3259...` are DraftKit users by definition.

### 5. Cold Start Note

The DB trigger uses `net.http_post` which is fire-and-forget. If the edge function is cold, there may be a 1-2 second delay before the contact appears in Resend. This is acceptable and does not block the user's signup flow.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/sync-to-resend/index.ts` | New edge function |
| `supabase/config.toml` | Add function entry |
| Migration SQL | Trigger + function on `creator_contacts` |

