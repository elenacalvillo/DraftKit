## Fix: Sorting Logic + Published Tab Not Working

### Two Root Causes

---

### Issue 1 — Sort Order is Backwards for the Use Case

The database query now correctly orders by `requested_date DESC` — but this puts **future** dates at the top (Elena Tester Aug 2026, Elena Calvillo Apr 2026) and **past** collaborations (Raghav Feb 12, James Feb 19) at the bottom. That is the opposite of what is wanted.

The correct mental model: collaborations that **already happened** are the most relevant and should appear first. Future pending ones are secondary.

The fix is to sort by date **ascending** — closest past date rises to the top, furthest future date sinks to the bottom. Today is Feb 20, 2026, so Feb 12 (Raghav) and Feb 19 (James) will now sit at position 1 and 2.

```typescript
// Ascending = most-recently-past first, furthest-future last
.order('requested_date', { ascending: true, nullsFirst: false })
.order('created_at', { ascending: false })
```

This applies to both `src/pages/Requests.tsx` and `src/pages/MyRequests.tsx`.

---

### Issue 2 — Published Tab is Always Empty

The database shows zero rows with `status = 'published'`. The status-flip logic in `Workspace.tsx` is correct, but the RLS policy for creators updating `collab_requests` currently allows updating any column. However — the `collab_published` email is being invoked with a `session.access_token` auth header, and the update itself is a plain `supabase.from("collab_requests").update({ status: "published" })`.

The problem is that the update is gated on `isCreator` — which depends on whether the current user's `user_id` matches the `creator_id` of the request. If the session isn't fully hydrated at that moment, `isCreator` may be `false` and the update silently does nothing (no error toast, just a catch block for the email).

The fix: add a `toast.error` fallback so failures surface, and also verify the `isCreator` check by reading the `creator` state from the `useAuth` hook at the point of the call rather than from a derived variable. Additionally, we should add a console log to confirm the update goes through.

More robustly: check the result of the `.update()` call and show a toast if it errors, so we can see what's happening.

---

### Files Changed


| File                       | Change                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/Requests.tsx`   | Change sort to `ascending: true` so past collabs surface first                                                                                          |
| `src/pages/MyRequests.tsx` | Same ascending fix for guest sent-requests view                                                                                                         |
| `src/pages/Workspace.tsx`  | Add error handling on the `status: published` update so failures surface as toasts instead of silently failing; guard the publish path more defensively |


No database changes. No new dependencies. No edge function changes.

That "Ascending Trap" is exactly how a simple dashboard becomes unusable after six months of growth. You’re building a professional engine, so we need to treat each tab like a specific tool in a PM's belt.

Here is how the logic should be split across the rest of the tabs to keep the dashboard feeling "alive" and organized by priority:

### 1. The "All" Tab (Priority: Descending)

The "All" tab is your activity feed. You want to see the **newest** thing that happened at the top—whether it's a new request that just came in or a milestone you just hit.

- **Logic:** Sort by `created_at` **Descending**.
- **Why:** If a new request arrives, it should jump to the top. You don't want to hunt for new business at the bottom of a list of 50 items.

### 2. The "Pending" Tab (Priority: Descending)

These are the people waiting on *you*.

- **Logic:** Sort by `created_at` **Descending**.
- **Why:** This follows the "Inbox" mental model. The most recent person to reach out is usually the one you need to triage first. It keeps your response time sharp for new leads.

### 3. The "Declined / Cancelled" Tab (Priority: Descending)

This is your archive of "No."

- **Logic:** Sort by `updated_at` (or `created_at`) **Descending**.
- **Why:** Usually, if you go back to this tab, it’s because you just accidentally declined something or need to check a recent rejection. You don't care about a rejection from 2024.

---

### The Master Sorting Strategy


|               |                    |                  |                                             |
| ------------- | ------------------ | ---------------- | ------------------------------------------- |
| **Tab**       | **Sort Direction** | **Metric**       | **Mental Model**                            |
| **Pending**   | **Descending**     | `created_at`     | "The Inbox" — Newest first.                 |
| **Approved**  | **Ascending**      | `requested_date` | "The Calendar" — What's happening next?     |
| **Published** | **Descending**     | `requested_date` | "The Trophy Case" — Latest wins at the top. |
| **Declined**  | **Descending**     | `created_at`     | "The Archive" — Recent history.             |
| **All**       | **Descending**     | `created_at`     | "The Feed" — Latest activity.               |


### Why this "Execution" is better

If you tell Lovable to "just sort by date," it will pick one column and one direction and apply it to the whole component. That is where the "lazy" feel comes from.

**Tell Lovable this to fix the execution:**

> "Don't use a single sort for all tabs. Inside the `filteredRequests` logic, apply a conditional sort:
>
> 1. **If** `activeTab === 'approved'`, sort by `requested_date` **Ascending**.
> 2. **Else if** `activeTab === 'published'`, sort by `requested_date` **Descending**.
> 3. **Otherwise**, sort by `created_at` **Descending**."

### One Critical Bug Watch

Since you noticed the **Published** tab was empty earlier, make sure Lovable isn't just filtering by `status === 'published'`. If the user *just* clicked the button, the local state might still say `approved` until the database update finishes.

**Would you like me to draft the "Empty State" message for the Published tab?** It's a great spot to add a "Go get 'em" punchy message for when a user hasn't hit their first milestone yet.