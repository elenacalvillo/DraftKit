-- Add collab_link column to store external collaboration document URLs
ALTER TABLE collab_requests
ADD COLUMN collab_link text;