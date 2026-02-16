
-- Add reorder_type to user_compounds for unit vs kit selection
ALTER TABLE public.user_compounds ADD COLUMN reorder_type text NOT NULL DEFAULT 'single';

-- Add custom labels for goals
ALTER TABLE public.user_goals ADD COLUMN baseline_label text DEFAULT 'Baseline';
ALTER TABLE public.user_goals ADD COLUMN target_label text DEFAULT 'Target';
