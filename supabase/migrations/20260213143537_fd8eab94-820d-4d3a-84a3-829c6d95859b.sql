
-- Create compounds table matching the Compound interface
CREATE TABLE public.compounds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('peptide', 'injectable-oil', 'oral', 'powder')),
  unit_size NUMERIC NOT NULL,
  unit_label TEXT NOT NULL,
  unit_price NUMERIC NOT NULL,
  kit_price NUMERIC,
  dose_per_use NUMERIC NOT NULL,
  dose_label TEXT NOT NULL,
  bacstat_per_vial NUMERIC,
  recon_volume NUMERIC,
  doses_per_day NUMERIC NOT NULL,
  days_per_week NUMERIC NOT NULL,
  timing_note TEXT,
  cycling_note TEXT,
  current_quantity NUMERIC NOT NULL DEFAULT 0,
  purchase_date TEXT,
  reorder_quantity NUMERIC NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.compounds ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth required)
CREATE POLICY "Anyone can read compounds" ON public.compounds FOR SELECT USING (true);
CREATE POLICY "Anyone can insert compounds" ON public.compounds FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update compounds" ON public.compounds FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete compounds" ON public.compounds FOR DELETE USING (true);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_compounds_updated_at
BEFORE UPDATE ON public.compounds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
