## Why "Add chapter" fails

The chapter creation flow inserts into `collab_requests` with:

- `is_project_workspace: true`
- `is_solo: true`
- `status: "Draft"`
- `creator_id`: the project owner's creator id

Currently `collab_requests` has only two INSERT RLS policies:

1. **"Anyone can create requests"** — requires `status = 'pending'`
2. **"Creators can create solo workspaces"** — requires `status = 'approved'` AND `auth.uid() = requester_user_id`

A chapter row with `status = 'Draft'` matches **neither**, so RLS rejects every insert. The toast shows "Failed" and the response surfaces the misleading apikey/PostgREST error in the console.

(The actual triggers — `link_request_to_existing_user`, `validate_requester_substack_url`, `notify_new_collab_request` — are fine; the notify trigger only fires on `status='pending'`, and the URL validator skips solo rows.)

## Plan

### 1. Add a dedicated RLS INSERT policy for project chapters (migration)

```sql
CREATE POLICY "Project owners can create chapter workspaces"
ON public.collab_requests
FOR INSERT
TO authenticated
WITH CHECK (
  is_project_workspace = true
  AND project_id IS NOT NULL
  AND status = ANY (ARRAY['Draft','In Review','Approved','Scheduled','Published'])
  AND creator_id IN (
    SELECT c.id FROM public.creators c WHERE c.user_id = auth.uid()
  )
  -- Reuse the same hardening as the existing INSERT policy
  AND hidden_by_creator = false
  AND hidden_by_requester = false
  AND requester_name IS NOT NULL
  AND char_length(btrim(requester_name)) BETWEEN 1 AND 100
  AND requester_email IS NOT NULL
  AND char_length(btrim(requester_email)) BETWEEN 3 AND 255
  AND btrim(requester_email) ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
  AND ai_draft IS NULL
  AND approved_at IS NULL
  AND reminder_sent_at IS NULL
  AND creator_notes IS NULL
);
```

This is scoped strictly to project workspaces owned by the current user, so it does not weaken any existing RLS rule on regular collab requests.

### 2. Surface a clearer error in the UI

In `src/hooks/useProjectChapters.ts` `createChapter`, wrap the insert error to map Postgres code `42501` (RLS violation) to a friendlier message: "You don't have permission to add a chapter to this project." Then in `src/pages/ProjectDetail.tsx#handleCreateChapter`, log `console.error` with the original error so future regressions don't appear as the cryptic "No API key" string.

### 3. Verify

- Run the migration.
- Re-test "Add chapter" as the project owner — should succeed and the new chapter should appear in the list.
- Quick check that creating a regular (non-project) collab request still works (existing "Anyone can create requests" policy unchanged).
- Run the existing unit tests (`vitest run`) to make sure nothing else regressed.

Lovable's plan is technically sound for fixing the immediate bug, but as a PM, you’re missing the **Lifecycle and Discovery** parts of this feature. Fixing the "Add Chapter" button is only 50% of the job; the other 50% is making sure the user knows what to do with it and that it doesn't create a "ghost town" of empty drafts.

Here is what is missing to make this a professional-grade feature:

### 1. The "First Chapter" Onboarding

Right now, if a project has 0 chapters, what does the user see?

- **Missing:** An "Empty State" component.
- **The Elena Move:** If `chapters.length === 0`, show a punchy call-to-action: *"Every great project starts with a single chapter. Add your first one to get moving."*

### 2. Chapter Sequencing (The "Messy Room" Risk)

As Dinah adds 20 chapters, they will likely be returned in the order they were created (ID-based) or last edited.

- **Missing:** A `sort_order` or `sequence_index` column.
- **The Risk:** If she writes Chapter 5 before Chapter 2, her project view will be a mess.
- **The Fix:** We should add a hidden `sort_order` integer to the insert logic so we can eventually allow "Drag and Drop" reordering.

### 3. The "Unused Row" Cleanup

If people click "Add Chapter" 50 times just to see what happens, your `collab_requests` table will fill up with junk.

- **Missing:** A "Delete Chapter" function.
- **The Logic:** Since these are `is_solo: true` and `is_project_workspace: true`, the creator should have full destructive power over them. Lovable needs to add a `DELETE` RLS policy alongside the `INSERT` one.

---

### The Economic & Performance Guardrails

Since you asked about costs earlier, here is the breakdown of how "Chapters" change your database load:


|                  |            |                                                                                                                            |
| ---------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Metric**       | **Impact** | **Strategy**                                                                                                               |
| **Index Bloat**  | Low        | We need an index on `project_id` to keep the Chapter list fast as the table grows.                                         |
| **API Latency**  | Medium     | Loading a project with 50 chapters might slow down the UI. We should use **Select Filtering** (already in Lovable's plan). |
| **Storage COGS** | Zero       | Unless they add images, chapters are effectively free.                                                                     |


---

### Final Instruction for Lovable (The "Project Completion" Pass)

"The RLS fix is a start, but we need to harden the Project Feature for a public launch. Implement these three additions:

**1. Sequential Logic**

- Add a `sort_order` integer to the `collab_requests` table (default to 0).
- When creating a chapter, set `sort_order` to `current_max_order + 1`.

**2. The Delete Policy**

- Add an RLS `DELETE` policy: **'Project owners can delete their own chapters.'**
- Constraint: `is_project_workspace = true AND creator_id = auth.uid()`.

**3. Empty State UI**

- In `ProjectDetail.tsx`, if no chapters exist, render a high-intent 'Empty State' illustration and a large 'Add First Chapter' button instead of just a blank list.

**4. Performance**

- Ensure we have a database index on `project_id` to keep the chapter fetch snappy."

## Out of scope

- No changes to triggers, the notify function, or any other RLS policy.
- No edits to chapter UI/visual styling.
- Analytics/metrics dashboard work from previous turns is untouched.