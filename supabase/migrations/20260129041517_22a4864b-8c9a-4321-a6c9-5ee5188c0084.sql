-- Move creator emails out of public.creators to prevent accidental exposure

-- 1) Create private contact table (one-to-one with creators)
CREATE TABLE IF NOT EXISTS public.creator_contacts (
  creator_id uuid PRIMARY KEY REFERENCES public.creators(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful uniqueness + performance
CREATE UNIQUE INDEX IF NOT EXISTS creator_contacts_email_key ON public.creator_contacts (email);

-- 2) Enable RLS
ALTER TABLE public.creator_contacts ENABLE ROW LEVEL SECURITY;

-- 3) Policies (owner-only)
DROP POLICY IF EXISTS "Creators can view own contact" ON public.creator_contacts;
CREATE POLICY "Creators can view own contact"
ON public.creator_contacts
FOR SELECT
USING (
  creator_id IN (
    SELECT c.id FROM public.creators c
    WHERE c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Creators can insert own contact" ON public.creator_contacts;
CREATE POLICY "Creators can insert own contact"
ON public.creator_contacts
FOR INSERT
WITH CHECK (
  creator_id IN (
    SELECT c.id FROM public.creators c
    WHERE c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Creators can update own contact" ON public.creator_contacts;
CREATE POLICY "Creators can update own contact"
ON public.creator_contacts
FOR UPDATE
USING (
  creator_id IN (
    SELECT c.id FROM public.creators c
    WHERE c.user_id = auth.uid()
  )
)
WITH CHECK (
  creator_id IN (
    SELECT c.id FROM public.creators c
    WHERE c.user_id = auth.uid()
  )
);

-- 4) Backfill from existing creators.email
INSERT INTO public.creator_contacts (creator_id, email)
SELECT id, email
FROM public.creators
ON CONFLICT (creator_id)
DO UPDATE SET email = EXCLUDED.email;

-- 5) Update DB function that matched creators by email
CREATE OR REPLACE FUNCTION public.link_request_to_existing_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only if requester_user_id is not already set
  IF NEW.requester_user_id IS NULL THEN
    -- Try to find a matching creator by email (now stored in creator_contacts)
    SELECT c.user_id INTO NEW.requester_user_id
    FROM public.creators c
    JOIN public.creator_contacts cc
      ON cc.creator_id = c.id
    WHERE cc.email = NEW.requester_email
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

-- 6) Drop email column from creators to eliminate the exposure class entirely
ALTER TABLE public.creators DROP COLUMN IF EXISTS email;
