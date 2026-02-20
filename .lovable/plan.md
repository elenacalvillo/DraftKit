## Protecting the Workspace: Hard Gate for Non-Pro Creators

### What is Actually Happening Now

The workspace page currently uses a "soft lock" model:

- Free-tier creators CAN navigate into `/dashboard/workspace/:id`
- They see the full page layout — partner info, conversation panel, the shared doc
- They just cannot edit (the pencil button is hidden, the doc shows a lock icon)
- There is NO hard redirect or block screen for non-Pro creators

This means a new creator who signs up today, gets a collab request, accepts it, and clicks "Open Workspace" will land inside your Pro feature with full visibility — just unable to type. That is the leak you want closed.

### What Needs to Change

The fix is a **hard gate** added to `Workspace.tsx` that runs after the request is loaded and all Pro status hooks have resolved. The logic:

```
Is the current user the CREATOR (host)?
  → Yes: Are they Pro (or Admin)?
      → No: Show hard upgrade wall. Block all workspace content.
      → Yes: Proceed normally.
  → No (they are the GUEST/requester):
      → Is the HOST Pro?
          → No: Show "workspace coming soon" neutral message (no billing CTA for guests).
          → Yes: Proceed normally.
```

This replaces the current soft-lock behavior with a real wall for free creators, while preserving the "Host-Pays" model for guests.

### The Upgrade Wall UI

For a free-tier creator (host) trying to access the workspace, instead of the full workspace layout, they will see a focused, high-quality upgrade screen:

- Large lock icon or crown icon
- "The Shared Workspace is a Pro Feature" headline  
- A short value prop sentence (async drafting, conversation history, etc.)
- A prominent "Upgrade to Pro" button → navigates to `/dashboard/subscription`
- A softer "Back to Requests" link

This is rendered inside the existing `DashboardLayout` (no zen mode), so it feels intentional and polished, not like an error.

### Existing "Guest Neutral" State

For guests of free hosts, the current neutral message inside the conversation panel is already correct. We will expand this to the full page — if `isGuest` is true and `isHostPro` is false, the user sees a simple "Your collaboration partner hasn't unlocked the workspace yet" message with a "Message Partner" button as the only action.

### Technical Details

**File: `src/pages/Workspace.tsx**`

After the loading/notFound/status guards (around line 296), add a new Pro gate block:

```typescript
// --- PRO GATE ---
// Wait for both the request and the host Pro status to resolve before gating.
// isHostPro comes from useCreatorPro(request?.creator_id) which is async.
// Only gate once we know for sure (isLoading from useCreatorPro must be false).
const { isPro: isHostPro, isLoading: isHostProLoading } = useCreatorPro(request?.creator_id);

// Show loading skeleton while Pro status resolves (prevents flash of wrong content)
if (isHostProLoading) return <LoadingState />;

// Hard gate: creator (host) is free tier
if (isCreator && !effectiveCanEdit) {
  return (
    <DashboardLayout>
      <UpgradeWall /> // "Workspace is Pro" screen with Upgrade button
    </DashboardLayout>
  );
}

// Hard gate: guest, but host is free tier
if (isGuest && !isHostPro && !isAdmin) {
  return (
    <DashboardLayout>
      <GuestWaitingScreen /> // "Your partner hasn't unlocked the workspace yet"
    </DashboardLayout>
  );
}
```

Note: `useCreatorPro` already returns `isLoading` — we just need to use it to prevent a flash before showing the gate.

### What Does NOT Change

- Founders and early adopters (Pro via `user_roles`) are not affected — `useCreatorPro` already checks `has_role` as a fallback
- Admins bypass all gates via `effectiveCanEdit = isAdmin || isHostPro`
- The database RLS policies do not change — the gate is purely at the UI routing level
- Guests of Pro hosts continue to get full access with no billing CTAs

### Files Changed


| File                      | Change                                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/Workspace.tsx` | Add hard Pro gate after status check — free creator sees upgrade wall, guest of free host sees neutral waiting screen. Also use `isLoading` from `useCreatorPro` to prevent flash. |


No database changes. No new dependencies. No edge function changes.

**One thing to watch for:**

Make sure the **"Upgrade to Pro"** button on that wall is punchy. Don't just say "Upgrade." Use something aligned with your brand like: **"Unlock the Workspace & Start Shipping."**