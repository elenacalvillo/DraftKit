
# Comment-only reviewers + chapter version history

Two additive changes so authors keep control of their words and reviewers still contribute meaningfully — without turning DraftKit into Google Docs.

## Part 1 — Comment-only reviewer mode

**Roles affected:** `peer_reviewer` and `cross_chapter_reviewer`. `admin` and `chapter_writer` keep full edit rights unchanged.

**What reviewers can do:** open the chapter, read it, select text, and add / edit / delete their own sticky highlight comments (the `StickyComment` mark we already ship).
**What they can't do:** type, delete, paste, format, insert images, or otherwise mutate `shared_content` prose.

### Frontend (`src/components/requests/WorkspaceEditor.tsx` + `src/pages/Workspace.tsx`)
- Resolve the viewer's project role (already available via `useProjectMembers` on project workspaces). Add a `mode: "edit" | "comment"` prop to `WorkspaceEditor`.
- In `comment` mode:
  - Mount Tiptap with `editable: true` but wire an `editorProps.handleKeyDown` / `handleTextInput` / `handlePaste` that blocks everything **except** the sticky-comment commands.
  - Hide the formatting floating toolbar; keep only the "Add comment" affordance on selection.
  - Replace the "Save" / autosave path with a comment-only save that sends the updated `shared_content` (which now differs only by comment marks) through the existing save RPC.
  - Show a small banner: "Review mode — you can comment, not edit."
- Sidebar / header badge: "Reviewing" pill next to the viewer's name so it's obvious.

### Backend guardrail (defense in depth)
- Add a SECURITY DEFINER helper `public.is_comment_only_reviewer(_user_id, _request_id)` that returns true when the viewer's project_members role is peer_reviewer or cross_chapter_reviewer for the chapter's project.
- Extend `save_workspace_content` (or a new sibling `save_workspace_comments_only`) so that when the caller is comment-only, we diff old vs new `shared_content` and reject the write if anything outside `<span class="dk-highlight">` attributes changed. Simple approach: strip all `dk-highlight` spans from both old and new HTML and require the stripped strings to be byte-identical.
- No RLS policy changes needed — access already flows through project role checks.

## Part 2 — Chapter version history

Session-level snapshots, not per-keystroke. Fixes the "what if someone messes up my chapter" fear across all roles.

### Schema (single migration)
```sql
CREATE TABLE public.chapter_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.collab_requests(id) ON DELETE CASCADE,
  shared_content text,
  editor_name text,
  editor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chapter_revisions_request_created_idx
  ON public.chapter_revisions (request_id, created_at DESC);

GRANT SELECT, INSERT ON public.chapter_revisions TO authenticated;
GRANT ALL ON public.chapter_revisions TO service_role;
ALTER TABLE public.chapter_revisions ENABLE ROW LEVEL SECURITY;

-- Read: anyone with workspace access
CREATE POLICY "revisions readable by workspace participants"
  ON public.chapter_revisions FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid(), request_id));
-- Write: only via SECURITY DEFINER RPC (no direct INSERT policy)
```

### Snapshot logic
- Modify `save_workspace_content` to also insert a row into `chapter_revisions` **when** the new content differs from the last snapshot for that request AND the last snapshot is older than 2 minutes (dedupe rapid autosaves into one revision per editing session).
- Retention: keep the latest 30 revisions per chapter. Prune inline in the same RPC (`DELETE ... WHERE id NOT IN (SELECT id ... ORDER BY created_at DESC LIMIT 30)`). Cheap, bounded, no cron needed.

### UI
- New component `src/components/projects/ChapterHistoryDrawer.tsx`, opened from a "History" button in the workspace header (visible to anyone with workspace access; **restore action visible only to admins/chapter_writers**, not comment-only reviewers).
- Drawer shows a list: `{editor_name} · {relative time}`. Click a revision → right-side preview renders sanitized HTML. Two buttons: **Restore this version** (writes it back via `save_workspace_content`, which itself snapshots the pre-restore state so restores are also reversible) and **Diff vs current** (uses `diff` npm package with a simple HTML-safe word-level renderer).
- Add `diff` (or reuse if present) — tiny dependency, no server component.

## Files touched

- `supabase/migrations/<new>_chapter_revisions_and_comment_only.sql` — table + grants + policies + `save_workspace_content` update + `is_comment_only_reviewer` helper + comment-only diff guard.
- `src/components/requests/WorkspaceEditor.tsx` — `mode` prop, keydown/paste guards in comment mode, hide format toolbar.
- `src/pages/Workspace.tsx` — resolve project role → pick mode, render "Reviewing" badge + banner + History button.
- `src/components/projects/ChapterHistoryDrawer.tsx` — new drawer, list + preview + restore + diff.
- `src/hooks/useChapterRevisions.ts` — new hook (`list`, `restore`).
- `src/lib/access.ts` — helper `isCommentOnlyRole(role)`; update role description copy for Peer/Cross-chapter Reviewer to say "read + comment only".
- `src/lib/__tests__/access.test.ts` — cover `isCommentOnlyRole`.

## Out of scope (explicit)

- Real-time cursors or CRDT-style character-level attribution.
- Per-user branching / suggested edits (Option #2). Easy follow-up if reviewers ask for it.
- Comment threads / replies on highlights — current single-comment model stays.
- Rich diff (moves, formatting). Word-level text diff only.

## Risk notes

- The "strip comment marks and compare" diff guard must handle whitespace and attribute-order variance from Tiptap serialization. Mitigate by normalizing both sides through the same DOMPurify config before comparing.
- 30-revision cap × ~50 chapters × ~50KB average HTML ≈ 75 MB per prolific project — well inside our storage budget, but worth watching in analytics.
