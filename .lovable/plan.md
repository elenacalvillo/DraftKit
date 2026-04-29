## What's happening

Dinah's 3 messages on workspace `50a88ca4...` exist in the database and are correctly accessible under RLS — I verified the rows are there and the policies on `collaboration_messages` resolve correctly for the workspace creator. The bug is **on the client**, not in the recent security migrations.

## Root cause

`src/components/requests/WorkspaceConversation.tsx` runs its `useQuery` for messages with no auth gate:

```ts
const { data: messages = [] } = useQuery({
  queryKey: ["workspace-messages", requestId, refreshKey],
  queryFn: async () => { /* supabase.from("collaboration_messages")... */ },
});
```

Two problems combine:

1. **No `enabled` guard on `user`.** When the workspace page mounts, this query can fire before Supabase has attached the JWT to outgoing requests. The query goes out as `anon`, RLS evaluates `auth.uid() = NULL`, the subquery returns no request IDs, and the result is `[]`.
2. **Stale empty result is cached.** `queryKey` doesn't include `user?.id`, so when auth finishes initializing the query is never invalidated. React Query keeps serving the cached empty array, which is why the conversation "loads forever then says no conversations."

This explains all three symptoms Dinah reported:
- Messages exist but show as missing
- The conversation widget hangs (initial loading skeleton) then flips to "No messages yet"
- Restricted-workspace blocking still works (that uses the SECURITY DEFINER RPC, which is unaffected)

The recent security hardening did not delete or break the message data — the RLS policies on `collaboration_messages` are still correct.

## The fix

Update `src/components/requests/WorkspaceConversation.tsx`:

1. Pull `user` from `useAuth()`.
2. Add `user?.id` to the `queryKey` so the query refetches when auth resolves.
3. Add `enabled: !!user && !!requestId` so it only runs once we have an authenticated session.

That's the entire change — one file, ~5 lines. No database migration, no policy changes.

```text
WorkspaceConversation
├─ const { user } = useAuth()
├─ queryKey: ["workspace-messages", requestId, user?.id, refreshKey]
└─ enabled: !!user && !!requestId
```

## Why this is the right fix (not a database change)

- Verified in DB: 3 messages present for request `50a88ca4...`, creator/requester IDs match the participants.
- Verified RLS: `Creators can view messages for their requests` policy resolves `request_id` → `creators.user_id = auth.uid()` correctly for Dinah.
- The Workspace page's main `fetchRequest` works because it calls a `SECURITY DEFINER` RPC that doesn't need RLS-time `auth.uid()` to be set in the same window — but it still gates on `user` in its `useEffect`. The conversation widget is the only fetch path that lacks that guard.

## Files changed

- `src/components/requests/WorkspaceConversation.tsx` — add auth gate + include `user?.id` in queryKey.

No migrations, no security findings touched.
