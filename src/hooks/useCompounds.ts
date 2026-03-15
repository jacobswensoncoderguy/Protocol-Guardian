import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Compound, CompoundCategory, normalizeCompoundUnitLabel, getDerivedWeightPerUnitMg } from '@/data/compounds';

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
  weight_unit: string | null;
  paused_at: string | null;
  pause_restart_date: string | null;
  depletion_action: string | null;
  solvent_type: string | null;
  solvent_volume: number | null;
  solvent_unit: string | null;
  resulting_concentration: number | null;
  concentration_unit: string | null;
  storage_instructions: string | null;
  prep_notes: string | null;
}

function normalizeCompoundForApp(compound: Compound): Compound {
  const normalizedUnitLabel = normalizeCompoundUnitLabel(compound.unitLabel, compound.category);
  const normalized = { ...compound, unitLabel: normalizedUnitLabel };
  const derivedWeightPerUnit = getDerivedWeightPerUnitMg(normalized);
  const resolvedWeightPerUnit = normalized.weightPerUnit ?? derivedWeightPerUnit;

  // Safety net for legacy/bad writes: avoid active compounds with zero dose breaking
  // schedule display, remaining math, reorder, and costs.
  const hasMissingDose =
    (normalized.dosePerUse ?? 0) <= 0 &&
    (normalized.dosesPerDay ?? 0) > 0 &&
    (normalized.daysPerWeek ?? 0) > 0;
  const countLikeUnit = /\b(cap|caps|pill|pills|tab|tabs|softgel|softgels|serving|servings|scoop|scoops|unit|units|drop|drops|spray|sprays|patch|patches)\b/i.test(normalizedUnitLabel);

  let resolvedDosePerUse = normalized.dosePerUse;
  let resolvedDoseLabel = normalized.doseLabel;

  if (hasMissingDose) {
    if (resolvedWeightPerUnit && resolvedWeightPerUnit > 0) {
      resolvedDosePerUse = resolvedWeightPerUnit;
      resolvedDoseLabel = 'mg';
    } else if (countLikeUnit) {
      resolvedDosePerUse = 1;
      resolvedDoseLabel = normalizedUnitLabel;
    }
  }

  return {
    ...normalized,
    dosePerUse: resolvedDosePerUse,
    doseLabel: resolvedDoseLabel,
    weightPerUnit: resolvedWeightPerUnit,
    weightUnit: normalized.weightUnit ?? (resolvedWeightPerUnit ? 'mg' : undefined),
  };
}

function dbToCompound(row: DbUserCompound): Compound {
  const compound = normalizeCompoundForApp({
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
    weightUnit: row.weight_unit ?? undefined,
    pausedAt: row.paused_at ?? undefined,
    pauseRestartDate: row.pause_restart_date ?? undefined,
    complianceDoseOffset: (row as any).compliance_dose_offset ?? 0,
    depletionAction: (row.depletion_action as 'pause' | 'dormant' | null) ?? null,
    solventType: row.solvent_type ?? undefined,
    solventVolume: row.solvent_volume ?? undefined,
    solventUnit: row.solvent_unit ?? undefined,
    resultingConcentration: row.resulting_concentration ?? undefined,
    concentrationUnit: row.concentration_unit ?? undefined,
    storageInstructions: row.storage_instructions ?? undefined,
    prepNotes: row.prep_notes ?? undefined,
  });

  // Auto-derive bacstatPerVial for peptides if missing (B2 fix)
  if (
    compound.category === 'peptide' &&
    compound.reconVolume && compound.reconVolume > 0 &&
    (!compound.bacstatPerVial || compound.bacstatPerVial <= 0)
  ) {
    compound.bacstatPerVial = compound.reconVolume * 100;
  }

  return compound;
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

  // Realtime subscription — any change to this user's compounds instantly re-syncs all views
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user_compounds:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_compounds',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Refetch on any INSERT/UPDATE/DELETE so schedule, inventory, costs all stay in sync
          fetchCompounds();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchCompounds]);

  const updateCompound = useCallback(async (id: string, updates: Partial<Compound>) => {
    setCompounds(prev => prev.map(c => c.id === id ? normalizeCompoundForApp({ ...c, ...updates }) : c));

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
    if ('weightUnit' in updates) dbUpdates.weight_unit = updates.weightUnit ?? null;
    if (updates.currentQuantity !== undefined) dbUpdates.current_quantity = updates.currentQuantity;
    if (updates.purchaseDate !== undefined) dbUpdates.purchase_date = updates.purchaseDate;
    if (updates.reorderQuantity !== undefined) dbUpdates.reorder_quantity = updates.reorderQuantity;
    if (updates.reorderType !== undefined) dbUpdates.reorder_type = updates.reorderType;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if ('pausedAt' in updates) dbUpdates.paused_at = updates.pausedAt ?? null;
    if ('pauseRestartDate' in updates) dbUpdates.pause_restart_date = updates.pauseRestartDate ?? null;
    if (updates.complianceDoseOffset !== undefined) dbUpdates.compliance_dose_offset = updates.complianceDoseOffset;
    if ('depletionAction' in updates) dbUpdates.depletion_action = updates.depletionAction ?? null;
    if ('solventType' in updates) dbUpdates.solvent_type = updates.solventType ?? null;
    if ('solventVolume' in updates) dbUpdates.solvent_volume = updates.solventVolume ?? null;
    if ('solventUnit' in updates) dbUpdates.solvent_unit = updates.solventUnit ?? null;
    if ('resultingConcentration' in updates) dbUpdates.resulting_concentration = updates.resultingConcentration ?? null;
    if ('concentrationUnit' in updates) dbUpdates.concentration_unit = updates.concentrationUnit ?? null;
    if ('storageInstructions' in updates) dbUpdates.storage_instructions = updates.storageInstructions ?? null;
    if ('prepNotes' in updates) dbUpdates.prep_notes = updates.prepNotes ?? null;
    if (updates.containerVolumeMl !== undefined) dbUpdates.container_volume_ml = updates.containerVolumeMl ?? null;
    if (updates.mlPerSpray !== undefined) dbUpdates.ml_per_spray = updates.mlPerSpray ?? null;
    if (updates.spraysPerDose !== undefined) dbUpdates.sprays_per_dose = updates.spraysPerDose ?? null;

    // Auto-derive bacstatPerVial for peptides (B2 fix)
    const mergedCategory = (updates.category ?? compounds.find(c => c.id === id)?.category) || '';
    const mergedReconVolume = updates.reconVolume ?? compounds.find(c => c.id === id)?.reconVolume;
    if (mergedCategory === 'peptide' && mergedReconVolume && mergedReconVolume > 0) {
      dbUpdates.bacstat_per_vial = mergedReconVolume * 100;
    }

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
        bacstat_per_vial: compound.category === 'peptide' && compound.reconVolume && compound.reconVolume > 0
          ? compound.reconVolume * 100
          : (compound.bacstatPerVial ?? null),
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
        weight_unit: compound.weightUnit ?? null,
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
