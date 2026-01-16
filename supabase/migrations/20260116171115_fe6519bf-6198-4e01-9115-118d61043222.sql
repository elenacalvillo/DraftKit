-- Add collaboration playbook fields to creators table
ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS collab_style TEXT DEFAULT 'Virtual Coffee',
ADD COLUMN IF NOT EXISTS collab_guidelines TEXT;

-- Add constraint for valid collab_style values (drop first if exists)
ALTER TABLE public.creators 
DROP CONSTRAINT IF EXISTS valid_collab_style;

ALTER TABLE public.creators 
ADD CONSTRAINT valid_collab_style 
CHECK (collab_style IS NULL OR collab_style IN ('Virtual Coffee', 'Async Drafting', 'Interview Style', 'Custom'));