

# Fix: Discovery HTML Parser Fails — Switch to Substack Public API

## Root Cause

The edge function fetches `https://{subdomain}.substack.com/recommendations` and tries to parse HTML, but:
- There is **no `__NEXT_DATA__`** script tag — Substack renders this page entirely client-side via JavaScript
- The fallback regex expects markdown-formatted links `[text](url)` which don't exist in raw HTML
- Result: **always 0 recommendations parsed**, regardless of which publication URL is used

The second issue is that your database has `newsletter_url = productreleasenotes.substack.com` but your current publication is `promptledproduct.substack.com`. You need to update this in Settings manually.

## Solution

Switch the edge function to use Substack's **public JSON API** instead of HTML scraping:

### Step 1: Get the publication ID

```
GET https://substack.com/api/v1/publication/search?query={subdomain}
```
Returns JSON with `id` field (e.g., `1252952` for promptledproduct).

### Step 2: Get recommendations from the API

```
GET https://substack.com/api/v1/recommendations/from/{publication_id}
```
Returns a JSON array with full recommendation data: `subdomain`, `name`, `author.name`, `author.photo_url`, `hero_text` (description), `custom_domain`, etc.

### Edge Function Changes (`supabase/functions/fetch-substack-recommendations/index.ts`)

Replace the HTML fetch + parse logic with:

1. **Resolve subdomain to publication ID** using the search API
2. **Fetch recommendations** from `/api/v1/recommendations/from/{id}`
3. **Parse the JSON response** — each item has `recommendedPublication` with `subdomain`, `name`, `hero_text`, `logo_url`, `author.name`, `author.photo_url`
4. Keep existing upsert logic for `discovered_publications` and `creator_recommendations`
5. Keep existing cross-referencing with DraftKit creators
6. Remove all HTML parsing functions (`parseRecommendationsHtml`, `enrichWithDescriptions`)

### Discovery Page — No UI Changes Needed

The response shape stays the same (`{ recommendations: [...] }`), so the frontend doesn't need changes. The Refresh button fix from the previous iteration is already in place.

### What You Need to Do

Update your `newsletter_url` in Settings from `productreleasenotes.substack.com` to `promptledproduct.substack.com`, then click Refresh on the Discovery page.

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/fetch-substack-recommendations/index.ts` | Replace HTML scraping with Substack public API calls |

