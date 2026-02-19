
# Post-Collab Experience Loop Fix

## What's Actually Broken

There are three distinct problems across two views (Workspace + RequestCard):

### Problem 1 — "Share Your Experience" navigates away and dies
In `Workspace.tsx` line 358-363, the button does:
```tsx
window.location.href = "/dashboard?feedback=true";
```
This is a full page redirect to the dashboard. The dashboard doesn't listen for `?feedback=true` to auto-open the feedback widget. So the user lands on a generic dashboard with no modal open and no feedback prompted — a "dead redirect."

### Problem 2 — The button has no memory
The publish-answer (`handlePublishAnswer`) writes to `user_feedback` with `feedback_type: 'praise'` and `page_url` matching the workspace URL. But the "Share Your Experience" button is never checked against this existing record. Every time the user opens the workspace, they see the same banner — whether or not they've already answered.

### Problem 3 — RequestCard shows irrelevant actions for past approved collabs
In `RequestCard.tsx` lines 395-489, for `status === "approved"` requests the card shows: Generate Draft, Message, Cancel, Start Drafting. For a collaboration whose `requested_date` is in the past, "Generate Draft" and "Cancel" are irrelevant. There's no way to tell at a glance that it's completed.

---

## The Fix Plan

### Fix 1 — Smart Retrospective Banner (Workspace.tsx)

**Step A: Detect existing publish answer on mount**

On load, query `user_feedback` for the matching `page_url` and `feedback_type = 'praise'` to see if the user has already answered the publish check-in:

```tsx
const [existingRetroFeedback, setExistingRetroFeedback] = useState<{
  message: string;
} | null | undefined>(undefined); // undefined = loading
```

```tsx
useEffect(() => {
  if (!requestId || !user) return;
  supabase
    .from("user_feedback")
    .select("message")
    .eq("user_id", user.id)
    .eq("page_url", `/dashboard/workspace/${requestId}`)
    .eq("feedback_type", "praise")
    .maybeSingle()
    .then(({ data }) => setExistingRetroFeedback(data));
}, [requestId, user]);
```

**Step B: Parse the stored answer from the message**

The existing record's `message` contains `"Post-collab check-in: Published = yes"` or `"Published = not_yet"`. Parse this on load to restore the `publishAnswer` state:

```tsx
useEffect(() => {
  if (!existingRetroFeedback) return;
  if (existingRetroFeedback.message.includes('= yes')) setPublishAnswer('yes');
  else if (existingRetroFeedback.message.includes('= not_yet')) setPublishAnswer('not_yet');
}, [existingRetroFeedback]);
```

**Step C: Fix the "Share Your Experience" button**

Replace the broken `window.location.href` redirect with the feedback widget opener. The feedback widget (`FeedbackWidget`) lives in `App.tsx` as a global component — but it has no external trigger. 

The cleanest solution: open the global `FeedbackWidget` via a custom DOM event, OR simply add a **local inline feedback modal** to the workspace for this specific context.

Given that the feedback widget uses its own state and there's no external trigger, the pragmatic fix is to dispatch a custom event that `FeedbackWidget` listens for:

In `Workspace.tsx`:
```tsx
<Button
  size="sm"
  variant="gradient"
  onClick={() => {
    window.dispatchEvent(new CustomEvent("open-feedback-widget"));
  }}
>
  Share Your Experience
</Button>
```

In `FeedbackWidget.tsx`, add a listener:
```tsx
useEffect(() => {
  const handler = () => setIsOpen(true);
  window.addEventListener("open-feedback-widget", handler);
  return () => window.removeEventListener("open-feedback-widget", handler);
}, []);
```

**Step D: If already answered, show a "View Your Answer" state**

When `publishAnswer` already exists (from the DB query), transform the banner from an action prompt to a completion summary:
- Don't show the Yes/No buttons — instead show the badge of what was answered
- Change "Share Your Experience" to "Add More Feedback" (secondary/ghost variant)
- The banner can still be dismissed

---

### Fix 2 — RequestCard Past Collaboration Archive View

In `RequestCard.tsx`, detect if the approved collaboration's date has passed:

```tsx
const isPastCollab = (() => {
  const dateStr = (request as any).requested_date;
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reqDate = parseDateString(dateStr);
  reqDate.setHours(0, 0, 0, 0);
  return reqDate < today;
})();
```

For `approved` requests where `isPastCollab === true`, replace the full action block with a clean "Milestone Summary" view:

```tsx
{request.status === "approved" && isPastCollab && (
  <div className="space-y-3 pt-3 border-t mt-3">
    <div className="flex items-center gap-2 text-sm text-success font-medium">
      <Check className="w-4 h-4" />
      <span>Collaboration milestone reached</span>
    </div>
    <Button
      variant="gradient"
      className="w-full"
      onClick={() => navigate(`/dashboard/workspace/${request.id}`)}
    >
      <PenLine className="w-4 h-4 mr-2" />
      View Final Workspace
    </Button>
  </div>
)}

{request.status === "approved" && !isPastCollab && (
  // ... existing action block unchanged
)}
```

This eliminates the irrelevant "Generate Draft" and "Cancel" buttons for past collabs.

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Workspace.tsx` | Query DB for existing retro feedback on mount; restore publish answer from existing record; fix "Share Your Experience" button to dispatch custom event instead of redirecting |
| `src/components/feedback/FeedbackWidget.tsx` | Add `window.addEventListener("open-feedback-widget")` to open the widget programmatically |
| `src/components/requests/RequestCard.tsx` | Add `isPastCollab` detection; show archive view for past approved collabs instead of irrelevant action buttons |

No database schema changes required — all data already exists in `user_feedback` with the correct shape.

---

## Edge Cases Handled

- **Undefined state while loading**: `existingRetroFeedback` starts as `undefined` (loading) → the Yes/No buttons stay hidden until the check completes, preventing a flash of "unanswered" state
- **User answers Yes/No, then re-opens workspace**: The DB query restores their answer immediately, so the banner shows "Already answered" state
- **Request with no `requested_date`**: `isPastCollab` returns `false`, so the normal action block shows (correct behavior — no date = not past)
- **Guest vs. Creator on RequestCard**: `isPastCollab` check applies equally regardless of role — both see the archive view
