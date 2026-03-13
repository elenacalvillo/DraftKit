
-- discovered_publications: shared catalog of Substack publications
CREATE TABLE public.discovered_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subdomain text UNIQUE NOT NULL,
  name text,
  author_name text,
  description text,
  logo_url text,
  subscriber_count integer,
  language text,
  discovered_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discovered_publications ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read discovered publications
CREATE POLICY "Authenticated users can view discovered publications"
  ON public.discovered_publications FOR SELECT TO authenticated
  USING (true);

-- creator_recommendations: tracks which creator recommended which publication
CREATE TABLE public.creator_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  publication_id uuid NOT NULL REFERENCES public.discovered_publications(id) ON DELETE CASCADE,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_id, publication_id)
);

ALTER TABLE public.creator_recommendations ENABLE ROW LEVEL SECURITY;

-- Creators can view their own recommendations
CREATE POLICY "Creators can view own recommendations"
  ON public.creator_recommendations FOR SELECT TO authenticated
  USING (creator_id IN (SELECT c.id FROM creators c WHERE c.user_id = auth.uid()));
