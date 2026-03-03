
-- Add dilution/reconstitution fields to user_compounds
ALTER TABLE public.user_compounds
  ADD COLUMN solvent_type text DEFAULT NULL,
  ADD COLUMN solvent_volume numeric DEFAULT NULL,
  ADD COLUMN solvent_unit text DEFAULT 'mL',
  ADD COLUMN resulting_concentration numeric DEFAULT NULL,
  ADD COLUMN concentration_unit text DEFAULT 'mg/mL',
  ADD COLUMN storage_instructions text DEFAULT NULL,
  ADD COLUMN prep_notes text DEFAULT NULL;

-- Add index for quick filtering of compounds needing reconstitution
CREATE INDEX idx_user_compounds_solvent ON public.user_compounds (solvent_type) WHERE solvent_type IS NOT NULL;
