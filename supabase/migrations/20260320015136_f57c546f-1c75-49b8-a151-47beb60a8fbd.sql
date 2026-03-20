
-- Workout sessions table
CREATE TABLE public.workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_date date NOT NULL,
  workout_type text,
  program_name text,
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  duration_minutes integer,
  total_volume_lbs numeric,
  calories_burned integer,
  avg_heart_rate integer,
  hrv_post_workout integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own sessions" ON public.workout_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Workout sets table
CREATE TABLE public.workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.workout_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  exercise_name text NOT NULL,
  muscle_group text,
  set_number integer,
  reps integer,
  weight_lbs numeric,
  is_personal_record boolean DEFAULT false,
  rpe numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own sets" ON public.workout_sets
  FOR ALL USING (auth.uid() = user_id);

-- Workout integrations table
CREATE TABLE public.workout_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  is_connected boolean DEFAULT false,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  terra_user_id text,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.workout_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own integrations" ON public.workout_integrations
  FOR ALL USING (auth.uid() = user_id);
