

# Fix Broken Profile Images Across Requests and Creator Profiles

## The Problem

There are **two root causes** for broken images:

### 1. Corrupted Substack CDN URLs (affects ALL images)
Every stored URL — in both `creators.profile_image_url` and `collab_requests.requester_profile_image_url` — contains a malformed `$s_!...!` segment. For example:
```
https://substackcdn.com/image/fetch/$s_!6ZLU!,w_112,h_112,...
```
The `$s_!6ZLU!` is a Substack CDN signature token that gets corrupted during HTML scraping. This segment needs to be stripped for the URL to work. The valid URL format starts directly with the transform params like `w_112,h_112,...`.

### 2. Wrong images stored in `collab_requests` (newsletter cards instead of profile photos)
The `fetch-substack-profile` edge function's HTML scraping picks up `subscribe-card.jpg` (newsletter social cards) instead of actual profile photos for many requesters. Examples from DB:
- Stefania Barabas → `stefsdevnotes.substack.com/twitter/subscribe-card.jpg` (wrong)
- Anna Levitt → `howtobossai.substack.com/twitter/subscribe-card.jpg` (wrong)
- Raghav Mehra → `cashandcache.substack.com/twitter/subscribe-card.jpg` (wrong)

The `isValidProfileImage` filter blocks `subscribe-card` but only in lowercase — the actual URLs pass through.

## The Fix

### Step 1: Fix the URL sanitization (runtime fix for all images)
Create a utility function that strips the corrupted `$s_!...!` segment from any Substack CDN URL before rendering. Apply it in:
- `RequestCard.tsx` — where requester avatars render
- `Dashboard.tsx` — where request avatars render on the dashboard
- `CollabCalendar.tsx` — where booking avatars render
- `Workspace.tsx` — where partner avatars render
- `MyRequests.tsx` — where creator avatars render

The function:
```typescript
export function sanitizeSubstackImageUrl(url: string): string {
  // Strip the corrupted $s_!...! CDN signature token
  return url.replace(/\$s_![^!]*!,?/, '');
}
```

### Step 2: Fix the `fetch-substack-profile` edge function
- Make the `subscribe-card` filter case-insensitive (it currently misses matches)
- Add `twitter/subscribe-card` as an explicit blocked pattern
- This prevents future requests from storing wrong images

### Step 3: Fix the signup flow profile image storage
In `Signup.tsx`, sanitize the URL returned by `fetch-substack-profile` before storing it in the database, so new creators get clean URLs.

### Step 4: Database cleanup (one-time migration)
Run a SQL update to:
1. Strip the `$s_!...!` segment from all existing URLs in both `creators.profile_image_url` and `collab_requests.requester_profile_image_url`
2. NULL out any `collab_requests.requester_profile_image_url` values that contain `subscribe-card` (these are newsletter cards, not profile photos)

## Files Changed

| File | Change |
|------|--------|
| `src/lib/utils.ts` | Add `sanitizeSubstackImageUrl` utility |
| `src/components/requests/RequestCard.tsx` | Sanitize image URL before rendering |
| `src/pages/Dashboard.tsx` | Sanitize image URL before rendering |
| `src/components/calendar/CollabCalendar.tsx` | Sanitize image URL before rendering |
| `src/pages/Workspace.tsx` | Sanitize image URL before rendering |
| `src/pages/MyRequests.tsx` | Sanitize image URL before rendering |
| `supabase/functions/fetch-substack-profile/index.ts` | Fix case-insensitive subscribe-card filter, sanitize output URL |
| `src/pages/Signup.tsx` | Sanitize profile image URL before DB insert |
| `src/pages/PublicBooking.tsx` | Sanitize profile image URL before DB insert |
| Migration SQL | Clean up all corrupted URLs in DB |

