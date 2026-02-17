import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CustomField {
  id: string;
  user_id: string;
  field_name: string;
  field_type: 'text' | 'number' | 'date' | 'select';
  field_unit: string | null;
  is_predefined: boolean;
  affects_calculation: boolean;
  calculation_role: string | null;
  default_value: string | null;
  options: string[] | null;
  sort_order: number;
}

export interface CustomFieldValue {
  id: string;
  user_compound_id: string;
  custom_field_id: string;
  value: string;
}

export const PREDEFINED_FIELDS: Omit<CustomField, 'id' | 'user_id'>[] = [
  { field_name: 'Half-life', field_type: 'number', field_unit: 'hours', is_predefined: true, affects_calculation: false, calculation_role: null, default_value: null, options: null, sort_order: 0 },
  { field_name: 'Source / Vendor', field_type: 'text', field_unit: null, is_predefined: true, affects_calculation: false, calculation_role: null, default_value: null, options: null, sort_order: 1 },
  { field_name: 'Batch #', field_type: 'text', field_unit: null, is_predefined: true, affects_calculation: false, calculation_role: null, default_value: null, options: null, sort_order: 2 },
  { field_name: 'Expiry Date', field_type: 'date', field_unit: null, is_predefined: true, affects_calculation: false, calculation_role: null, default_value: null, options: null, sort_order: 3 },
  { field_name: 'Shipping Cost', field_type: 'number', field_unit: '$', is_predefined: true, affects_calculation: true, calculation_role: 'cost_multiplier', default_value: '0', options: null, sort_order: 4 },
  { field_name: 'Discount %', field_type: 'number', field_unit: '%', is_predefined: true, affects_calculation: true, calculation_role: 'cost_multiplier', default_value: '0', options: null, sort_order: 5 },
  { field_name: 'Doses Per Day', field_type: 'number', field_unit: 'x', is_predefined: true, affects_calculation: true, calculation_role: 'dose_modifier', default_value: '1', options: null, sort_order: 6 },
  { field_name: 'Storage Temp', field_type: 'select', field_unit: null, is_predefined: true, affects_calculation: false, calculation_role: null, default_value: 'Room Temp', options: ['Room Temp', 'Refrigerate', 'Freeze'], sort_order: 7 },
];

export function useCustomFields(userId: string | undefined) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<Map<string, Map<string, string>>>(new Map()); // compoundId -> fieldId -> value
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!userId) { setFields([]); setValues(new Map()); setLoading(false); return; }

    const [fieldsRes, valuesRes] = await Promise.all([
      (supabase as any).from('compound_custom_fields').select('*').eq('user_id', userId).order('sort_order'),
      (supabase as any).from('compound_custom_field_values').select('*'),
    ]);

    if (!fieldsRes.error && fieldsRes.data) {
      setFields(fieldsRes.data as CustomField[]);
    }

    if (!valuesRes.error && valuesRes.data) {
      const map = new Map<string, Map<string, string>>();
      (valuesRes.data as CustomFieldValue[]).forEach(v => {
        if (!map.has(v.user_compound_id)) map.set(v.user_compound_id, new Map());
        map.get(v.user_compound_id)!.set(v.custom_field_id, v.value);
      });
      setValues(map);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addField = useCallback(async (field: Partial<CustomField>) => {
    if (!userId) return null;
    const { data, error } = await (supabase as any)
      .from('compound_custom_fields')
      .insert({ user_id: userId, ...field })
      .select()
      .single();
    if (error) { console.error('Failed to add custom field:', error); return null; }
    await fetchAll();
    return data as CustomField;
  }, [userId, fetchAll]);

  const removeField = useCallback(async (fieldId: string) => {
    const { error } = await (supabase as any).from('compound_custom_fields').delete().eq('id', fieldId);
    if (error) console.error('Failed to remove custom field:', error);
    await fetchAll();
  }, [fetchAll]);

  const reorderField = useCallback(async (fieldId: string, direction: 'up' | 'down') => {
    const idx = fields.findIndex(f => f.id === fieldId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= fields.length) return;

    const currentField = fields[idx];
    const swapField = fields[swapIdx];

    // Swap sort_order values
    await Promise.all([
      (supabase as any).from('compound_custom_fields').update({ sort_order: swapField.sort_order }).eq('id', currentField.id),
      (supabase as any).from('compound_custom_fields').update({ sort_order: currentField.sort_order }).eq('id', swapField.id),
    ]);

    await fetchAll();
  }, [fields, fetchAll]);

  const setValue = useCallback(async (compoundId: string, fieldId: string, value: string) => {
    const { error } = await (supabase as any)
      .from('compound_custom_field_values')
      .upsert(
        { user_compound_id: compoundId, custom_field_id: fieldId, value, updated_at: new Date().toISOString() },
        { onConflict: 'user_compound_id,custom_field_id' }
      );
    if (error) console.error('Failed to set field value:', error);
    // Update local state immediately
    setValues(prev => {
      const next = new Map(prev);
      if (!next.has(compoundId)) next.set(compoundId, new Map());
      next.get(compoundId)!.set(fieldId, value);
      return next;
    });
  }, []);

  const getCompoundValues = useCallback((compoundId: string): Map<string, string> => {
    return values.get(compoundId) || new Map();
  }, [values]);

  return { fields, values, loading, addField, removeField, reorderField, setValue, getCompoundValues, refetch: fetchAll };
}
