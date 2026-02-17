
-- Custom fields that users can add to compound cards
-- These are first-class values that integrate into calculations
CREATE TABLE public.compound_custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'number', 'date', 'select'
  field_unit TEXT, -- e.g. 'mg', 'hours', '$', '%'
  is_predefined BOOLEAN NOT NULL DEFAULT false,
  affects_calculation BOOLEAN NOT NULL DEFAULT false,
  calculation_role TEXT, -- 'cost_multiplier', 'dose_modifier', 'schedule_modifier', 'inventory_modifier'
  default_value TEXT,
  options JSONB, -- for 'select' type fields: ["option1", "option2"]
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, field_name)
);

-- Values for each compound's custom fields
CREATE TABLE public.compound_custom_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_compound_id UUID NOT NULL REFERENCES public.user_compounds(id) ON DELETE CASCADE,
  custom_field_id UUID NOT NULL REFERENCES public.compound_custom_fields(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_compound_id, custom_field_id)
);

-- Enable RLS
ALTER TABLE public.compound_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compound_custom_field_values ENABLE ROW LEVEL SECURITY;

-- RLS for custom fields definition
CREATE POLICY "Users can view their own custom fields"
  ON public.compound_custom_fields FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom fields"
  ON public.compound_custom_fields FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom fields"
  ON public.compound_custom_fields FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom fields"
  ON public.compound_custom_fields FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for custom field values - check ownership via compound
CREATE POLICY "Users can view their own field values"
  ON public.compound_custom_field_values FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_compounds uc
    WHERE uc.id = user_compound_id AND uc.user_id = auth.uid()
  ));

CREATE POLICY "Users can create field values for their compounds"
  ON public.compound_custom_field_values FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_compounds uc
    WHERE uc.id = user_compound_id AND uc.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own field values"
  ON public.compound_custom_field_values FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_compounds uc
    WHERE uc.id = user_compound_id AND uc.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own field values"
  ON public.compound_custom_field_values FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.user_compounds uc
    WHERE uc.id = user_compound_id AND uc.user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_compound_custom_field_values_updated_at
  BEFORE UPDATE ON public.compound_custom_field_values
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
