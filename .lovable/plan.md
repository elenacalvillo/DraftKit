
# Launch-Ready: Serif Fix, Workspace Export, and Post-Collab Retrospective

Five changes across frontend and backend to get DraftKit launch-ready.

---

## 1. Remove Serif from Zen Header Title

The "Drafting with Raghav Mehra" title in the workspace header still uses Georgia/serif (line 91 of `DashboardLayout.tsx`). Remove the inline `style` attribute so it inherits the app's Inter font.

**File:** `src/components/layout/DashboardLayout.tsx` (line 91)

---

## 2. Download Workspace Draft as .docx

Add a "Download Draft" button to the SharedWorkspace header (next to "Edit Draft"). When clicked, it extracts the workspace HTML content, converts it to a Word document using the existing `docx` library, and triggers a download.

**File:** `src/components/requests/SharedWorkspace.tsx`
- Add a Download button (with a `Download` icon) in the header bar, visible when there is content
- Create a new function `exportWorkspaceToDocx(html, title)` in `src/lib/export-draft.ts` that:
  - Strips HTML tags to extract plain text paragraphs
  - Builds a `docx` Document with the content
  - Downloads as `"Workspace Draft.docx"`

**File:** `src/lib/export-draft.ts`
- Add a new `exportWorkspaceHtmlToDocx(html: string, filename: string)` function that converts HTML content to a Word document

---

## 3. Post-Collaboration Retrospective Email

Create a new email type `collab_retrospective` in the `send-collab-email` edge function. A new edge function `send-collab-retrospective` will run daily (like the reminder function) and check for approved collabs where `requested_date = today`. It sends both the creator and the requester a branded email asking "How did it go?" with a link back to the app's feedback widget.

**New file:** `supabase/functions/send-collab-retrospective/index.ts`
- Queries `collab_requests` where `status = 'approved'`, `requested_date = today's date`
- For each match, sends a retrospective email to both creator and requester
- Tracks sent retrospectives to avoid duplicates (uses `email_events` table with type `collab_retrospective`)

**Updated file:** `supabase/functions/send-collab-email/index.ts`
- Add the `collab_retrospective` email type
- Email content: congratulatory message, summary of the collaboration, and a CTA to rate the experience

**Database migration:**
- No new tables needed -- uses existing `email_events` table for deduplication with type `collab_retrospective`

---

## 4. Add `collab_retrospective` to Analytics Events

**File:** `src/hooks/useAnalytics.ts`
- No changes needed server-side; the edge function handles tracking via `email_events`

---

## 5. Update Config for New Edge Function

**File:** `supabase/config.toml`
- Add `[functions.send-collab-retrospective]` with `verify_jwt = false` (it uses service role key internally)

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/layout/DashboardLayout.tsx` | Remove serif inline style from zen title |
| `src/lib/export-draft.ts` | Add `exportWorkspaceHtmlToDocx()` function |
| `src/components/requests/SharedWorkspace.tsx` | Add Download button in header |
| `supabase/functions/send-collab-email/index.ts` | Add `collab_retrospective` email type |
| `supabase/functions/send-collab-retrospective/index.ts` | New daily retrospective checker |
| `supabase/config.toml` | Register new edge function |

