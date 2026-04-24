CREATE POLICY "Creators can view own availability"
ON public.availability FOR SELECT
USING (
  creator_id IN (
    SELECT id FROM public.creators WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Public can view availability for public creators"
ON public.availability FOR SELECT
USING (
  creator_id IN (
    SELECT id FROM public.public_creator_profiles WHERE username IS NOT NULL
  )
);