

## Add Subscriber Reach to Collab Impact

### What it does
Show each publication's subscriber count alongside likes/comments so users can see how many subscribers they reached through the collaboration. For example: "Elena Calvillo — 2,400 subscribers • 47 likes • 32 comments".

### How

#### 1. Database: Add subscriber columns to `collab_metrics`
New migration adding two nullable integer columns:
- `creator_subscribers`
- `requester_subscribers`

#### 2. Edge function: Fetch subscriber counts
Substack exposes publication metadata via `https://substack.com/api/v1/publication/search?query={name}`. We can also try the direct endpoint pattern. The edge function will:
- Extract the subdomain from each post URL (already done)
- Call `https://{subdomain}.substack.com` and parse the page's JSON metadata for `"subscribers"` or `"subscriberCount"`, OR use the publication search API
- Store the count in the new columns

Since subscriber counts aren't reliably available via a single clean API, a more robust approach: fetch the publication's homepage HTML which embeds a JSON blob containing `"subscriber_count"` or similar fields in Substack's preloaded data.

#### 3. UI: Display subscriber reach in CollabImpactCard
- Add a `Users` icon pill showing subscriber count per publication
- Show combined reach as a summary line: "Combined reach: ~X subscribers"
- Only show when data is available (nullable columns)

### Technical detail

```text
Edge function flow:
1. Already have subdomain from post URL
2. GET https://{subdomain}.substack.com → HTML contains window._preloads or JSON-LD
3. Regex for "subscriber_count":N or "freeSubscriberCount":N  
4. Store in creator_subscribers / requester_subscribers columns
```

Fallback: If HTML scraping fails (same CSR issue), we can try `https://substack.com/api/v1/publication/search?query={subdomain}` which returns subscriber counts in search results.

### Files to change
- **Migration**: Add `creator_subscribers` and `requester_subscribers` to `collab_metrics`
- **`supabase/functions/fetch-collab-metrics/index.ts`**: Add `fetchPublicationSubscribers(subdomain)` function, store results
- **`src/hooks/useCollabMetrics.ts`**: Add new fields to `CollabMetric` interface
- **`src/components/requests/CollabImpactCard.tsx`**: Display subscriber counts with Users icon

