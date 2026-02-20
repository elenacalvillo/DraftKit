
## Fix: Sorting for "All" Tab + Published Status Actually Saving

### Two Confirmed Root Causes

---

### Root Cause 1 — "All" Tab Sort Order

The per-tab sort logic is correctly in the code for `approved` and `published` tabs. But the **"All" tab** falls into the `created_at` DESC fallback — which puts old submissions (Raghav Jan 13, James Jan 14) below recently submitted ones.

The user wants all tabs to prioritize by collaboration date. The fix: for the "All" tab, sort by `requested_date` ascending (closest date first, matching the calendar mental model), with `created_at` as a tiebreaker for requests without a date.

```typescript
// Updated fallback for "All", "Pending", "Declined", "Cancelled"
// Sort by requested_date ascending, then created_at descending for undated ones
const aDate = a.requested_date;
const bDate = b.requested_date;
if (aDate && bDate) return aDate.localeCompare(bDate); // both have dates → ascending
if (aDate) return -1; // a has date, b doesn't → a first
if (bDate) return 1;  // b has date, a doesn't → b first
return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // neither has date
```

This means Raghav (Feb 12) and James (Feb 19) float to the top in "All", "Pending", and every other tab too — exactly as expected.

---

### Root Cause 2 — Published Status Never Saves

Looking at `Workspace.tsx` lines 309–353, the flow is:

```
handlePublishAnswer("yes")
  └─ try {
       1. insert into user_feedback (page_url: window.location.pathname)
       2. if (answer === "yes" && isCreator) → update status to "published"   ← ONLY RUNS IF #1 SUCCEEDS
       toast.success("Congrats!")   ← shows regardless, masking any failure
     } catch (e) { console.error only }
```

**The problem:** Step 1 (`user_feedback` insert) is inside the same `try` block. If it fails for any reason (RLS, validation), it throws and Step 2 never runs — but the `toast.success` still fires because it's **outside** the conditional. The user sees "Congrats 🎉" but the database was never updated.

Confirmed by the database query: zero rows with `status = 'published'`.

**The fix:** Split the publish logic into two independent operations so a feedback insert failure can't block the status update. Wrap each in its own try/catch:

```typescript
const handlePublishAnswer = async (answer: "yes" | "not_yet") => {
  setPublishAnswer(answer);

  // Step 1: Flip the canonical status (CRITICAL — must happen first)
  if (answer === "yes" && isCreator && requestId) {
    const { error: publishError } = await supabase
      .from("collab_requests")
      .update({ status: "published" })
      .eq("id", requestId);
    if (publishError) {
      toast.error("Couldn't mark as published — please try again.");
      return;
    }
    setRequest(prev => prev ? { ...prev, status: "published" } : prev);
    // send email...
  }

  // Step 2: Log feedback separately (non-blocking)
  try {
    await supabase.from("user_feedback").insert({ ... });
  } catch (e) {
    console.error("Feedback log failed (non-fatal):", e);
  }

  toast.success(answer === "yes" ? "Congrats on publishing! 🎉" : "No rush — we'll be here when it's ready!");
};
```

---

### Files Changed

| File | Change |
|------|--------|
| `src/pages/Requests.tsx` | Update the "All" tab fallback sort to prioritize `requested_date` ascending |
| `src/pages/Workspace.tsx` | Reorder `handlePublishAnswer` so the DB status update runs **before** (and independently from) the `user_feedback` insert |

No database changes. No new dependencies. No edge function changes.
