import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Compound, CompoundCategory } from '@/data/compounds';

interface DbUserCompound {
  id: string;
  user_id: string;
  compound_id: string;
  name: string;
  category: string;
  unit_size: number;
  unit_label: string;
  unit_price: number;
  kit_price: number | null;
  dose_per_use: number;
  dose_label: string;
  bacstat_per_vial: number | null;
  recon_volume: number | null;
  doses_per_day: number;
  days_per_week: number;
  timing_note: string | null;
  cycling_note: string | null;
  current_quantity: number;
  purchase_date: string | null;
  reorder_quantity: number;
  reorder_type: string | null;
  notes: string | null;
  cycle_on_days: number | null;
  cycle_off_days: number | null;
  cycle_start_date: string | null;
  vial_size_ml: number | null;
  weight_per_unit: number | null;
}

function dbToCompound(row: DbUserCompound): Compound {
  return {
    id: row.id, // use user_compound UUID as the compound id
    name: row.name,
    category: row.category as CompoundCategory,
    unitSize: row.unit_size,
    unitLabel: row.unit_label,
    unitPrice: row.unit_price,
    kitPrice: row.kit_price ?? undefined,
    dosePerUse: row.dose_per_use,
    doseLabel: row.dose_label,
    bacstatPerVial: row.bacstat_per_vial ?? undefined,
    reconVolume: row.recon_volume ?? undefined,
    dosesPerDay: row.doses_per_day,
    daysPerWeek: row.days_per_week,
    timingNote: row.timing_note ?? undefined,
    cyclingNote: row.cycling_note ?? undefined,
    currentQuantity: row.current_quantity,
    purchaseDate: row.purchase_date ?? '',
    reorderQuantity: row.reorder_quantity,
    reorderType: (row.reorder_type as 'single' | 'kit') ?? 'single',
    notes: row.notes ?? undefined,
    cycleOnDays: row.cycle_on_days ?? undefined,
    cycleOffDays: row.cycle_off_days ?? undefined,
    cycleStartDate: row.cycle_start_date ?? undefined,
    vialSizeMl: row.vial_size_ml ?? undefined,
    weightPerUnit: row.weight_per_unit ?? undefined,
  };
}

export function useCompounds(userId: string | undefined) {
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasCompounds, setHasCompounds] = useState<boolean | null>(null);

  const fetchCompounds = useCallback(async () => {
    if (!userId) {
      setCompounds([]);
      setLoading(false);
      setHasCompounds(null);
      return;
    }

    const { data, error } = await supabase
      .from('user_compounds')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to fetch compounds:', error);
      setCompounds([]);
      setHasCompounds(false);
    } else if (data && data.length > 0) {
      setCompounds((data as DbUserCompound[]).map(dbToCompound));
      setHasCompounds(true);
    } else {
      setCompounds([]);
      setHasCompounds(false);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchCompounds();
  }, [fetchCompounds]);

  const updateCompound = useCallback(async (id: string, updates: Partial<Compound>) => {
    setCompounds(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.unitSize !== undefined) dbUpdates.unit_size = updates.unitSize;
    if (updates.unitLabel !== undefined) dbUpdates.unit_label = updates.unitLabel;
    if (updates.unitPrice !== undefined) dbUpdates.unit_price = updates.unitPrice;
    if (updates.kitPrice !== undefined) dbUpdates.kit_price = updates.kitPrice;
    if (updates.dosePerUse !== undefined) dbUpdates.dose_per_use = updates.dosePerUse;
    if (updates.doseLabel !== undefined) dbUpdates.dose_label = updates.doseLabel;
    if (updates.bacstatPerVial !== undefined) dbUpdates.bacstat_per_vial = updates.bacstatPerVial;
    if (updates.reconVolume !== undefined) dbUpdates.recon_volume = updates.reconVolume;
    if (updates.dosesPerDay !== undefined) dbUpdates.doses_per_day = updates.dosesPerDay;
    if (updates.daysPerWeek !== undefined) dbUpdates.days_per_week = updates.daysPerWeek;
    if (updates.timingNote !== undefined) dbUpdates.timing_note = updates.timingNote;
    if (updates.cyclingNote !== undefined) dbUpdates.cycling_note = updates.cyclingNote;
    if ('cycleOnDays' in updates) dbUpdates.cycle_on_days = updates.cycleOnDays ?? null;
    if ('cycleOffDays' in updates) dbUpdates.cycle_off_days = updates.cycleOffDays ?? null;
    if ('cycleStartDate' in updates) dbUpdates.cycle_start_date = updates.cycleStartDate ?? null;
    if ('vialSizeMl' in updates) dbUpdates.vial_size_ml = updates.vialSizeMl ?? null;
    if ('weightPerUnit' in updates) dbUpdates.weight_per_unit = updates.weightPerUnit ?? null;
    if (updates.currentQuantity !== undefined) dbUpdates.current_quantity = updates.currentQuantity;
    if (updates.purchaseDate !== undefined) dbUpdates.purchase_date = updates.purchaseDate;
    if (updates.reorderQuantity !== undefined) dbUpdates.reorder_quantity = updates.reorderQuantity;
    if (updates.reorderType !== undefined) dbUpdates.reorder_type = updates.reorderType;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    const { error } = await supabase
      .from('user_compounds')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      console.error('Failed to update compound:', error);
      fetchCompounds();
    }
  }, [fetchCompounds]);

  const addCompound = useCallback(async (compound: Compound) => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('user_compounds')
      .insert({
        user_id: userId,
        compound_id: compound.id,
        name: compound.name,
        category: compound.category,
        unit_size: compound.unitSize,
        unit_label: compound.unitLabel,
        unit_price: compound.unitPrice,
        kit_price: compound.kitPrice ?? null,
        dose_per_use: compound.dosePerUse,
        dose_label: compound.doseLabel,
        bacstat_per_vial: compound.bacstatPerVial ?? null,
        recon_volume: compound.reconVolume ?? null,
        doses_per_day: compound.dosesPerDay,
        days_per_week: compound.daysPerWeek,
        timing_note: compound.timingNote ?? null,
        cycling_note: compound.cyclingNote ?? null,
        cycle_on_days: compound.cycleOnDays ?? null,
        cycle_off_days: compound.cycleOffDays ?? null,
        cycle_start_date: compound.cycleStartDate ?? null,
        vial_size_ml: compound.vialSizeMl ?? null,
        weight_per_unit: compound.weightPerUnit ?? null,
        current_quantity: compound.currentQuantity,
        purchase_date: compound.purchaseDate || null,
        reorder_quantity: compound.reorderQuantity,
        notes: compound.notes ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to add compound:', error);
    }
    // Always refetch to get the correct DB-generated ID
    await fetchCompounds();
  }, [userId, fetchCompounds]);

  const deleteCompound = useCallback(async (id: string) => {
    setCompounds(prev => prev.filter(c => c.id !== id));

    const { error } = await supabase
      .from('user_compounds')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete compound:', error);
      fetchCompounds();
    }
  }, [fetchCompounds]);

  return { compounds, loading, hasCompounds, updateCompound, addCompound, deleteCompound, refetch: fetchCompounds };
}
