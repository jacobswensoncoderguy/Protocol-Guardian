
-- Add vial_size_ml column to user_compounds
ALTER TABLE public.user_compounds ADD COLUMN vial_size_ml numeric DEFAULT NULL;

-- Add vial_size_ml column to compounds (library)
ALTER TABLE public.compounds ADD COLUMN vial_size_ml numeric DEFAULT NULL;

-- Migrate existing injectable-oil data: convert unitSize from total mg to mg/mL concentration
-- Current formula: total_mg = concentration * 10 (assuming 10mL vials)
-- So set vial_size_ml = 10, and unit_size = unit_size / 10
UPDATE public.user_compounds 
SET vial_size_ml = 10, unit_size = unit_size / 10 
WHERE category = 'injectable-oil' AND vial_size_ml IS NULL;

UPDATE public.compounds 
SET vial_size_ml = 10, unit_size = unit_size / 10 
WHERE category = 'injectable-oil' AND vial_size_ml IS NULL;
