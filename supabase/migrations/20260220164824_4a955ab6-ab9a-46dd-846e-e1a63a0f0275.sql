-- Drop the restrictive status check constraint and replace with one that includes 'published'
ALTER TABLE public.collab_requests DROP CONSTRAINT collab_requests_status_check;

ALTER TABLE public.collab_requests 
ADD CONSTRAINT collab_requests_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'cancelled'::text, 'published'::text]));