
-- Drop old category check constraint
ALTER TABLE public.compounds DROP CONSTRAINT compounds_category_check;

-- Add updated constraint with new categories
ALTER TABLE public.compounds ADD CONSTRAINT compounds_category_check 
CHECK (category = ANY (ARRAY['peptide', 'injectable-oil', 'oral', 'powder', 'prescription', 'holistic', 'essential-oil', 'alternative-medicine', 'vitamin', 'adaptogen', 'probiotic', 'nootropic', 'topical']));

-- Also update user_compounds if it has a similar constraint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_compounds_category_check') THEN
    ALTER TABLE public.user_compounds DROP CONSTRAINT user_compounds_category_check;
    ALTER TABLE public.user_compounds ADD CONSTRAINT user_compounds_category_check 
    CHECK (category = ANY (ARRAY['peptide', 'injectable-oil', 'oral', 'powder', 'prescription', 'holistic', 'essential-oil', 'alternative-medicine', 'vitamin', 'adaptogen', 'probiotic', 'nootropic', 'topical']));
  END IF;
END $$;
