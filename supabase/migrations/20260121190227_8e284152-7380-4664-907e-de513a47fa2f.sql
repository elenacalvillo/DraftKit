-- ============================================================
-- Add date_meaning column to creators table
-- This allows hosts to define what their available dates represent
-- ============================================================

ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS date_meaning text DEFAULT 'flexible';

-- Add constraint for allowed values (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'creators_date_meaning_check'
  ) THEN
    ALTER TABLE public.creators
    ADD CONSTRAINT creators_date_meaning_check 
    CHECK (date_meaning IN ('kickoff', 'publish', 'live', 'flexible'));
  END IF;
END $$;

-- ============================================================
-- Update the collab style validation trigger to accept new types
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_creator_collab_style()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  allowed_styles TEXT[] := ARRAY[
    'Virtual Coffee', 
    'Async Drafting', 
    'Interview Style', 
    'Guest Post Exchange',
    'Live Event / Webinar',
    'Co-written Article',
    'Newsletter Shoutout',
    'Custom'
  ];
  parsed_array JSONB;
  style_element TEXT;
BEGIN
  -- Allow NULL
  IF NEW.collab_style IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if it's a plain allowed string (legacy format)
  IF NEW.collab_style = ANY(allowed_styles) THEN
    RETURN NEW;
  END IF;
  
  -- Try to parse as JSON array
  BEGIN
    parsed_array := NEW.collab_style::JSONB;
    
    -- Must be an array
    IF jsonb_typeof(parsed_array) != 'array' THEN
      RAISE EXCEPTION 'collab_style must be a string or JSON array of strings';
    END IF;
    
    -- Must not be empty
    IF jsonb_array_length(parsed_array) = 0 THEN
      RAISE EXCEPTION 'collab_style array must not be empty';
    END IF;
    
    -- Each element must be an allowed style
    FOR style_element IN SELECT jsonb_array_elements_text(parsed_array)
    LOOP
      IF NOT (style_element = ANY(allowed_styles)) THEN
        RAISE EXCEPTION 'Invalid collab_style value: %. Allowed: %', style_element, array_to_string(allowed_styles, ', ');
      END IF;
    END LOOP;
    
    RETURN NEW;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'collab_style must be a valid style or JSON array. Allowed styles: %', array_to_string(allowed_styles, ', ');
  END;
END;
$function$;

-- ============================================================
-- Drop and recreate the public_creator_profiles view to include date_meaning
-- ============================================================

DROP VIEW IF EXISTS public.public_creator_profiles;

CREATE VIEW public.public_creator_profiles AS
SELECT 
  id,
  username,
  name,
  bio,
  substack_url,
  newsletter_url,
  welcome_message,
  profile_image_url,
  collab_style,
  collab_guidelines,
  date_meaning,
  created_at
FROM public.creators;