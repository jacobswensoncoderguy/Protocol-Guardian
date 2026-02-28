
-- Create titration schedules table
CREATE TABLE public.titration_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_compound_id UUID NOT NULL REFERENCES public.user_compounds(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Titration Schedule',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create titration steps table
CREATE TABLE public.titration_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.titration_schedules(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  dose_amount NUMERIC NOT NULL,
  dose_unit TEXT NOT NULL DEFAULT 'IU',
  start_date DATE NOT NULL,
  end_date DATE,
  duration_days INT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'skipped')),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create titration notifications table for the confirm flow
CREATE TABLE public.titration_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  schedule_id UUID NOT NULL REFERENCES public.titration_schedules(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.titration_steps(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL DEFAULT 'step_due' CHECK (notification_type IN ('step_due', 'step_upcoming', 'schedule_complete')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_actioned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.titration_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titration_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titration_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for titration_schedules
CREATE POLICY "Users can view their own titration schedules"
  ON public.titration_schedules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own titration schedules"
  ON public.titration_schedules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own titration schedules"
  ON public.titration_schedules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own titration schedules"
  ON public.titration_schedules FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for titration_steps (via schedule ownership)
CREATE POLICY "Users can view their titration steps"
  ON public.titration_steps FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.titration_schedules s
    WHERE s.id = schedule_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "Users can create titration steps"
  ON public.titration_steps FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.titration_schedules s
    WHERE s.id = schedule_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their titration steps"
  ON public.titration_steps FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.titration_schedules s
    WHERE s.id = schedule_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their titration steps"
  ON public.titration_steps FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.titration_schedules s
    WHERE s.id = schedule_id AND s.user_id = auth.uid()
  ));

-- RLS policies for titration_notifications
CREATE POLICY "Users can view their titration notifications"
  ON public.titration_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their titration notifications"
  ON public.titration_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their titration notifications"
  ON public.titration_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their titration notifications"
  ON public.titration_notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at on schedules
CREATE TRIGGER update_titration_schedules_updated_at
  BEFORE UPDATE ON public.titration_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_titration_schedules_user_compound ON public.titration_schedules(user_compound_id);
CREATE INDEX idx_titration_steps_schedule ON public.titration_steps(schedule_id);
CREATE INDEX idx_titration_notifications_user ON public.titration_notifications(user_id, is_actioned);
