# Fix: Privacy-First Writer's Room Member List

## Problems

1. **Email leak**: Collaborators invited via profile search show their raw email instead of their name (e.g., "[kjsmiley@ieee.org](mailto:kjsmiley@ieee.org)" instead of "Karen Smiley")
2. **No profile images**: Avatar circles show email initials, not actual profile photos
3. **No guest labeling**: Email-only invites (no account) should show "Guest 1", "Guest 2" — not their email
4. **No collaborator limit**: Free accounts can invite unlimited collaborators

## Solution

### 1. Enrich the hook (`useWorkspaceCollaborators.ts`)

Join `workspace_collaborators` with `creators` (via `user_id`) to fetch `name`, `username`, and `profile_image_url` for collaborators who have accounts. The query becomes a left join — collaborators without accounts get null for these fields.

Since Supabase JS client can't do arbitrary joins without foreign keys, we'll query collaborators first, then batch-fetch creator profiles for those with `user_id` values from `public_creator_profiles`.

### 2. Update the display logic (`Workspace.tsx`, lines 966-979)

- **Has `user_id` + name**: Show their real name and profile image
- **No `user_id` (email-only invite)**: Show "Guest 1", "Guest 2", etc. (numbered by invite order)
  Careful: There is one potential snag with the "Guest N" logic. If you have three guests (Guest 1, 2, 3) and Guest 1 signs up to become "Karen Smiley," make sure the numbering doesn't shift for the others. If Guest 2 suddenly becomes Guest 1, it will be confusing for the owner.
  Ensure the numbering is tied to the **Invite ID** or a fixed index in the array so the labels stay consistent until they sign up.
- **Hover tooltip**: Show email on hover for the workspace owner only, using the existing Tooltip component
- **Profile images**: Use Avatar component with the fetched `profile_image_url`

### 3. Cap free-tier collaborators

In the invite button visibility check (line 935), add a limit: free accounts can invite max 5 collaborators per workspace. Show "Go Unlimited" prompt when limit is hit.

## Files to Change


| File                                     | Change                                                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useWorkspaceCollaborators.ts` | Enrich collaborator data by fetching name/profile_image_url from `public_creator_profiles` for collaborators with `user_id`                          |
| `src/pages/Workspace.tsx`                | Update Writer's Room member list: show name (not email), use Avatar for images, add Tooltip for email on hover, add 5-collaborator cap for free tier |


## Display Rules

```text
Collaborator has user_id?
  YES → Show: [profile_image] [Full Name]  [Joined/Pending badge]
         Hover: tooltip with @username
  NO  → Show: [generic avatar] [Guest N]   [Pending badge]
         Hover: tooltip with email (owner only)

When guest signs up → link_requests_to_new_user trigger fills user_id
                    → next refetch shows their real name automatically
```

## Free Tier Limit

- Max 5 email-only invites per workspace for free accounts
- Profile-based invites (user already on DraftKit) count toward the same limit
- Pro users: unlimited
- When limit hit: hide Invite button, show "Go Unlimited for more collaborators"