
-- Add profile fields for gender, height, weight, body fat, age
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS body_fat_pct numeric,
  ADD COLUMN IF NOT EXISTS age integer;

-- Create tolerance history table
CREATE TABLE public.tolerance_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tolerance_level text NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tolerance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tolerance history"
  ON public.tolerance_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tolerance history"
  ON public.tolerance_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_tolerance_history_user_date ON public.tolerance_history (user_id, created_at DESC);
