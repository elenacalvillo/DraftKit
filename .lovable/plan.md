## Fix: "priceId is required" + missing Project tier schema

### Root cause
1. The "Upgrade to Project tier" button calls `create-checkout` with `{ plan: "project" }`. The function reads `Deno.env.get("PROJECT_TIER_PRICE_ID")` to resolve the Stripe price — that secret is not set, so it returns `priceId is required`.
2. The Project tier code (`useProjects`, `useProjectMembers`, `useProjectChapters`, `useProjectBroadcasts`, `project-broadcast` edge function, `ProjectDetail.tsx`, `Projects.tsx`) references tables (`projects`, `project_members`, `project_broadcasts`), columns on `collab_requests` (`project_id`, `is_project_workspace`, `chapter_order`), and an RPC (`is_project_owner`) that **do not exist in the database**. The generated `src/integrations/supabase/types.ts` has zero references to them, which is the build-error source.

I already created the Stripe product/price via the Stripe API:
- Product: `prod_URe679o408Efnc` — "DraftKit Project Tier"
- Price: `price_1TSknqAgAh00fVW1Opx4dfq7` — $49.00 USD / month

### What I'll do once approved

**1. Add the `PROJECT_TIER_PRICE_ID` secret**
Prompt for it via `add_secret` and have you paste `price_1TSknqAgAh00fVW1Opx4dfq7`. The `create-checkout` function already reads this env var — no code change needed.

**2. Migration: create the Project tier schema**

```text
projects
  id uuid PK, creator_id uuid -> creators.id, title text NOT NULL,
  description text, is_archived bool DEFAULT false,
  created_at, updated_at timestamptz

project_members
  id uuid PK, project_id uuid -> projects.id ON DELETE CASCADE,
  email text NOT NULL, user_id uuid (auto-linked via existing
  normalize_email pattern), role text CHECK IN
  ('admin','chapter_writer','peer_reviewer','cross_chapter_reviewer'),
  invited_by uuid, invited_at timestamptz DEFAULT now(),
  joined_at timestamptz, UNIQUE(project_id, lower(email))

project_broadcasts
  id uuid PK, project_id uuid -> projects.id ON DELETE CASCADE,
  sender_id uuid, sender_name text, message text,
  recipient_count int, created_at timestamptz

collab_requests (new columns, all nullable / safe defaults)
  project_id uuid REFERENCES projects(id),
  is_project_workspace bool DEFAULT false,
  chapter_order int
```

**3. RLS policies (least privilege, mirroring existing patterns)**
- `projects`: owner (creator) full RW; members SELECT only.
- `project_members`: project owner full RW; member can SELECT own row.
- `project_broadcasts`: project owner INSERT/SELECT; members SELECT only. Direct INSERT denied for non-owners (the edge function uses service role).
- `collab_requests` policies are unchanged — new columns are covered by the existing policies.

**4. Helper RPC** `is_project_owner(_user_id uuid, _project_id uuid)` — `SECURITY DEFINER`, returns boolean. Used by `project-broadcast` and policies. Mirrors `is_request_owner`.

**5. Auto-link `project_members` triggers**
Reuse the same `normalize_email` pattern already in place: BEFORE INSERT trigger to set `user_id` if a matching `auth.users` row exists; ON auth.users INSERT, also link orphaned member rows. Sets `joined_at = now()` when linked.

**6. Code follow-ups (small)**
- After the migration runs, `src/integrations/supabase/types.ts` is regenerated automatically by the Supabase integration — that resolves the TS build errors in the four hooks and the `project-broadcast` function.
- No changes to `create-checkout/index.ts` — it already supports `plan: "project"` via the env var.

### Verification
1. `Subscription` page → "Upgrade to Project tier" → opens a Stripe checkout for $49/mo.
2. `useProjects`, `useProjectMembers`, `useProjectBroadcasts`, `useProjectChapters` compile cleanly.
3. `project-broadcast` edge function returns 200 for an owner with members; 403 for a non-owner.
4. Existing collaboration flows (RLS on `collab_requests`, `workspace_collaborators`, presence) are untouched.

### Out of scope
No security policy rewrites, no changes to existing collab tables, no Pro logic changes — this plan only adds the missing Project tier wiring.
