## Goal

Fix the 0.0% Draft Acceptance Rate. Today the only path that fires `draft_copied` is the legacy `CollabDraftModal` (the SMART pre-draft outline). The actual product surface — the Shared Workspace where users finalize the post — has **no Copy button and no acceptance tracking at all**. The only acceptance-shaped action is "Download" (.docx), and it isn't tracked either. So the metric reads 0% even when users are publishing.

This plan is scoped to the **tactical retention ask**: real acceptance tracking + value-realization moment. The email migration / nudge work is a separate thread and not bundled here.

## Changes

### 1. Add a Copy button to the Shared Workspace header

`src/components/requests/SharedWorkspace.tsx` — alongside Download, add a Copy button (visible whenever `hasContent`, for both creator and guest, regardless of `canEdit`):

- Strips HTML to plain text + a rich HTML clipboard payload (using `ClipboardItem` with `text/plain` and `text/html`) so paste into Substack / Beehiiv keeps headings, lists, bold.
- On success: `toast.success("Draft copied — paste it into Substack. You just saved ~30 minutes.")`
- Fires two analytics events:
  - `draft_copied` (keeps existing DAR numerator working)
  - `draft_accepted` (new canonical acceptance event with `{ request_id, surface: "workspace_copy", word_count }`)

### 2. Track Download as acceptance too

Same file, existing Download handler — on success fire `draft_accepted` with `surface: "workspace_download"` and update its toast copy to: `"Draft downloaded — ready for Substack."`

### 3. Track Copy from the SMART draft modal

`src/components/requests/CollabDraftModal.tsx` — the existing `copyToClipboard` already fires `draft_copied`. Add `draft_accepted` with `surface: "smart_draft_copy"` and tighten the toast: `"Outline copied. Drop it into your editor to start drafting."`

### 4. Wire the new event into analytics types

`src/hooks/useAnalytics.ts` — add `"draft_accepted"` to `AnalyticsEventType`.

### 5. Update the Admin dashboard metric

`src/pages/AdminAnalytics.tsx` — switch DAR numerator from `draft_copied` to `draft_accepted` (deduplicated by `request_id` so a user copying twice doesn't double-count). Keep `draft_copied` as a secondary tile for backwards comparison so historical numbers don't go blank. Threshold for `darNeedsAction` stays at 30%.

```text
DAR = unique(request_id where draft_accepted) / draft_generated
```

No DB migration needed — `analytics_events` already accepts arbitrary `event_type`.

## Out of scope (call out, don't build now)

- Resend → Supabase SMTP migration for nudge emails
- "Did you publish?" 48h check-in email
- 6-day re-engagement prompt
- Audit of `project-broadcast` / `send-collab-email` for duplicates

These are real and worth doing, but they're a separate plan (email infra + cron + templates) and would dilute this fix. Once acceptance is being tracked truthfully for ~48h we'll have a real baseline to measure those nudges against.

## Files touched

- `src/components/requests/SharedWorkspace.tsx`
- `src/components/requests/CollabDraftModal.tsx`
- `src/hooks/useAnalytics.ts`
- `src/pages/AdminAnalytics.tsx`

Approve and I'll ship it.

Don't forget to update the specs md in the files.