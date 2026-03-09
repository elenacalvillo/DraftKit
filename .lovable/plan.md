

## Issue Analysis

The problem is in the `fetch-collab-metrics` edge function. When a user manually provides a post URL, the system should **strictly** use that exact URL and never fall back to date-based matching or other heuristics.

Currently, the `findCollabPost` function (lines 160-191):
1. Tries to match by slug from the manual URL
2. If that fails, falls back to date proximity matching  
3. Falls back to the most recent post

This causes the wrong post to be fetched when:
- The manual URL is provided
- But the exact post isn't in the 12 most recent posts from the archive API
- So it falls back to date matching and grabs a different post

## Solution

Modify the `fetch-collab-metrics` edge function to:

1. **Strict URL matching**: If a manual URL (`collab_link` or `requester_collab_link`) is provided, ONLY accept an exact slug match - never fall back to date matching
2. **Direct fetch fallback**: If we have a manual URL but can't find the post in the archive (maybe it's not in the 12 most recent), try fetching that specific post URL directly to extract metrics
3. **Fail gracefully**: If we can't find the exact post from a manual URL, return null metrics rather than guessing with a wrong post

## Implementation

**File: `supabase/functions/fetch-collab-metrics/index.ts`**

Changes needed:
- Modify `findCollabPost` to accept a `strictMode` parameter
- When `strictMode` is true (manual URL provided), skip all fallbacks
- Add a new function `fetchPostDirectly(url)` to fetch metrics from a specific post URL when it's not in the archive
- Update the main logic to use strict mode when manual URLs are provided

This ensures:
- Manual URLs are always trusted over automatic matching
- Wrong posts are never fetched when a specific URL is given
- The system fails gracefully (null metrics) rather than showing incorrect data

