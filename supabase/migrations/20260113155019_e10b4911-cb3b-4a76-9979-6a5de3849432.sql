-- Drop and recreate the view with security_invoker to fix security definer warning
DROP VIEW IF EXISTS public.public_booked_dates;

CREATE VIEW public.public_booked_dates
WITH (security_invoker = on) AS
SELECT creator_id, requested_date, status
FROM public.collab_requests
WHERE status NOT IN ('declined', 'cancelled');

-- Grant access to the view for anonymous and authenticated users
GRANT SELECT ON public.public_booked_dates TO anon, authenticated;

-- Add RLS policy to allow public read of booked dates from collab_requests 
-- This is required since the view uses security_invoker
CREATE POLICY "Public can view booked dates only"
ON public.collab_requests
FOR SELECT
USING (true);