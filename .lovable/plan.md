
# Workspace Access Refactor: Host-Pays Model

The core insight from Dinah's feedback is correct: the workspace is a room the **host** (Pro creator) pays for. The **guest** (requester) should never hit a paywall just to collaborate inside it.

## What Is Broken Today

In `src/pages/Workspace.tsx`:

- `const { isPro } = usePro()` checks the **current logged-in user's** Pro status
- `canEdit={isPro}` — so if the guest (Raghav) is a free user, the editor is locked
- `{isPro ? <WorkspaceConversation /> : <UpgradePrompt />}` — same broken gate hides the conversation from the guest

This means when Raghav opens the workspace, he sees a blurred "Upgrade to Pro" wall even though Dinah (the host) already paid for it.

## The Fix: Fetch the Host's Pro Status

### New hook: `useCreatorPro(creatorUserId)`

Create a small, focused query hook that checks whether a specific creator (identified by their `user_id`) has Pro access. This is used by the workspace to resolve the **host's** tier, not the current visitor's.

It queries the `creators` table (readable by anyone when `username IS NOT NULL`) and the `has_role` RPC — but targeted at the host's `user_id`, which comes from the `creator_id` on the request combined with the creator's `user_id`.

Since `public_creator_profiles` doesn't expose `user_id` or `subscription_tier`, the host's Pro status will be determined by fetching from `creators` using the creator's `id` joined to `user_id`. The existing RLS on `creators` already allows: `SELECT` where `username IS NOT NULL` (the public policy). The `subscription_tier` and `trial_ends_at` columns are exposed under that public policy.

### Logic Change in `Workspace.tsx`

| Before | After |
|--------|-------|
| `canEdit={isPro}` (current user's Pro) | `canEdit={isHostPro}` (host's Pro status) |
| `{isPro ? <Conversation /> : <UpgradePrompt />}` | `{isHostPro ? <Conversation /> : <UpgradePrompt for creator only />}` |
| UpgradePrompt shown to guests | UpgradePrompt shown **only** to the creator if host is free |

### Guest Experience Changes

When `isGuest === true`:
- Never show any `UpgradePrompt` — guests are there to collaborate, not subscribe
- The conversation feed is visible if the **host** is Pro
- The editor is unlocked if the **host** is Pro
- No billing CTAs, no Crown icons, no "Upgrade to Pro" banners in the guest view

### Creator Experience (Unchanged)

If the host is **free tier** (not Pro), they still see the upgrade prompts encouraging them to unlock the workspace for their collaborator. This is actually a stronger conversion trigger: "Your collaborator is waiting — upgrade to open the workspace."

## Files Changed

### 1. New file: `src/hooks/useCreatorPro.ts`

A targeted hook that accepts a `creatorId` (the UUID from `collab_requests.creator_id`) and resolves their Pro status by:
1. Fetching their `user_id` from the `creators` table using `id`
2. Checking `subscription_tier`, `trial_ends_at`, and calling `has_role` RPC with that `user_id`

### 2. `src/pages/Workspace.tsx`

- Import `useCreatorPro` and call it once `creatorInfo` is loaded: `const { isPro: isHostPro } = useCreatorPro(request?.creator_id)`
- Replace every `isPro` gate that controls workspace features with `isHostPro`
- Wrap all `UpgradePrompt` renders with `{!isGuest && ...}` so guests never see billing walls
- Keep `isPro` (the current user's own Pro status) available for future creator-only features like "Generate AI Draft" (which already guards with `isCreator &&`)

## Summary

The workspace "unlocked" state is determined entirely by whether the **host creator** has a Pro subscription. Guests inherit the host's access level — they can read and write if the host is Pro, and they see a "workspace coming soon" message (not an upgrade button) if the host is free. The creator themselves still sees the upgrade prompt if they are free, giving a clear, motivating path to convert.

No database migrations needed. No new edge functions. The `creators` table is already readable publicly (where `username IS NOT NULL`), so the host's `subscription_tier` can be fetched from the client safely.
