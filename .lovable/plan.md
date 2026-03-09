

## Root Cause

`fetchPostByUrl` is doing HTML scraping on `https://promptledproduct.substack.com/p/are-product-managers-the-new-developers` — but Substack pages are client-side rendered (JavaScript), so the raw HTML is empty. The regex patterns match nothing, returning 0 likes and 0 comments.

The real fix: Substack has a direct API endpoint:
```
GET https://{subdomain}.substack.com/api/v1/posts/{slug}
```

Which returns the actual post data including `"reactions":{"❤":47}` — already confirmed working via test fetch.

## Plan

**One file to change: `supabase/functions/fetch-collab-metrics/index.ts`**

Replace the current `fetchPostByUrl` function body with an API call instead of HTML scraping:

1. Extract subdomain from the post URL (e.g. `promptledproduct` from `promptledproduct.substack.com/p/...`)
2. Extract slug from the URL path (e.g. `are-product-managers-the-new-developers`)
3. Call `GET https://{subdomain}.substack.com/api/v1/posts/{slug}`
4. Parse the JSON response — `reactions` is `{"❤": 47}`, sum all values for total likes
5. Return the post object with the correct `reaction_count` and `comment_count`

The `getReactionCount` function already handles `reactions` as an object (summing emoji values), so that part works correctly. We just need to get the right data source.

```text
Old flow:  Manual URL → fetch HTML page → regex for reaction_count → returns 0 (JS rendered)
New flow:  Manual URL → extract subdomain + slug → /api/v1/posts/{slug} → real JSON data
```

This is a minimal, targeted fix — only the `fetchPostByUrl` function body changes.

