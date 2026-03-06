ALTER TABLE public.user_compounds
  ADD COLUMN IF NOT EXISTS delivery_method text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ml_per_spray numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS active_ingredient_total_mg numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS container_volume_ml numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sprays_per_dose numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wear_duration_hours numeric DEFAULT NULL;

COMMENT ON COLUMN public.user_compounds.delivery_method IS 'Delivery method enum: subq-injection, im-injection, oral-swallow, oral-powder, oral-liquid, sublingual, nasal-spray, topical-cream, topical-patch, rectal, inhaled, iv-drip';
COMMENT ON COLUMN public.user_compounds.ml_per_spray IS 'Volume dispensed per pump/spray in mL (for spray-container math)';
COMMENT ON COLUMN public.user_compounds.active_ingredient_total_mg IS 'Total mg of active ingredient in container (for spray/liquid mg-per-dose calc)';
COMMENT ON COLUMN public.user_compounds.container_volume_ml IS 'Total container volume in mL (for liquid/spray containers)';
COMMENT ON COLUMN public.user_compounds.sprays_per_dose IS 'Number of sprays/pumps per dose (for spray-dose math)';
COMMENT ON COLUMN public.user_compounds.wear_duration_hours IS 'Wear time in hours (for transdermal patches)';