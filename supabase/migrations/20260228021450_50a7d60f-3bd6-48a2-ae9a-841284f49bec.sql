
-- Add depletion_action column: what happens when stock runs out
-- Values: NULL (do nothing), 'pause', 'dormant'
ALTER TABLE public.user_compounds 
ADD COLUMN IF NOT EXISTS depletion_action TEXT DEFAULT NULL;
