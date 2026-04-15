

# Harden Solo Workspace for Production

You've identified exactly the right failure points. Here's the concrete fix for each:

## 1. Database Trigger — Skip Email for Solo Drafts

The `notify_new_collab_request` trigger fires on every INSERT and calls `send-collab-email` when `status = 'pending'`. Solo workspaces insert with `status = 'approved'`, so **this trigger already skips them** — the `IF NEW.status = 'pending'` guard handles it. No change needed here.

## 2. Database Trigger — Skip URL Validation for Solo Drafts

The `validate_requester_substack_url` trigger rejects any URL containing `substack.com/@`. This is the **confirmed production blocker** (the P0001 error).

**Migration**: Replace the trigger function to bail out early when `is_solo = true`:

```sql
CREATE OR REPLACE FUNCTION public.validate_requester_substack_url()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_solo IS TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.requester_substack_url LIKE '%substack.com/@%' THEN
    RAISE EXCEPTION '...';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
```

## 3. RLS INSERT Policy — Allow Solo Self-Inserts

The current "Anyone can create requests" policy enforces `status = 'pending'`. Solo workspaces insert with `status = 'approved'`, which **violates this policy**. There's also a "Universal Insert Policy" with `WITH CHECK (true)` — this is an overly permissive fallback that should be tightened, but it currently allows the insert to pass. 

However, for correctness and security, the right fix is to **add a dedicated solo INSERT policy** and **drop the universal one**:

```sql
CREATE POLICY "Creators can create solo workspaces"
ON public.collab_requests FOR INSERT TO authenticated
WITH CHECK (
  is_solo = true
  AND status = 'approved'
  AND auth.uid() = requester_user_id
  AND creator_id IN (SELECT id FROM creators WHERE user_id = auth.uid())
);
```

Then drop the dangerous universal policy:
```sql
DROP POLICY "Universal Insert Policy" ON public.collab_requests;
```

## 4. Frontend — Normalize URL Before Insert

In `Dashboard.tsx`, run the creator's `substack_url` through `normalizeSubstackUrl()` before passing it as `requester_substack_url`. This converts `substack.com/@elena` → `elena.substack.com` as defense-in-depth.

## 5. UI Filtering — Hide Solo Drafts from "Pending" Management

The Requests page currently shows solo drafts in the Approved tab. The pending tab won't show them (solo status is `approved`). No additional filtering needed — solo drafts naturally appear where they should.

## Files

| File | Change |
|------|--------|
| SQL Migration | Update `validate_requester_substack_url` to skip solo; add solo INSERT policy; drop universal INSERT policy |
| `src/pages/Dashboard.tsx` | Import and use `normalizeSubstackUrl()` on line 260 |

## What We Confirmed Is Already Safe

- `notify_new_collab_request` trigger — already guarded by `status = 'pending'` check
- `requester_name` / `requester_email` NOT NULL — already satisfied (passing creator.name and user email)
- MyRequests page — already filters `.eq('is_solo', false)`

