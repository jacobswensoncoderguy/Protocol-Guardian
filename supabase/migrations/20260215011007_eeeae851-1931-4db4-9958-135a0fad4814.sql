
-- Create table for persisting protocol chat messages
CREATE TABLE public.protocol_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  proposal JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.protocol_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only access their own messages
CREATE POLICY "Users can view their own chat messages"
  ON public.protocol_chat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat messages"
  ON public.protocol_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat messages"
  ON public.protocol_chat_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast loading
CREATE INDEX idx_protocol_chat_user_created ON public.protocol_chat_messages (user_id, created_at);
