-- Create creators table (profiles)
CREATE TABLE public.creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  substack_url TEXT,
  bio TEXT,
  welcome_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create availability table
CREATE TABLE public.availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.creators(id) ON DELETE CASCADE NOT NULL UNIQUE,
  available_dates TEXT[] DEFAULT '{}',
  blocked_dates TEXT[] DEFAULT '{}',
  recurring_days INTEGER[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create collaboration requests table
CREATE TABLE public.collab_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.creators(id) ON DELETE CASCADE NOT NULL,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_substack_url TEXT,
  message TEXT,
  requested_date DATE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'declined')) DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_requests ENABLE ROW LEVEL SECURITY;

-- Creators policies
-- Public can view creator profiles (for public booking page)
CREATE POLICY "Public can view creator profiles"
  ON public.creators FOR SELECT
  USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.creators FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.creators FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own profile
CREATE POLICY "Users can delete own profile"
  ON public.creators FOR DELETE
  USING (auth.uid() = user_id);

-- Availability policies
-- Public can view availability (for public booking page)
CREATE POLICY "Public can view availability"
  ON public.availability FOR SELECT
  USING (true);

-- Creators can insert their own availability
CREATE POLICY "Creators can insert own availability"
  ON public.availability FOR INSERT
  WITH CHECK (creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid()));

-- Creators can update their own availability
CREATE POLICY "Creators can update own availability"
  ON public.availability FOR UPDATE
  USING (creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid()));

-- Collab requests policies
-- Creators can view their own requests
CREATE POLICY "Creators view own requests"
  ON public.collab_requests FOR SELECT
  USING (creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid()));

-- Anyone can create requests (public booking)
CREATE POLICY "Anyone can create requests"
  ON public.collab_requests FOR INSERT
  WITH CHECK (true);

-- Creators can update their own requests (approve/decline)
CREATE POLICY "Creators can update own requests"
  ON public.collab_requests FOR UPDATE
  USING (creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid()));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_creators_updated_at
  BEFORE UPDATE ON public.creators
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_availability_updated_at
  BEFORE UPDATE ON public.availability
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();