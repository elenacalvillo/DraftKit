-- Add new vibe + formats columns
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS collab_vibe text DEFAULT 'async',
  ADD COLUMN IF NOT EXISTS collab_formats text DEFAULT '["cross-post"]';

-- Constrain vibe values
ALTER TABLE public.creators
  DROP CONSTRAINT IF EXISTS creators_collab_vibe_check;
ALTER TABLE public.creators
  ADD CONSTRAINT creators_collab_vibe_check
  CHECK (collab_vibe IN ('async', 'live', 'call'));

-- Backfill from existing collab_style
UPDATE public.creators
SET collab_vibe = CASE
  WHEN collab_style ILIKE '%Virtual Coffee%' AND collab_style NOT ILIKE '%Async%' AND collab_style NOT ILIKE '%Interview%' AND collab_style NOT ILIKE '%Guest Post%' THEN 'call'
  WHEN collab_style ILIKE '%Live Event%' OR collab_style ILIKE '%Webinar%' THEN 'live'
  ELSE 'async'
END
WHERE collab_vibe IS NULL OR collab_vibe = 'async';

UPDATE public.creators
SET collab_formats = (
  SELECT to_jsonb(array_remove(ARRAY[
    CASE WHEN collab_style ILIKE '%Async Drafting%' OR collab_style ILIKE '%Co-written%' OR collab_style ILIKE '%Cross-post%' THEN 'cross-post' END,
    CASE WHEN collab_style ILIKE '%Interview%' THEN 'interview' END,
    CASE WHEN collab_style ILIKE '%Guest Post%' OR collab_style ILIKE '%Guest-post%' THEN 'guest-post' END
  ], NULL))::text
)
WHERE collab_vibe = 'async';

-- If async but no formats matched, default to cross-post
UPDATE public.creators
SET collab_formats = '["cross-post"]'
WHERE collab_vibe = 'async' AND (collab_formats IS NULL OR collab_formats = '[]' OR collab_formats = 'null');