
-- =============================================
-- FOOD TRACKING TABLES
-- =============================================

-- Meals table: represents a meal occasion (breakfast, lunch, dinner, snack)
CREATE TABLE public.meals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  meal_type TEXT NOT NULL DEFAULT 'snack', -- breakfast, lunch, dinner, snack
  meal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own meals" ON public.meals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Food entries: individual food items within a meal
CREATE TABLE public.food_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  meal_id UUID REFERENCES public.meals(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  brand TEXT,
  serving_size NUMERIC,
  serving_unit TEXT DEFAULT 'g',
  servings NUMERIC NOT NULL DEFAULT 1,
  calories NUMERIC DEFAULT 0,
  protein_g NUMERIC DEFAULT 0,
  carbs_g NUMERIC DEFAULT 0,
  fat_g NUMERIC DEFAULT 0,
  fiber_g NUMERIC DEFAULT 0,
  sugar_g NUMERIC DEFAULT 0,
  sodium_mg NUMERIC DEFAULT 0,
  cholesterol_mg NUMERIC DEFAULT 0,
  barcode TEXT,
  source TEXT DEFAULT 'manual', -- manual, ai_scan, barcode, open_food_facts
  ai_confidence NUMERIC, -- 0-1 confidence score from AI estimation
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.food_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own food entries" ON public.food_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Nutrition targets: daily goals for macros
CREATE TABLE public.nutrition_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  calories_target NUMERIC DEFAULT 2000,
  protein_target_g NUMERIC DEFAULT 150,
  carbs_target_g NUMERIC DEFAULT 200,
  fat_target_g NUMERIC DEFAULT 65,
  fiber_target_g NUMERIC DEFAULT 30,
  diet_type TEXT DEFAULT 'custom', -- custom, keto, carnivore, mediterranean, vegan, paleo
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrition_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own nutrition targets" ON public.nutrition_targets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Saved foods: user's frequently used foods for quick entry
CREATE TABLE public.saved_foods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  food_name TEXT NOT NULL,
  brand TEXT,
  serving_size NUMERIC,
  serving_unit TEXT DEFAULT 'g',
  calories NUMERIC DEFAULT 0,
  protein_g NUMERIC DEFAULT 0,
  carbs_g NUMERIC DEFAULT 0,
  fat_g NUMERIC DEFAULT 0,
  fiber_g NUMERIC DEFAULT 0,
  sugar_g NUMERIC DEFAULT 0,
  sodium_mg NUMERIC DEFAULT 0,
  cholesterol_mg NUMERIC DEFAULT 0,
  barcode TEXT,
  use_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved foods" ON public.saved_foods FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================
-- SYMPTOM TRACKING TABLES
-- =============================================

-- Predefined symptom library
CREATE TABLE public.symptom_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- pain, digestive, neurological, skin, energy, mood, sleep, hormonal, other
  body_area TEXT, -- head, chest, abdomen, back, limbs, general
  is_system BOOLEAN DEFAULT true,
  user_id UUID, -- null for system-wide, user_id for custom
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.symptom_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read system and own symptom definitions" ON public.symptom_definitions FOR SELECT USING (is_system = true OR auth.uid() = user_id);
CREATE POLICY "Users create own symptom definitions" ON public.symptom_definitions FOR INSERT WITH CHECK (auth.uid() = user_id AND is_system = false);
CREATE POLICY "Users delete own symptom definitions" ON public.symptom_definitions FOR DELETE USING (auth.uid() = user_id AND is_system = false);

-- Seed predefined symptoms
INSERT INTO public.symptom_definitions (name, category, body_area, is_system) VALUES
  ('Headache', 'pain', 'head', true),
  ('Migraine', 'pain', 'head', true),
  ('Fatigue', 'energy', 'general', true),
  ('Low Energy', 'energy', 'general', true),
  ('Brain Fog', 'neurological', 'head', true),
  ('Dizziness', 'neurological', 'head', true),
  ('Nausea', 'digestive', 'abdomen', true),
  ('Bloating', 'digestive', 'abdomen', true),
  ('Stomach Pain', 'digestive', 'abdomen', true),
  ('Diarrhea', 'digestive', 'abdomen', true),
  ('Constipation', 'digestive', 'abdomen', true),
  ('Joint Pain', 'pain', 'limbs', true),
  ('Muscle Soreness', 'pain', 'limbs', true),
  ('Back Pain', 'pain', 'back', true),
  ('Chest Tightness', 'pain', 'chest', true),
  ('Insomnia', 'sleep', 'general', true),
  ('Poor Sleep Quality', 'sleep', 'general', true),
  ('Vivid Dreams', 'sleep', 'general', true),
  ('Anxiety', 'mood', 'general', true),
  ('Irritability', 'mood', 'general', true),
  ('Depression', 'mood', 'general', true),
  ('Mood Swings', 'mood', 'general', true),
  ('Acne', 'skin', 'general', true),
  ('Skin Rash', 'skin', 'general', true),
  ('Hair Loss', 'skin', 'head', true),
  ('Water Retention', 'hormonal', 'general', true),
  ('Night Sweats', 'hormonal', 'general', true),
  ('Hot Flashes', 'hormonal', 'general', true),
  ('Increased Heart Rate', 'pain', 'chest', true),
  ('Numbness/Tingling', 'neurological', 'limbs', true),
  ('Injection Site Pain', 'pain', 'limbs', true),
  ('Injection Site Redness', 'skin', 'limbs', true),
  ('Appetite Changes', 'digestive', 'general', true),
  ('Dry Mouth', 'other', 'head', true),
  ('Blurred Vision', 'neurological', 'head', true);

-- Symptom logs: individual symptom entries
CREATE TABLE public.symptom_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symptom_definition_id UUID REFERENCES public.symptom_definitions(id),
  custom_symptom TEXT, -- for free-text entries without a predefined definition
  severity INT NOT NULL DEFAULT 3 CHECK (severity >= 1 AND severity <= 5),
  timing TEXT DEFAULT 'new', -- chronic, new, infrequent, recurring
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  log_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.symptom_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own symptom logs" ON public.symptom_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Daily check-ins: quick daily wellness scores
CREATE TABLE public.daily_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  energy_score INT CHECK (energy_score >= 1 AND energy_score <= 5),
  mood_score INT CHECK (mood_score >= 1 AND mood_score <= 5),
  pain_score INT CHECK (pain_score >= 1 AND pain_score <= 5),
  sleep_score INT CHECK (sleep_score >= 1 AND sleep_score <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, checkin_date)
);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own daily checkins" ON public.daily_checkins FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Protocol changes: user-reported changes for correlation tracking
CREATE TABLE public.protocol_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  change_date DATE NOT NULL DEFAULT CURRENT_DATE,
  compound_id TEXT, -- links to user_compounds.compound_id
  change_type TEXT NOT NULL DEFAULT 'dose_change', -- dose_change, started, stopped, timing_change, new_compound, behavior_change
  description TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.protocol_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own protocol changes" ON public.protocol_changes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_meals_user_date ON public.meals(user_id, meal_date);
CREATE INDEX idx_food_entries_meal ON public.food_entries(meal_id);
CREATE INDEX idx_food_entries_user ON public.food_entries(user_id);
CREATE INDEX idx_symptom_logs_user_date ON public.symptom_logs(user_id, log_date);
CREATE INDEX idx_daily_checkins_user_date ON public.daily_checkins(user_id, checkin_date);
CREATE INDEX idx_protocol_changes_user_date ON public.protocol_changes(user_id, change_date);
CREATE INDEX idx_saved_foods_user ON public.saved_foods(user_id);

-- Timestamp update triggers
CREATE TRIGGER update_meals_updated_at BEFORE UPDATE ON public.meals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_nutrition_targets_updated_at BEFORE UPDATE ON public.nutrition_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
