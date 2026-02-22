
-- Cache table for personalized compound scores
CREATE TABLE public.personalized_score_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  compound_name TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  scores JSONB NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE(user_id, compound_name)
);

-- Index for fast lookups
CREATE INDEX idx_psc_user_compound ON public.personalized_score_cache(user_id, compound_name);
CREATE INDEX idx_psc_cache_key ON public.personalized_score_cache(cache_key);

-- Enable RLS
ALTER TABLE public.personalized_score_cache ENABLE ROW LEVEL SECURITY;

-- Users can only access their own cached scores
CREATE POLICY "Users can view own cached scores"
  ON public.personalized_score_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cached scores"
  ON public.personalized_score_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cached scores"
  ON public.personalized_score_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cached scores"
  ON public.personalized_score_cache FOR DELETE
  USING (auth.uid() = user_id);
