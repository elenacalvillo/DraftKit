-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Creators can insert own availability" ON availability;
DROP POLICY IF EXISTS "Creators can update own availability" ON availability;
DROP POLICY IF EXISTS "Public can view availability" ON availability;

-- Create new permissive policies (permissive is the default)
CREATE POLICY "Public can view availability" 
ON availability FOR SELECT 
USING (true);

CREATE POLICY "Creators can insert own availability" 
ON availability FOR INSERT 
WITH CHECK (
  creator_id IN (
    SELECT id FROM creators WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Creators can update own availability" 
ON availability FOR UPDATE 
USING (
  creator_id IN (
    SELECT id FROM creators WHERE user_id = auth.uid()
  )
);