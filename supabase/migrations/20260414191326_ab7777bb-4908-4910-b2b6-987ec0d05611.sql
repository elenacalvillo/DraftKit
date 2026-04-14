ALTER TABLE public.collab_requests
ADD COLUMN is_solo boolean NOT NULL DEFAULT false;