-- Add measurement preferences to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS measurement_system text NOT NULL DEFAULT 'metric',
ADD COLUMN IF NOT EXISTS dose_unit_preference text NOT NULL DEFAULT 'mg';

-- Add a comment for clarity
COMMENT ON COLUMN public.profiles.measurement_system IS 'metric or imperial';
COMMENT ON COLUMN public.profiles.dose_unit_preference IS 'mg or iu for liquid compounds';