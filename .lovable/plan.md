

## Research: Can we get Substack growth metrics?

### Short answer: Not subscriber counts, but we CAN track post engagement

**Substack does NOT expose subscriber/follower counts publicly.** There is no public API for it. The only way to get subscriber data is through:
1. **Substack Publisher API** — requires each creator's own API key (from their Substack dashboard). This is a private, authenticated API.
2. **Third-party scrapers** (Apify, etc.) — paid services that estimate counts, unreliable.

### What IS publicly available (no auth needed)

Substack exposes an undocumented archive API at `username.substack.com/api/v1/archive?sort=new&limit=12` that returns recent posts with:
- **Likes/reactions count** per post
- **Comment count** per post  
- Post title, date, URL, subtitle

### What we could build

**Collab Post Performance Tracker** — after a collab is marked "published", we snapshot engagement metrics on both newsletters' most recent posts and then re-check periodically:

1. When a collab is marked "published", store the `collab_link` URL and both publication URLs
2. Create an edge function that fetches `/api/v1/archive` for both publications and finds the collab post by matching the date or URL
3. Store snapshots: likes + comments at publish time, then at day 1, 3, 7
4. Show a "Collab Impact" card on the published workspace with engagement growth

**Limitations to be upfront about:**
- No subscriber growth data without each creator connecting their Substack Publisher API key
- Engagement metrics (likes/comments) are the best proxy we have
- The archive API is undocumented and could change

### Recommendation

Start with engagement tracking (likes + comments on the collab post over time) since it requires zero setup from users. Later, we could add an optional "Connect your Substack" flow where creators paste their Publisher API key to unlock subscriber growth charts.

### Files to create/modify
- New DB table: `collab_metrics` (request_id, snapshot_date, creator_likes, creator_comments, requester_likes, requester_comments)
- New edge function: `fetch-collab-metrics/index.ts` — fetches archive API for both publications
- Update `src/components/requests/RequestCard.tsx` — add "Collab Impact" section for published collabs
- Cron job to re-snapshot metrics at day 1, 3, 7

Want me to proceed with the engagement tracking approach, or would you prefer to wait and explore the Publisher API key integration first?

