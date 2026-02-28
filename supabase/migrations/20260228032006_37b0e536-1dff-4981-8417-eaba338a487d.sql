
-- Add user intel columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS sign_in_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signup_source text,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
