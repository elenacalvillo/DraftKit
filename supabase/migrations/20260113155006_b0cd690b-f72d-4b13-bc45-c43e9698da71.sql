-- Create a view for public booking date checks
-- This exposes only non-sensitive information needed to show booked dates
CREATE VIEW public.public_booked_dates AS
SELECT creator_id, requested_date, status
FROM public.collab_requests
WHERE status NOT IN ('declined', 'cancelled');

-- Grant access to the view for anonymous and authenticated users
GRANT SELECT ON public.public_booked_dates TO anon, authenticated;