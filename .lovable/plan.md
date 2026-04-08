# Action-First Requests Redesign + Dashboard Priority + MyRequests Fix

## Problem

1. **Requests page** defaults to "All" tab — users land on a wall of published/old collabs instead of seeing what needs action.
2. **Dashboard "Recent Requests"** shows the 5 most recent by `created_at` regardless of status — published collabs push pending ones out of view.
3. **MyRequests "Discover Creators" button** navigates to `/` (Landing page) instead of `/dashboard/discovery`. Empty state offers no creator suggestions.

## Changes

### 1. Requests Page — Default to "Pending" with Smart Fallback

**File: `src/pages/Requests.tsx**`

- Change `useState<FilterTab>("all")` to `useState<FilterTab>("pending")`.
- After requests load, if the pending count is 0, auto-switch to the first non-empty actionable tab in this priority: `approved` → `all`.
- Rename the section heading contextually: when on Pending tab, show "Needs Your Response" above the cards. When on Approved, show "Upcoming Collaborations". Other tabs keep the current generic heading.
- Update the empty state for Pending tab specifically: "You're all caught up! No pending requests." with a CTA button "Explore Discovery" linking to `/dashboard/discovery`.

### 2. Dashboard "Recent Requests" — Prioritize Actionable Items

**File: `src/pages/Dashboard.tsx**`

- Sort the `requests.slice(0, 5)` feed by action priority: pending first, then approved, then everything else — within each group, keep existing date/recency sort.
- Rename the section from "Recent Requests" to "Action Required" when there are pending items, keeping "Recent Requests" as fallback when no pending exist.
- When clicking a request row, navigate to `/dashboard/requests` with the appropriate tab pre-selected (e.g., `?tab=pending` if the request is pending).

### The "Lovable" Risk: Tab Flickering

The only place where this might feel "janky" is the auto-switch logic in `Requests.tsx`.

If Lovable implements a simple `useEffect` that checks the count and then switches the tab, the user might see the "Pending" empty state for a split second before it jumps to "Approved." It feels like the app is glitching.

**The Guardrail:** Tell Lovable to "Handle the initial tab state before the first render." Instead of switching *after* loading, it should determine the `defaultTab` based on the data payload as soon as it arrives.

### The URL Sync Win

Adding `?tab=` support is the most professional part of this plan. It means when you send a link to Edwin or Soribel to check a specific request, it will actually open the right view for them.

### Final Tweak for your Instruction

Add this one line to your prompt for Lovable:

> "For the Dashboard sort, ensure the 'Action Required' title only appears if there is at least one Pending request. If there are only Approved or Published items, stick to 'Recent Requests' to avoid sounding alarmist."

This keeps the tone "Natural" and not "Corporate Fluff."

### 3. MyRequests — Fix "Discover Creators" CTA + Show Suggested Creators

**File: `src/pages/MyRequests.tsx**`

- Change the empty state button from `navigate('/')` to `navigate('/dashboard/discovery')`.
- Below the empty state card, add a "Creators to Collaborate With" section that queries `public_creator_profiles` for 5 random active creators (excluding the current user), displaying their avatar, name, and a "View Profile" link to `/{username}`. This gives the page immediate value even when there are no sent requests.

### 4. Requests Page — Tab URL Sync

**File: `src/pages/Requests.tsx**`

- Read `?tab=` from search params on mount to allow deep-linking from Dashboard clicks.
- The highlight logic already handles `?highlight=` — add `tab` param support alongside it.

## Files Changed


| File                       | Change                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/pages/Requests.tsx`   | Default tab to pending, smart fallback, contextual headings, pending empty state CTA, `?tab=` param support |
| `src/pages/Dashboard.tsx`  | Sort request feed by action priority (pending first), contextual section title, deep-link to correct tab    |
| `src/pages/MyRequests.tsx` | Fix CTA to `/dashboard/discovery`, add 5 suggested creators in empty state                                  |
