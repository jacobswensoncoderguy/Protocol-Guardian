
-- User-defined protocol groups (e.g. "Heart Health Protocol", "Libido Enhancement")
CREATE TABLE public.user_protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '💊',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own protocols"
  ON public.user_protocols FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own protocols"
  ON public.user_protocols FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own protocols"
  ON public.user_protocols FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own protocols"
  ON public.user_protocols FOR DELETE
  USING (auth.uid() = user_id);

-- Junction table linking user compounds to protocol groups
CREATE TABLE public.user_compound_protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_protocol_id UUID NOT NULL REFERENCES public.user_protocols(id) ON DELETE CASCADE,
  user_compound_id UUID NOT NULL REFERENCES public.user_compounds(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_protocol_id, user_compound_id)
);

ALTER TABLE public.user_compound_protocols ENABLE ROW LEVEL SECURITY;

-- RLS via join to user_protocols
CREATE POLICY "Users can view own compound-protocol links"
  ON public.user_compound_protocols FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_protocols
      WHERE id = user_protocol_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own compound-protocol links"
  ON public.user_compound_protocols FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_protocols
      WHERE id = user_protocol_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own compound-protocol links"
  ON public.user_compound_protocols FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_protocols
      WHERE id = user_protocol_id AND user_id = auth.uid()
    )
  );

-- Timestamp trigger for user_protocols
CREATE TRIGGER update_user_protocols_updated_at
  BEFORE UPDATE ON public.user_protocols
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
