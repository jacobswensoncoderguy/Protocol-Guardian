
-- Table to persist daily dose check-offs
CREATE TABLE public.dose_check_offs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  compound_id TEXT NOT NULL,
  timing TEXT NOT NULL,
  dose_index INT NOT NULL DEFAULT 0,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one check per compound/timing/index per day per user
ALTER TABLE public.dose_check_offs
  ADD CONSTRAINT uq_dose_check_off UNIQUE (user_id, check_date, compound_id, timing, dose_index);

-- Index for fast lookups
CREATE INDEX idx_dose_check_offs_user_date ON public.dose_check_offs (user_id, check_date);

-- Enable RLS
ALTER TABLE public.dose_check_offs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own check-offs
CREATE POLICY "Users can view own check-offs"
  ON public.dose_check_offs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own check-offs"
  ON public.dose_check_offs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own check-offs"
  ON public.dose_check_offs FOR DELETE
  USING (auth.uid() = user_id);
