

## Fix: Prevent AI Draft from Overwriting Manual Content + Dynamic Button Labels

### The Problem (from Dinah's feedback)

1. **AI draft overwrites manual work**: When "Generate AI Draft" is clicked, the edge function unconditionally overwrites `shared_content` -- even if a human already wrote there
2. **"Start Drafting" is misleading**: The button always says "Start Drafting" even when manual content already exists -- should say "Continue Drafting"
3. **"View Draft" shows AI modal, not the workspace**: Clicking "View Draft" opens the read-only AI draft modal instead of navigating to the editable workspace

### Good News: No Data Loss

Dinah's content is safe in the database -- `content_last_edited_by` shows "Dinah Davis - Code Like A Girl". The issue is purely UX: the AI generation overwrites existing manual content, and buttons route to the wrong place.

### Changes

**1. Edge Function: `supabase/functions/generate-collab-draft/index.ts`**

Add a safety check before overwriting `shared_content`:
- Fetch the current `shared_content` value first
- If `shared_content` already has human-written content (i.e., `content_last_edited_by` is NOT "AI Draft" and NOT null), do NOT update `shared_content` -- only save `ai_draft`
- If `shared_content` is empty or was last edited by "AI Draft", auto-populate as before

**2. RequestCard: Dynamic button label (`src/components/requests/RequestCard.tsx`)**

Line 534-541 -- the "Start Drafting" button:
- Check if the request has `shared_content` (non-empty)
- If yes: label becomes **"Continue Drafting"** with a `PenLine` icon
- If no: keep "Start Drafting"

Lines 451-458 -- the "View Draft" / "Generate Draft" button:
- Rename "View Draft" to **"View AI Draft"** to make it clear this opens the AI reference modal, not the workspace

**3. Workspace sidebar: Already correct**

The sidebar in `Workspace.tsx` (line 699-706) already says "View AI Draft" -- no change needed there.

**4. Workspace.tsx: Protect against AI overwrite on frontend**

Lines 169-183 -- after `generateDraft()` returns:
- Only update `request.shared_content` in local state if `request.shared_content` was previously empty
- This prevents the frontend from displaying the AI-generated content over existing manual work

### Data Recovery

No recovery needed -- Dinah's manual content is intact in the database. The `shared_content` field currently contains her manual edits (last edited by "Dinah Davis - Code Like A Girl" at 2026-02-23 22:11).

### Technical Details

| File | Change |
|------|--------|
| `supabase/functions/generate-collab-draft/index.ts` | Check existing `shared_content` before overwriting; skip if human-edited |
| `src/components/requests/RequestCard.tsx` | "Start Drafting" becomes "Continue Drafting" when content exists; "View Draft" becomes "View AI Draft" |
| `src/pages/Workspace.tsx` | Only apply AI-generated `shared_content` to state if workspace was empty |

