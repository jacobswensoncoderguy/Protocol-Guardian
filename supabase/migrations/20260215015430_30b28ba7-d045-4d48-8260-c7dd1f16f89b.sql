
-- Create chat projects table
CREATE TABLE public.chat_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own chat projects" ON public.chat_projects FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- Create conversations table
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES public.chat_projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own conversations" ON public.chat_conversations FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- Add conversation_id to existing chat messages table
ALTER TABLE public.protocol_chat_messages ADD COLUMN conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE;

-- Create index for search
CREATE INDEX idx_chat_messages_content ON public.protocol_chat_messages USING gin(to_tsvector('english', content));
CREATE INDEX idx_chat_conversations_title ON public.chat_conversations USING gin(to_tsvector('english', title));
CREATE INDEX idx_chat_messages_conversation ON public.protocol_chat_messages(conversation_id);

-- Update timestamp trigger
CREATE TRIGGER update_chat_projects_updated_at BEFORE UPDATE ON public.chat_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
