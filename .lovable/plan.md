

## Plan: Auto-link guest invites + display fix (revised)

Patches the 3 risks raised: trigger ordering, case-sensitivity, frontend reactivity.

### 1. Migration — case-insensitive trigger + backfill

**Update the function to use `lower()` directly (defense in depth):**
```sql
CREATE OR REPLACE FUNCTION public.link_requests_to_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.collab_requests
  SET requester_user_id = NEW.id
  WHERE lower(requester_email) = lower(NEW.email)
    AND requester_user_id IS NULL;

  UPDATE public.workspace_collaborators
  SET user_id = NEW.id
  WHERE lower(email) = lower(NEW.email)
    AND user_id IS NULL;
  RETURN NEW;
END;
$$;
```

**Create the missing trigger (schema dump confirms zero triggers exist):**
```sql
DROP TRIGGER IF EXISTS zz_link_invites_on_signup ON auth.users;
CREATE TRIGGER zz_link_invites_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_requests_to_new_user();
```
The `zz_` prefix guarantees alphabetical ordering runs **after** any `handle_new_user` profile-creation trigger, eliminating the race condition.

**One-time backfill (case-insensitive):**
```sql
UPDATE public.workspace_collaborators wc
SET user_id = u.id
FROM auth.users u
WHERE wc.user_id IS NULL AND lower(wc.email) = lower(u.email);

UPDATE public.collab_requests cr
SET requester_user_id = u.id
FROM auth.users u
WHERE cr.requester_user_id IS NULL AND lower(cr.requester_email) = lower(u.email);
```

### 2. Display fallback — `useWorkspaceCollaborators.ts`

Add a computed `display_name` to each collaborator:
1. `creators.name` (Google full name once linked)
2. Capitalized email local-part (`farida@gmail.com` → `Farida`) — covers the brief gap before profile creation, AND users who linked but never set a name
3. `Guest #N` only if email is somehow missing

### 3. Sidebar render — `SharedWorkspace.tsx` (and any other consumer)

Replace hard-coded "Guest" labels with `collaborator.display_name`.

### 4. Realtime reactivity — `useWorkspaceCollaborators.ts`

Add a Supabase Realtime subscription so the sidebar updates the moment the trigger fires (host has the workspace open while guest signs up):
```ts
supabase.channel(`collab-${requestId}`)
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'workspace_collaborators', filter: `request_id=eq.${requestId}` },
    () => refetch())
  .subscribe();
```
Plus enable realtime on the table:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_collaborators;
```

### Files

| File | Change |
|---|---|
| SQL migration | Update `link_requests_to_new_user` with `lower()`, add `zz_link_invites_on_signup` trigger, backfill orphans, enable realtime |
| `src/hooks/useWorkspaceCollaborators.ts` | Add `display_name` derivation + realtime subscription |
| `src/components/requests/SharedWorkspace.tsx` | Use `display_name` instead of "Guest" label |

### Out of scope
- Auto-creating `creators` row from Google metadata
- Username auto-generation

