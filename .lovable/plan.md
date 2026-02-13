

# Post-Collab Retrospective Banner + Survey Enhancement

Everything from the previous plan is already deployed. This adds two new pieces:

---

## 1. Retrospective Banner in the Workspace

When a collaboration's `requested_date` is today or in the past, show a celebratory banner at the top of the workspace (above the SharedWorkspace editor). This creates an in-app "closing the loop" moment.

**File:** `src/pages/Workspace.tsx`

- Add date comparison logic: if `requested_date <= today`, show the banner
- Banner content:
  - Celebratory heading: "Milestone reached!" with a party emoji
  - Two quick questions rendered as clickable pill buttons:
    - "Was this post published?" (Yes / Not yet)
    - "How did the collaboration feel?" (links to open the feedback widget with pre-filled context)
  - Clicking "Yes" or "Not yet" saves the response to `user_feedback` table as type `"praise"` with contextual metadata
  - The banner is dismissible and remembers dismissal via localStorage (`retro-dismissed-{requestId}`)
- Uses existing glass-card styling with a coral/green left border accent

### Layout

```text
+-----------------------------------------------+
| Milestone reached!                         [X] |
| Your collab with Raghav was scheduled for      |
| today. How did it go?                          |
|                                                |
| Was this published?  [Yes]  [Not yet]          |
| [Share Your Experience] (opens feedback widget)|
+-----------------------------------------------+
```

---

## 2. Enhance Retrospective Email with 3-Question Survey

Update the retrospective email template to include three quick-response survey questions with clickable links.

**File:** `supabase/functions/send-collab-retrospective/index.ts`

- Add three survey questions to `buildRetrospectiveEmail()`:
  1. "Did the SMART draft save you time?" -- Yes / No (links to feedback URL with query params)
  2. "Was the workspace helpful?" -- Yes / No
  3. "Would you collaborate here again?" -- Yes / Definitely
- Each answer links to `{baseUrl}/dashboard?feedback=true&q=draft_time&a=yes` (the feedback widget opens with pre-filled context)
- Keep the existing "Share Your Experience" CTA button

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/pages/Workspace.tsx` | Add retrospective banner when date is today or past |
| `supabase/functions/send-collab-retrospective/index.ts` | Add 3-question survey to email template |

No new tables or migrations needed -- responses flow through the existing feedback widget and `user_feedback` table.
