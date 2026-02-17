-- Add pause fields to user_compounds
ALTER TABLE public.user_compounds
ADD COLUMN paused_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN pause_restart_date DATE DEFAULT NULL;

-- Index for quick lookup of paused compounds
CREATE INDEX idx_user_compounds_paused ON public.user_compounds (user_id) WHERE paused_at IS NOT NULL;