-- Add administration_type and confirmation tracking to user_compounds
ALTER TABLE user_compounds
  ADD COLUMN IF NOT EXISTS administration_type text,
  ADD COLUMN IF NOT EXISTS admin_type_confirmed boolean NOT NULL DEFAULT false;

-- Infer administration_type from existing category for all compounds
-- admin_type_confirmed stays false so the UI shows confirmation tags
UPDATE user_compounds SET administration_type = 'reconstituted' WHERE category = 'peptide' AND administration_type IS NULL;
UPDATE user_compounds SET administration_type = 'oil_injectable' WHERE category = 'injectable-oil' AND administration_type IS NULL;
UPDATE user_compounds SET administration_type = 'oral' WHERE category IN ('oral', 'vitamin', 'adaptogen', 'nootropic', 'probiotic', 'prescription', 'holistic', 'alternative-medicine') AND administration_type IS NULL;
UPDATE user_compounds SET administration_type = 'powder' WHERE category = 'powder' AND administration_type IS NULL;
UPDATE user_compounds SET administration_type = 'topical' WHERE category = 'topical' AND administration_type IS NULL;
UPDATE user_compounds SET administration_type = 'sublingual' WHERE category = 'essential-oil' AND administration_type IS NULL;
