import { Compound } from '@/data/compounds';

export interface CompoundCriticalError {
  field: string;
  message: string;
}

/**
 * Returns the list of critical-field errors for a single compound.
 * Mirrors the validation logic in CompoundEditWizard so that any
 * consumer (banner, card badge, etc.) can re-use it without coupling
 * to the wizard component.
 */
export function getCompoundCriticalErrors(c: Compound): CompoundCriticalError[] {
  const errors: CompoundCriticalError[] = [];

  if (!(c.name || '').trim())
    errors.push({ field: 'name', message: 'Required to identify this compound' });

  if (!c.daysPerWeek || c.daysPerWeek <= 0)
    errors.push({ field: 'daysPerWeek', message: 'Required to calculate supply duration' });

  if (!c.dosesPerDay || c.dosesPerDay <= 0)
    errors.push({ field: 'dosesPerDay', message: 'Required to calculate daily consumption' });

  if (c.currentQuantity == null || c.currentQuantity < 0)
    errors.push({ field: 'currentQuantity', message: 'Required to calculate supply remaining' });

  if (!c.unitSize || c.unitSize <= 0)
    errors.push({ field: 'unitSize', message: 'Required for container capacity' });

  if (!c.weightPerUnit || c.weightPerUnit <= 0)
    errors.push({ field: 'weightPerUnit', message: 'Required for depletion math' });

  if (!c.dosePerUse || c.dosePerUse <= 0)
    errors.push({ field: 'dosePerUse', message: 'Required for consumption calculation' });

  // Cycling fields — only critical when cycling is enabled
  const hasCycling = (c.cycleOnDays && c.cycleOnDays > 0) || (c.cycleOffDays && c.cycleOffDays > 0);
  if (hasCycling) {
    if (!c.cycleOnDays || c.cycleOnDays <= 0)
      errors.push({ field: 'cycleOnDays', message: 'Required for cycle calculation' });
    if (!c.cycleOffDays || c.cycleOffDays <= 0)
      errors.push({ field: 'cycleOffDays', message: 'Required for cycle calculation' });
  }

  return errors;
}

/** Returns true if the compound is dormant or paused */
export function isCompoundInactive(c: Compound): boolean {
  return !!(c.pausedAt || c.notes?.includes('[DORMANT]'));
}

/** Returns the count of missing critical fields for active compounds only */
export function getCompoundsNeedingAttention(compounds: Compound[]): { compound: Compound; errorCount: number }[] {
  return compounds
    .filter(c => !isCompoundInactive(c) && !!c.purchaseDate)
    .map(c => ({ compound: c, errorCount: getCompoundCriticalErrors(c).length }))
    .filter(item => item.errorCount > 0);
}
