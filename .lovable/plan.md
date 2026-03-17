

# Fix Missing Profile Images - Full Durable Fix

## Root Cause

15 of 18 collab requests have `requester_profile_image_url = NULL`. The previous sanitization fix only cleaned URLs that already existed -- it did nothing for the majority of requests that never had an image stored. The `fetch-substack-profile` edge function either wasn't called at booking time (early requests) or returned nothing.

The good news: many of these requesters are registered creators with valid `profile_image_url` in the `creators` table. We can use this as a fallback.

## Plan

### 1. UI Fallback: Resolve requester image from their creator profile

When rendering requester avatars, if `requester_profile_image_url` is null but `requester_user_id` is set, look up the requester's creator profile image instead.

**Where to apply:**
- **`Requests.tsx`** -- fetches `collab_requests` for RequestCard display. Join with creators table to get the requester's creator profile image as fallback.
- **`Dashboard.tsx`** -- same pattern for the recent requests list.
- **`Workspace.tsx`** -- already fetches creator info for the partner sidebar, just needs to also check the requester's creator profile image.
- **`CollabCalendar.tsx`** -- receives booking details from parent, so the parent must pass the resolved image.

**Implementation approach:** After fetching requests, for any request where `requester_profile_image_url` is null AND `requester_user_id` is not null, do a single batch query to `public_creator_profiles` to get their `profile_image_url` and merge it in. This avoids N+1 queries.

### 2. Database Backfill: Populate missing `requester_profile_image_url` from creators table

Run a one-time SQL update to copy `profile_image_url` from `creators` to `collab_requests.requester_profile_image_url` where:
- The request has `requester_user_id` matching a creator's `user_id`
- The request's `requester_profile_image_url` is currently NULL
- The creator has a non-null `profile_image_url`

```sql
UPDATE collab_requests cr
SET requester_profile_image_url = c.profile_image_url
FROM creators c
WHERE cr.requester_user_id = c.user_id
  AND cr.requester_profile_image_url IS NULL
  AND c.profile_image_url IS NOT NULL;
```

### 3. Settings.tsx: Fix image not being sanitized before save

The `Settings.tsx` `autoFetchProfileImage` and `handleSave` functions store the raw image URL from `fetch-substack-profile` without sanitizing it. Apply `sanitizeSubstackImageUrl` before saving to the database.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Requests.tsx` | After fetching requests, batch-resolve missing images from `public_creator_profiles` |
| `src/pages/Dashboard.tsx` | Same batch-resolve pattern for recent requests |
| `src/pages/Workspace.tsx` | Resolve partner image from creator profile when request image is null |
| `src/pages/Settings.tsx` | Sanitize image URL before saving to DB |
| Migration SQL (data update) | Backfill `requester_profile_image_url` from `creators.profile_image_url` |

