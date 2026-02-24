## Workspace Stickiness and Pro Conversion Redesign — COMPLETED

### What was done

1. **CollabDraftModal.tsx** — Primary action is now "Apply to Workspace" (full-width gradient button). Saves `ai_draft` into `shared_content` (if empty) before navigating. Google Docs integration removed entirely. "Copy Raw Text" and "Download as Word" moved into a secondary dropdown.

2. **Workspace.tsx** — All "AI" references renamed to "SMART" (button labels, toast messages, `content_last_edited_by`). `requestId` now passed to `CollabDraftModal`.

3. **RequestCard.tsx** — `requestId={request.id}` passed to `CollabDraftModal`.

4. **useAnalytics.ts** — Added `draft_applied_to_workspace` event type.
