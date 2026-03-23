

# Sync Dashboard Metric Cards

## Problem
The "Collaborator Reach" card counts all unique requester URLs (7), but "Time Saved" only counts published collabs (3). This makes the cards look disconnected — users expect the numbers to tell a coherent story.

## Changes

### `src/pages/Dashboard.tsx`

**Collaborator Reach card** (lines 158-165):
- Change the count logic from "unique requester URLs across all requests" to "unique requester URLs from published requests only"
- Change label from "Collaborator Reach" to "Published Collabs"
- Change sub-label from "Unique audiences reached" to "Unique audiences you've shipped with"
- Update the display to show count + "Collab"/"Collabs" instead of "Newsletter"/"Newsletters"
- Update empty tip accordingly

```typescript
// Published Collabs: unique requester_substack_url from published requests
const uniquePublishedUrls = new Set(
  requests
    .filter((r) => r.status === "published" && r.requester_substack_url)
    .map((r) => r.requester_substack_url!.trim().toLowerCase())
);
const publishedReach = uniquePublishedUrls.size;
const reachDisplay = `${publishedReach} ${publishedReach === 1 ? "Collab" : "Collabs"}`;
```

**Ship Rate card**: Keep as-is (43% is the funnel efficiency metric — it complements the other two cards).

This way all three cards tell a consistent story:
- **Ship Rate**: What % of your pipeline converts
- **Published Collabs**: How many unique audiences you've shipped with
- **Time Saved**: Hours saved from those published collabs

