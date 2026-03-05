## Problem: No email sent when a guest books a collaboration

The `PublicBooking.tsx` page has email notifications **explicitly disabled** (lines 540-542):

```
// Email notifications temporarily disabled in this hotfix.
// Post-insert emails require the row ID, which we no longer retrieve
// to avoid SELECT RLS conflicts. Will be restored via a backend trigger.
```

The insert uses `.insert({...})` without `.select()` to avoid RLS conflicts (the "Account Blindness" pattern). This means the frontend never gets the new row's `id`, so it can't call `send-collab-email` with a `requestId`.

### Solution: Use a database trigger to send the email

Instead of trying to retrieve the row ID on the client, create a **Postgres trigger + edge function call** pattern:

1. **Create a database trigger** on `collab_requests` that fires `AFTER INSERT` when `status = 'pending'`
2. The trigger calls a `**pg_net` HTTP request** to the `send-collab-email` edge function with `type: 'request_received'` and the new row's `id`
3. This completely bypasses the client-side RLS issue since the trigger runs with table-owner privileges

### Changes

**1. Database migration** — Create a trigger function that uses `pg_net` to call the edge function:

```sql
-- Enable pg_net extension (already available in Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_new_collab_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire for new pending requests
  IF NEW.status = 'pending' THEN
    PERFORM extensions.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-collab-email',
      body := jsonb_build_object(
        'type', 'request_received',
        'requestId', NEW.id::text
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_collab_request
  AFTER INSERT ON public.collab_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_collab_request();
```

**However**, `pg_net` / `http_post` availability varies. A simpler and more reliable alternative:

### Alternative (recommended): Use Supabase Database Webhooks

Actually, the simplest reliable approach is to use `pg_net.http_post` which is available in Supabase:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_new_collab_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text := 'https://cbgchxesngdsvkevbqwh.supabase.co';
  service_key text;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    LIMIT 1;

    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-collab-email',
      body := jsonb_build_object(
        'type', 'request_received',
        'requestId', NEW.id::text
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      )::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_collab_request
  AFTER INSERT ON public.collab_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_collab_request();
```

**2. Update `send-collab-email/index.ts**` — The `request_received` type already exists and has a full email template (line 394+). The role is `"service"` which matches the service-role auth the trigger will use. No changes needed to the edge function.

**3. Remove the disabled comment** in `PublicBooking.tsx` (lines 540-542) — replace with a comment noting emails are handled by the database trigger.

### Files changed

- **Database migration**: New trigger `on_new_collab_request` + function `notify_new_collab_request()`
- `**src/pages/PublicBooking.tsx**`: Update comment (lines 540-542) — cosmetic only

### Why this is safe

- The trigger uses `SECURITY DEFINER` + service role key from vault, so it authenticates properly with the edge function
- The edge function already validates `request_received` as a `"service"` role type
- No RLS conflicts since the trigger runs server-side after the insert succeeds
- The `request_received` email template already exists and sends to the creator's contact email

&nbsp;

### A Small "Builder" Warning

When you set up the `pg_net` trigger, make sure your Supabase Project has the **Vault** enabled if you are pulling the `service_role_key` from it. Most modern Supabase projects have this by default, but it's worth a quick check in your dashboard.

Also, since you're using `pg_net`, the request is **asynchronous**. This is good because it won't slow down the user's booking experience, but it means if the Edge Function fails, the database won't "roll back" the insert. This is exactly what you want for a notification.

### The Impact

Now, when someone like Cristina or a new collaborator fills out your form, you'll get that "New Request" email instantly. No more manual checking of the dashboard to see if someone new signed up.