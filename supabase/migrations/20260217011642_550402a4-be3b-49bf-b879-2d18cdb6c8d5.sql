-- Add weight_per_unit column (mg per individual pill/cap/scoop/tab)
ALTER TABLE public.user_compounds
ADD COLUMN weight_per_unit numeric DEFAULT NULL;

-- Add a comment for clarity
COMMENT ON COLUMN public.user_compounds.weight_per_unit IS 'Weight in mg per individual unit (pill, cap, tab, scoop, etc.)';
