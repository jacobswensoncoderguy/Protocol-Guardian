
-- Add app_features JSON column to profiles for storing which features the user wants
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS app_features jsonb DEFAULT '{"goal_tracking": true, "supplementation": true, "inventory_tracking": true, "dosing_reorder": true, "medical_records": true}'::jsonb;

-- Create feature_requests table
CREATE TABLE public.feature_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  request_text TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feature requests
CREATE POLICY "Users can insert their own feature requests"
ON public.feature_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own feature requests
CREATE POLICY "Users can view their own feature requests"
ON public.feature_requests FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own feature requests (mark as read)
CREATE POLICY "Users can update their own feature requests"
ON public.feature_requests FOR UPDATE
USING (auth.uid() = user_id);
