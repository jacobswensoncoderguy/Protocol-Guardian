
-- Weekly schedule snapshots: stores the full compound configuration as JSONB
-- so historical views are immune to future protocol changes
CREATE TABLE public.weekly_schedule_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start_date DATE NOT NULL,
  compound_snapshots JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- One snapshot per user per week
CREATE UNIQUE INDEX uq_weekly_snapshot_user_week ON public.weekly_schedule_snapshots (user_id, week_start_date);

-- Enable RLS
ALTER TABLE public.weekly_schedule_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own snapshots"
  ON public.weekly_schedule_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own snapshots"
  ON public.weekly_schedule_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE policy: snapshots are immutable once created
