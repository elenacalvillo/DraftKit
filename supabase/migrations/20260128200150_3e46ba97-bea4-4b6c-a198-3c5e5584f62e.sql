-- Create email_events table to log sent emails and prevent duplicates
CREATE TABLE public.email_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL,
  type TEXT NOT NULL,
  to_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
);

-- Add index for efficient duplicate checking
CREATE INDEX idx_email_events_dedup ON public.email_events (request_id, type, to_email, created_at DESC);

-- Enable RLS
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (no user-facing policies needed)
-- Edge functions use service role, so no explicit policies required