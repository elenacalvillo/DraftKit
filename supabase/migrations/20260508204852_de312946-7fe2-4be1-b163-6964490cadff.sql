-- DRAFT-001 + DRAFT-002 + DRAFT-003: minimum notice + external links + republish public view

ALTER TABLE public.availability
  ADD COLUMN IF NOT EXISTS minimum_notice_weeks integer NOT NULL DEFAULT 0;

ALTER TABLE public.availability
  DROP CONSTRAINT IF EXISTS availability_minimum_notice_weeks_range;

ALTER TABLE public.availability
  ADD CONSTRAINT availability_minimum_notice_weeks_range
  CHECK (minimum_notice_weeks >= 0 AND minimum_notice_weeks <= 12);

COMMENT ON COLUMN public.availability.minimum_notice_weeks IS
  'DRAFT-001: weeks of buffer from today inside which guests cannot book a future selectable date. 0 = no buffer (default). Range 0..12.';

ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS external_links jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.creators.external_links IS
  'DRAFT-002: array of { url, label? } objects. https only, max 10 links, each url <= 2048 chars.';

DROP POLICY IF EXISTS "Public can view availability for public creators"
  ON public.availability;

DROP VIEW IF EXISTS public.public_creator_profiles;

CREATE VIEW public.public_creator_profiles
WITH (security_invoker = off) AS
SELECT id, username, name, bio, substack_url, newsletter_url,
       welcome_message, profile_image_url, collab_style, collab_guidelines,
       date_meaning, collab_mode, collab_vibe, collab_formats,
       external_links,
       created_at, profile_theme
FROM public.creators
WHERE username IS NOT NULL;

GRANT SELECT ON public.public_creator_profiles TO anon, authenticated;

CREATE POLICY "Public can view availability for public creators"
ON public.availability
FOR SELECT
TO anon, authenticated
USING (public.creator_has_public_profile(creator_id));