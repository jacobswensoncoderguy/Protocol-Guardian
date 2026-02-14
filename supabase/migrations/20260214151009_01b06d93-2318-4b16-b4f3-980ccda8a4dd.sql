
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Create user_compounds table (personal protocol per user)
CREATE TABLE public.user_compounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  compound_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
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
  cycle_on_days INTEGER,
  cycle_off_days INTEGER,
  cycle_start_date TEXT,
  current_quantity NUMERIC NOT NULL DEFAULT 0,
  purchase_date TEXT,
  reorder_quantity NUMERIC NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_compounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own compounds"
ON public.user_compounds FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own compounds"
ON public.user_compounds FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own compounds"
ON public.user_compounds FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own compounds"
ON public.user_compounds FOR DELETE
USING (auth.uid() = user_id);

-- Make the compounds table read-only (library)
-- First drop existing permissive policies
DROP POLICY IF EXISTS "Allow public read access" ON public.compounds;
DROP POLICY IF EXISTS "Allow public insert" ON public.compounds;
DROP POLICY IF EXISTS "Allow public update" ON public.compounds;
DROP POLICY IF EXISTS "Allow public delete" ON public.compounds;
DROP POLICY IF EXISTS "Public read access" ON public.compounds;
DROP POLICY IF EXISTS "Public insert access" ON public.compounds;
DROP POLICY IF EXISTS "Public update access" ON public.compounds;
DROP POLICY IF EXISTS "Public delete access" ON public.compounds;

-- Add read-only public access for compound library
CREATE POLICY "Anyone can read compound library"
ON public.compounds FOR SELECT
USING (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_compounds_updated_at
BEFORE UPDATE ON public.user_compounds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
