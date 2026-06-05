## Plan: Inline-editable chapter titles

Chapter titles live in `collab_requests.message`. The existing `enforce_collaborator_field_restrictions` trigger already permits the project owner and the chapter's assigned writer (requester) to edit `message`, so no schema or RLS changes are needed.

### 1. New mutation in `src/hooks/useProjectChapters.ts`

Add `updateChapterTitle` alongside the other mutations:
- Input: `{ chapterId: string; title: string }`.
- Trims the title, rejects empty strings.
- `supabase.from("collab_requests").update({ message: trimmed }).eq("id", chapterId)`.
- On success, invalidate `["project_chapters", projectId]` **and** `["workspace_request", chapterId]` (used by the Workspace page) so both views refresh.
- Surface a permission error (`code === "42501"`) as "You don't have permission to rename this chapter."

### 2. `src/pages/ProjectDetail.tsx` — inline edit in the chapter row

Inside the chapter row (around line 375, the `<Link>` containing `{idx + 1}. {c.message ?? "Untitled chapter"}`):

- Replace the title `<div>` with a small `ChapterTitleInline` block (kept local to the file — no new file needed).
- Default state: render `{idx + 1}. {title}` as a clickable link to the workspace, with a muted `Pencil` icon button (lucide-react, `w-3.5 h-3.5`) appearing next to it. The pencil is always visible but `opacity-0 group-hover:opacity-100 focus-visible:opacity-100` for a clean resting state; on touch it stays visible.
- Editing state: swap the title into an `<Input>` (shadcn) pre-filled with the current title, plus a small Check / X icon pair. The numeric prefix (`{idx + 1}.`) stays static outside the input.
- Save triggers on Enter or Check click; cancel triggers on Escape or X click; blur saves if dirty, cancels if unchanged.
- While the mutation is pending: disable the input, show a small spinner in place of the Check icon.
- Hide the Pencil entirely when `isReadOnly` is true.
- Keep the existing `Link` navigation — clicking the title text (not the pencil) still routes to `/dashboard/workspace/${c.id}`. The pencil button uses `e.preventDefault(); e.stopPropagation()` to avoid navigating.
- Toast on error using existing `toast.error`; silent success (no toast) to stay quiet.

### 3. `src/pages/Workspace.tsx` — editable header title

The header currently passes `zenTitle={isSolo ? \`Drafting: ${request.message || "Untitled Project"}\` : \`Drafting with ${partnerName}\`}` (around line 587).

- For solo / project-workspace chapters (where the current user has edit permission — owner or assigned writer), replace the static string with a small inline-editable component rendered inside the zen header.
- Resting state: shows `Drafting: <Title>` with the title styled as a subtle click-target (`hover:bg-muted/40 rounded px-1 -mx-1 cursor-text`), no pencil icon needed in the zen bar to keep it minimal — a `title="Click to rename"` tooltip is enough.
- Click → swap the title text into a borderless input sized to content, autofocused, text selected.
- Save on Enter or blur; revert on Escape. Pending state shows a small spinner appended; errors raise a `toast.error` and revert the input value.
- Reuses the same `updateChapterTitle` mutation; on success the workspace request query invalidates and the header rerenders with the new title.
- Read-only viewers (collaborators who are not the requester and not the owner) get the existing static text — no edit affordance.

### Out of scope

- No changes to the left summary card on the workspace (it reads from the same request and will pick up the new title on refetch via the cache invalidation above; if needed in a later pass we can wire it to the same component, but the user asked for the two specific surfaces).
- No schema/RLS changes, no new tables, no changes to chapter status, ordering, or writer assignment.
- No new dependencies.
