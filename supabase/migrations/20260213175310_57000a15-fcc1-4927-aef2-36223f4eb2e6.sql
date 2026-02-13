
-- Add cycling columns to compounds table
ALTER TABLE public.compounds
  ADD COLUMN cycle_on_days INTEGER DEFAULT NULL,
  ADD COLUMN cycle_off_days INTEGER DEFAULT NULL,
  ADD COLUMN cycle_start_date DATE DEFAULT NULL;

-- Populate cycling data for known cycling compounds
UPDATE public.compounds SET cycle_on_days = 28, cycle_off_days = 21, cycle_start_date = CURRENT_DATE WHERE id = 'bpc-157';
UPDATE public.compounds SET cycle_on_days = 28, cycle_off_days = 21, cycle_start_date = CURRENT_DATE WHERE id = 'tb-500';
UPDATE public.compounds SET cycle_on_days = 30, cycle_off_days = 21, cycle_start_date = CURRENT_DATE WHERE id = 'cerebroprotein';
