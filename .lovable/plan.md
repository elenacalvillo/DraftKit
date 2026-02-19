
# Three Bug Fixes: Calendar, Admin Paywall, and Download Gate

## Root Causes Diagnosed

### Bug 1 — Calendar Dead End (Past Booked Dates)
The `CollabCalendar` component shows "Collaboration booked" for every booked date — whether it's next month or last week. The tooltip is correct but the click behavior is broken for past dates.

**Root cause in `CollabCalendar.tsx` → `handleDateClick`:**
```tsx
if (clickedDate < today) return; // ← This early exit fires for ALL past dates,
                                  //   including past BOOKED dates.
```
The past-date guard runs *before* the booked-date handler. So clicking a past collaboration does nothing — no navigation, no feedback. The workspace is unreachable from the calendar.

**Fix:** Move the booked-date click check *before* the past-date guard. Past booked dates should always navigate to the workspace regardless of whether the date has passed.

Also update the tooltip: for past dates it should say **"View Workspace"** rather than "Collaboration booked" to guide the user.

---

### Bug 2 — Admin Paywall Leak
The `Workspace.tsx` passes `canEdit={isHostPro}` to `SharedWorkspace`, and `isHostPro` comes from `useCreatorPro(request?.creator_id)` which only checks `subscription_tier` and `trial_ends_at` in the `creators` table. It never checks whether the *current viewer* is an admin.

**Root cause chain:**
```
useCreatorPro(hostId) → checks creators.subscription_tier only
canEdit = isHostPro     → ignores isAdmin entirely
```

**Fix:** In `Workspace.tsx`, import `useAdmin`, and override the access gate:
```tsx
const { isAdmin } = useAdmin();
const effectiveCanEdit = isAdmin || isHostPro;
```
Pass `effectiveCanEdit` everywhere `isHostPro` is used as an access gate (`canEdit`, the conversation gate, the upgrade prompts). This is a one-file change that immediately removes all paywalls for admin accounts.

---

### Bug 3 — Download Toast Paradox
In `SharedWorkspace.tsx`, the Download button has **no Pro check at all** — it runs unconditionally for anyone with `hasContent`. Meanwhile, somewhere a toast fires saying "Upgrade to Pro". But the download still completes because the actual `exportWorkspaceHtmlToDocx()` call is never blocked.

Looking at the current code:
```tsx
// Current download button — no gate, runs for everyone
onClick={async () => {
  await exportWorkspaceHtmlToDocx(...);
  toast.success("Draft downloaded");
}}
```

The "Upgrade to Pro" toast the user reported is fired by `handleUpgradeClick` (the click handler on the read-only prose area), not the Download button. The user is clicking the locked editor text (which fires the upgrade toast), then immediately clicking Download (which has no gate and always works). This makes it look like a "fake paywall."

**Fix:** Gate the Download button behind the same `canEdit` prop. Free users (where `canEdit = false`) should see the Download button replaced with an upgrade prompt, or the button should be hidden entirely when `!canEdit`. Since the component already receives `canEdit`, this is a one-line condition change.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/calendar/CollabCalendar.tsx` | Reorder `handleDateClick` — booked check runs before past-date guard; update tooltip label for past dates |
| `src/pages/Workspace.tsx` | Import `useAdmin`, compute `effectiveCanEdit = isAdmin \|\| isHostPro`, pass it to `SharedWorkspace` and conversation gate |
| `src/components/requests/SharedWorkspace.tsx` | Gate Download button behind `canEdit` — free users see no Download button |

No database changes, no new dependencies, no edge function changes.

---

## Detailed Implementation

### Fix 1 — `CollabCalendar.tsx` `handleDateClick`

**Before:**
```tsx
const handleDateClick = (day: number) => {
  const dateStr = formatDate(day);
  const today = new Date(); today.setHours(0,0,0,0);
  const clickedDate = new Date(year, month, day);

  if (clickedDate < today) return;  // ← blocks past booked clicks

  const status = getDateStatus(dateStr);
  if (status === "booked") {
    const booking = getBookingInfo(dateStr);
    if (booking?.requestId && onBookedDateClick) {
      onBookedDateClick(booking.requestId);
    }
    return;
  }
  ...
```

**After:**
```tsx
const handleDateClick = (day: number) => {
  const dateStr = formatDate(day);
  const today = new Date(); today.setHours(0,0,0,0);
  const clickedDate = new Date(year, month, day);
  const status = getDateStatus(dateStr);

  // Booked dates are always navigable — past or future
  if (status === "booked") {
    const booking = getBookingInfo(dateStr);
    if (booking?.requestId && onBookedDateClick) {
      onBookedDateClick(booking.requestId);
    }
    return;
  }

  if (clickedDate < today) return; // past non-booked dates: do nothing
  ...
```

Also update the tooltip content to distinguish past vs future booked dates:
```tsx
<p className="text-xs text-muted-foreground">
  {isPast ? "View Workspace →" : "Collaboration booked"}
</p>
```

The `isPast` variable for booked dates needs to be computed and passed through to the tooltip — this can be done inline using `new Date(year, month, day) < today`.

### Fix 2 — `Workspace.tsx` Admin Override

Add `useAdmin` import and create the merged gate:
```tsx
import { useAdmin } from "@/hooks/useAdmin";
...
const { isAdmin } = useAdmin();
const effectiveCanEdit = isAdmin || isHostPro;
```

Replace every occurrence of `isHostPro` used as an **access gate** with `effectiveCanEdit`:
- Line 481: `{isHostPro ? <WorkspaceConversation ...` → `{effectiveCanEdit ? ...`
- Line 502: The UpgradePrompt block — show only if `!effectiveCanEdit && !isGuest`
- Line 522: `canEdit={isHostPro}` → `canEdit={effectiveCanEdit}`

Note: `isHostPro` can still be used for non-gate purposes (like the Founding Member detection) if any exist — but in this file it's purely a gate.

### Fix 3 — `SharedWorkspace.tsx` Download Gate

The component already receives `canEdit`. Gate the download button:
```tsx
{hasContent && canEdit && (   // ← add `&& canEdit`
  <Button variant="ghost" size="sm" className="h-8" onClick={...}>
    <Download className="w-3.5 h-3.5 mr-1.5" />
    Download
  </Button>
)}
```

Free users (`canEdit = false`) simply won't see the Download button, which is the correct behavior. This eliminates the paradox entirely — no toast, no download, clean experience.
