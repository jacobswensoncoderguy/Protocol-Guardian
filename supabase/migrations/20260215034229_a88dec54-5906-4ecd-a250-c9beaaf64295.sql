
-- Goals tracked by each user
CREATE TABLE public.user_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  body_area TEXT,
  target_value NUMERIC,
  target_unit TEXT,
  baseline_value NUMERIC,
  current_value NUMERIC,
  target_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own goals" ON public.user_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Link protocols to goals
CREATE TABLE public.user_goal_protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_goal_id UUID NOT NULL REFERENCES public.user_goals(id) ON DELETE CASCADE,
  user_protocol_id UUID NOT NULL REFERENCES public.user_protocols(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_goal_id, user_protocol_id)
);

ALTER TABLE public.user_goal_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their goal-protocol links" ON public.user_goal_protocols FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_goals WHERE id = user_goal_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_goals WHERE id = user_goal_id AND user_id = auth.uid()));

-- Readings/measurements over time
CREATE TABLE public.user_goal_readings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_goal_id UUID NOT NULL REFERENCES public.user_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  source TEXT,
  notes TEXT,
  reading_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_goal_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own readings" ON public.user_goal_readings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- File uploads for evidence
CREATE TABLE public.user_goal_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_goal_id UUID NOT NULL REFERENCES public.user_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  upload_type TEXT NOT NULL,
  ai_extracted_data JSONB,
  notes TEXT,
  reading_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_goal_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own uploads" ON public.user_goal_uploads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Onboarding interview responses
CREATE TABLE public.user_onboarding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  responses JSONB NOT NULL DEFAULT '{}',
  ai_conversation TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own onboarding" ON public.user_onboarding FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Timestamp triggers
CREATE TRIGGER update_user_goals_updated_at BEFORE UPDATE ON public.user_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_onboarding_updated_at BEFORE UPDATE ON public.user_onboarding FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
