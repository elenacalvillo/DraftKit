-- Make requested_date nullable to allow flexible date requests
ALTER TABLE collab_requests 
ALTER COLUMN requested_date DROP NOT NULL;