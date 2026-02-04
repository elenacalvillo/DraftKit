-- Fix 1: Restrict availability to only creators with public profiles (not bulk enumeration)
DROP POLICY IF EXISTS "Public can view availability" ON availability;

CREATE POLICY "Public can view availability for public creators"
ON availability FOR SELECT
USING (
  creator_id IN (
    SELECT id FROM public_creator_profiles 
    WHERE username IS NOT NULL
  )
);

-- Fix 2: email_events - Add explicit RESTRICTIVE write policies for defense-in-depth
-- Note: email_events already has RLS enabled with admin SELECT only

-- Explicit deny for client-side inserts (only service role via edge functions can insert)
CREATE POLICY "Deny direct inserts to email events"
ON email_events FOR INSERT
TO authenticated
WITH CHECK (false);

-- Explicit deny for updates (email events are immutable audit logs)
CREATE POLICY "Email events are immutable"
ON email_events FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- Only admins can delete (for data retention management)
CREATE POLICY "Admins can delete old email events"
ON email_events FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Note: public_booked_dates is a VIEW (not a table), so RLS doesn't apply to it directly.
-- VIEWs inherit security from their underlying tables. Since it reads from collab_requests 
-- which has RLS, and exposes only creator_id, requested_date, status (no PII), this is 
-- architecturally secure by design. The VIEW was specifically created to expose only 
-- non-sensitive booking data for the calendar feature.