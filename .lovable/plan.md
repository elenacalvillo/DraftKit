

## Plan: Fix metrics fetch + rename button labels

### Problem
1. **Wrong/missing metrics**: The saved URL `are-product-managers-the-new-developers` is older than the 12 most recent posts, so it's not found in the archive. Strict mode correctly returns null, but the edge function should **directly fetch** the specific post when it has a manual URL.
2. **Button label**: "Open External Document" should say "See Live Post" for published collabs, keep current wording for approved status.

### Changes

#### 1. Edge function: `supabase/functions/fetch-collab-metrics/index.ts`

Add a new `fetchPostByUrl(url)` function that fetches a specific Substack post page and extracts reaction_count and comment_count from the page's JSON metadata (Substack embeds post data as JSON-LD or in `window._preloads`).

Update the main processing logic:
- When a manual URL is provided (`collab_link` or `requester_collab_link`), first try matching by slug in the archive (current behavior)
- **NEW**: If slug match fails, call `fetchPostByUrl(manualUrl)` to directly scrape that specific post's metrics
- For the requester side without a URL: use date-based matching but never fall back to "most recent post"

Also increase archive limit from 12 to 30 to catch more posts.

#### 2. UI label: `src/pages/Workspace.tsx` (line 932)

Change "Open External Document" to:
- "See Live Post" when `request.status === 'published'`
- Keep "Open External Document" otherwise (approved status)

#### 3. UI label: `src/pages/MyRequests.tsx` (line 354)

Same conditional logic: "See Live Post" for published, "Open External Document" for approved.

### Technical detail: Direct post fetching

```text
fetchPostByUrl("https://promptledproduct.substack.com/p/are-product-managers-the-new-developers")
  → GET the URL, extract JSON from page
  → Return { reaction_count, comment_count, canonical_url, title }
```

Substack post pages contain structured data we can parse. We'll look for:
- The `<script type="application/ld+json">` block, or
- Regex for `"reaction_count":N` and `"comment_count":N` in the page HTML

This ensures that even very old posts are correctly measured when a user provides the exact URL.

