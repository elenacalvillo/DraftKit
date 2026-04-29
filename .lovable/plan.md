## Plan

I found two important facts in the current backend state:

1. The `creators` table currently has only one live `SELECT` policy: `Creators can view own profile` with `auth.uid() = user_id`.
2. The remaining real issue is `collab_requests`: collaborators still have full-row `SELECT` access through `Collaborators can view invited requests`, which exposes `requester_email`, `requester_name`, and `requester_profile_image_url`.

So the scanner is not entirely wrong, but it is mixing one verified-safe area with one still-open exposure.

## What I will change

### 1. Re-verify and harden creator billing privacy
- Add one cleanup migration that explicitly drops any legacy public-read creator policies if they still exist:
  - `Public can read public creator columns`
  - `Public profile columns readable`
  - any other known legacy broad public creator read policy found in prior migrations
- Leave `creators` with owner-only row access for `SELECT`.
- Preserve public profile browsing through `public_creator_profiles` only.
- Re-run the security scan and mark `creators_stripe_ids_public` fixed if the backend confirms there is no public `SELECT` path on `creators`.

### 2. Remove collaborator access to private requester fields
- Create a safe collaborator-facing projection for workspace request data, either as:
  - a dedicated view for collaborator reads, or
  - a split-fetch pattern using existing safe sources plus a new view/RPC if needed.
- Recommended implementation:
  - keep `collab_requests` row `SELECT` limited to creator/requester only
  - remove `Collaborators can view invited requests`
  - add a collaborator-safe view exposing only workspace-safe columns such as:
    - `id`
    - `creator_id`
    - `status`
    - `shared_content`
    - `content_last_edited_by`
    - `content_last_edited_at`
    - `selected_collab_type`
    - `is_solo`
    - `message` only if it is intentionally considered workspace-visible
    - `requested_date` only if collaborators are meant to see scheduling
  - exclude PII and sensitive fields:
    - `requester_email`
    - `requester_name`
    - `requester_profile_image_url`
    - `requester_substack_url`
    - `requester_collab_link`
    - `creator_notes`
    - `view_token`
    - retrospective fields
- If the workspace UI still needs a display name/avatar for collaborators, source those from non-sensitive public profile data or show neutral guest labels instead of raw requester identity.

### 3. Keep collaborator edit access narrow and explicit
- Keep the existing trigger-based protection, but tighten it further so collaborator writes are aligned with the intended safe set.
- Update the trigger so collaborators can only change:
  - `shared_content`
  - `content_last_edited_at`
  - `content_last_edited_by`
  - `editing_sessions` if the editor needs it
- Explicitly block changes to all other fields, including `first_draft_generated_at` unless collaborators truly need to set it.
- This removes ambiguity between the broad RLS update policy and the actual allowed write surface.

### 4. Update the frontend to use the safe read path
- Refactor `src/pages/Workspace.tsx` so collaborator users do not fetch `select('*')` from `collab_requests`.
- Refactor `src/hooks/useWorkspaceCollaborators.ts` so it does not rely on direct reads from private creator data unless the current user is allowed to do so.
- Remove collaborator-visible email actions from the workspace UI when the viewer is neither the creator nor the requester.
- Ensure creator and requester experiences remain unchanged.

## Technical details

### Current state confirmed
- `creators` policies in the live database:
  - `Creators can view own profile` only for `SELECT`
- `collab_requests` still has:
  - `Collaborators can view invited requests` for full-row `SELECT`
- `public_creator_profiles` currently exposes only safe profile fields and does not include Stripe IDs.

### Migration shape
```text
1. DROP legacy creator public SELECT policies if present
2. DROP collaborator full-row SELECT policy on collab_requests
3. CREATE collaborator-safe request view or equivalent safe read layer
4. GRANT access to that safe layer
5. Tighten collaborator update trigger to exact allowed columns
```

### Files likely to change
- `supabase/migrations/<new_security_fix>.sql`
- `src/pages/Workspace.tsx`
- `src/hooks/useWorkspaceCollaborators.ts`
- possibly `src/components/requests/InviteCollaboratorModal.tsx` if any collaborator identity assumptions need cleanup

## Expected outcome
- The `creators_stripe_ids_public` warning should be resolved by explicit policy cleanup plus re-verification.
- The `collab_requests_requester_email_exposure` warning should be resolved by removing collaborator full-row reads and replacing them with a safe projection.
- Workspace editing should continue working for collaborators without exposing requester email or other private identity fields.

## Validation after implementation
- Re-check live policies on `creators` and `collab_requests`
- Re-run the security scan
- Mark fixed findings only after the scan confirms the issues are gone