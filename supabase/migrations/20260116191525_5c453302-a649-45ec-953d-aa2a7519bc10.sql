-- Drop the old single-value check constraint
ALTER TABLE public.creators DROP CONSTRAINT IF EXISTS valid_collab_style;

-- Create validation function for collab_style (supports NULL, single string, or JSON array)
CREATE OR REPLACE FUNCTION public.validate_creator_collab_style()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  allowed_styles TEXT[] := ARRAY['Virtual Coffee', 'Async Drafting', 'Interview Style', 'Custom'];
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
$$;

-- Create trigger to validate on insert/update
DROP TRIGGER IF EXISTS validate_collab_style_trigger ON public.creators;
CREATE TRIGGER validate_collab_style_trigger
  BEFORE INSERT OR UPDATE ON public.creators
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_creator_collab_style();