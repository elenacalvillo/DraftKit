## What I found
Chapter creation is failing because project chapters are inserted into `collab_requests` with `status: "Draft"`, but the live backend only allows `pending`, `approved`, `declined`, `cancelled`, and `published`.

The deeper architectural issue is that one field is being used for two different concepts:
- `collab_requests.status` = collaboration lifecycle
- project chapter UI statuses (`Draft`, `Peer Review`, `Editorial`, `Final`) = editorial workflow

That mismatch means the current implementation cannot work reliably in preview or published.

## Plan
1. **Add a dedicated chapter workflow field in the database**
   - Add a new `chapter_stage` field for project workspace rows.
   - Keep `collab_requests.status` for collaboration lifecycle only.
   - Update the chapter-create policy so project chapters are created with a valid row lifecycle state instead of UI-only status labels.

2. **Normalize chapter rows to a safe backend contract**
   - Create project chapters with `status = 'approved'` so the existing workspace access and editing rules continue to work.
   - Store the book workflow in `chapter_stage` with stable values like `draft`, `peer_review`, `editorial`, `final`.
   - Backfill any existing project chapter rows if needed.

3. **Update the frontend chapter flow**
   - Change `useProjectChapters` and `ProjectDetail` to read/write `chapter_stage` instead of overloading `status`.
   - Keep the same user-facing labels in the chapter UI.
   - Preserve better error reporting so real backend failures surface clearly.

4. **Prevent project chapters from polluting collaboration metrics and limits**
   - Exclude `is_project_workspace = true` rows from host capacity, analytics counts, active collabs, and normal request-style views where they do not belong.
   - Verify project chapters only appear in the project workspace screens.

5. **Validate the full flow**
   - Confirm add chapter works in preview.
   - Confirm chapter status changes work.
   - Confirm project chapters do not inflate regular collab counts or break workspace access.

## Technical details
- **Database migration needed first**
  - Add `chapter_stage` to `public.collab_requests`
  - Add validation for allowed chapter stage values
  - Update the `Project owners can create chapter workspaces` policy to require a valid collab lifecycle state plus a valid chapter stage
  - Update any backend functions that count or filter normal collaborations to exclude project chapter rows

- **Frontend files likely involved**
  - `src/hooks/useProjectChapters.ts`
  - `src/pages/ProjectDetail.tsx`
  - `src/lib/access.ts`
  - collaboration metric / capacity readers that currently treat all `collab_requests` rows the same

- **Why this is the safest fix**
  - It avoids expanding the global `status` constraint into conflicting meanings
  - It keeps existing workspace permissions usable
  - It prevents book chapters from corrupting collaboration analytics and limits