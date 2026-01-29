-- Add CHECK constraint to block Substack profile URLs in new requests
-- Using NOT VALID to avoid scanning existing rows
ALTER TABLE public.collab_requests 
ADD CONSTRAINT collab_requests_requester_url_no_profile 
CHECK (requester_substack_url IS NULL OR lower(requester_substack_url) NOT LIKE '%substack.com/@%') 
NOT VALID;