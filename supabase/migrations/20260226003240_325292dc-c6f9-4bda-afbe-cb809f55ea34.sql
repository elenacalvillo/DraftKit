ALTER TABLE collab_requests
  ADD COLUMN IF NOT EXISTS first_draft_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS editing_sessions jsonb DEFAULT '[]'::jsonb;