-- Add new columns to collab_requests for AI draft and approval tracking
ALTER TABLE public.collab_requests 
ADD COLUMN ai_draft JSONB,
ADD COLUMN approved_at TIMESTAMPTZ,
ADD COLUMN creator_notes TEXT;

-- Create collaboration_messages table for messaging between collaborators
CREATE TABLE public.collaboration_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES collab_requests(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('creator', 'requester')),
  sender_email TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on collaboration_messages
ALTER TABLE public.collaboration_messages ENABLE ROW LEVEL SECURITY;

-- Creators can view messages for their collaboration requests
CREATE POLICY "Creators can view messages for their requests"
ON public.collaboration_messages
FOR SELECT
USING (
  request_id IN (
    SELECT cr.id FROM collab_requests cr
    JOIN creators c ON cr.creator_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

-- Creators can insert messages for their collaboration requests
CREATE POLICY "Creators can insert messages for their requests"
ON public.collaboration_messages
FOR INSERT
WITH CHECK (
  request_id IN (
    SELECT cr.id FROM collab_requests cr
    JOIN creators c ON cr.creator_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

-- Anyone can insert messages if they know the request_id (for requester responses via public endpoint)
CREATE POLICY "Anyone can insert messages with valid request"
ON public.collaboration_messages
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM collab_requests WHERE id = request_id)
);

-- Create creator_writing_samples table for tone analysis caching
CREATE TABLE public.creator_writing_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE UNIQUE,
  sample_posts JSONB,
  tone_profile JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on creator_writing_samples
ALTER TABLE public.creator_writing_samples ENABLE ROW LEVEL SECURITY;

-- Creators can manage their own writing samples
CREATE POLICY "Creators can view own writing samples"
ON public.creator_writing_samples
FOR SELECT
USING (
  creator_id IN (SELECT id FROM creators WHERE user_id = auth.uid())
);

CREATE POLICY "Creators can insert own writing samples"
ON public.creator_writing_samples
FOR INSERT
WITH CHECK (
  creator_id IN (SELECT id FROM creators WHERE user_id = auth.uid())
);

CREATE POLICY "Creators can update own writing samples"
ON public.creator_writing_samples
FOR UPDATE
USING (
  creator_id IN (SELECT id FROM creators WHERE user_id = auth.uid())
);

-- Service role can manage writing samples (for edge function)
CREATE POLICY "Service can manage writing samples"
ON public.creator_writing_samples
FOR ALL
USING (true)
WITH CHECK (true);