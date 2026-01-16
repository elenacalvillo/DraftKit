-- Add reminder_days_before column to creators table (default 3 days)
ALTER TABLE public.creators 
ADD COLUMN reminder_days_before INTEGER DEFAULT 3;

-- Update all existing creators to have the default value
UPDATE public.creators SET reminder_days_before = 3 WHERE reminder_days_before IS NULL;

-- Add reminder_sent_at column to collab_requests table to prevent duplicate reminders
ALTER TABLE public.collab_requests 
ADD COLUMN reminder_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;