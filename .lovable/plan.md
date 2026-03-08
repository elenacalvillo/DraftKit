
## Explain the Issue & Approach

You are completely right on both fronts! 

1. **The Blocked UI:** We need to clear your previous "Published = yes" answer from the `user_feedback` table. Because that record still exists, the workspace skips the retrospective prompt and assumes you've already answered it. 
2. **The Missing URL Inputs:** Relying purely on date-based matching for Substack posts is brittle if too much time has passed or if the titles don't perfectly match. Allowing users to explicitly set/update the exact post URLs directly in the **Collab Impact** card is a much more robust solution. 

### What needs to be done

I will perform the database cleanup and then implement the new UI for manual URL submission.

**1. Database Cleanup**
- I will execute a data operation to delete the lingering feedback record so your Workspace UI resets:
  ```sql
  DELETE FROM public.user_feedback
  WHERE page_url = '/dashboard/workspace/5a05b9bc-c1e9-49ef-b85e-e2150f5b7044';
  ```

**2. Implement Manual URL Inputs in the Impact Card**
- **`src/hooks/useCollabMetrics.ts`**: Add a new query to fetch the current URLs (`collab_link`, `requester_collab_link`) from the `collab_requests` table, and a mutation to update them.
- **`src/components/requests/CollabImpactCard.tsx`**: 
  - Add input fields for "Host Post URL" and "Guest Post URL".
  - If no metrics are collected yet, show these fields prominently above the "Collect engagement data" button.
  - If metrics already exist, add a small "Edit Post URLs" toggle so users can correct them if the automatic matcher found the wrong post.
  - When you click "Collect engagement data", it will first save any URLs you've typed in, ensuring the data collection edge function uses the exact links you provided.

Once you approve, I'll clear the database state and build out the URL input fields!
