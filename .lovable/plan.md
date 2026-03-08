

## Revert Stefania's collab status for testing

A single database migration to flip the status back to `approved` on request `5a05b9bc-c1e9-49ef-b85e-e2150f5b7044`. No content is erased.

### Migration SQL
```sql
UPDATE public.collab_requests
SET status = 'approved',
    collab_link = NULL,
    requester_collab_link = NULL
WHERE id = '5a05b9bc-c1e9-49ef-b85e-e2150f5b7044';
```

This resets: status → `approved`, clears the two post URL fields so the publish form appears fresh. All other data (shared_content, messages, etc.) stays intact.

### Also clear any existing metrics snapshot
```sql
DELETE FROM public.collab_metrics
WHERE request_id = '5a05b9bc-c1e9-49ef-b85e-e2150f5b7044';
```

This way when you re-publish and enter URLs, the metrics will be collected fresh.

### Files to change
- One database migration with the two statements above

