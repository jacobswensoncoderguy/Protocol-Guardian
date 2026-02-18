import { Compound, getNormalizedDailyConsumption, getEffectiveQuantity } from '@/data/compounds';

export interface CycleStatus {
  /** Whether this compound has a cycling pattern at all */
  hasCycle: boolean;
  /** Whether the compound is currently in its ON phase */
  isOn: boolean;
  /** Days remaining in the current phase (ON or OFF) */
  daysLeftInPhase: number;
  /** Label for the current phase */
  phaseLabel: string;
  /** Fraction of time spent ON over a full cycle (used to adjust consumption) */
  onFraction: number;
}

/**
 * Check if a compound is currently paused.
 * Returns true if paused and either no restart date or restart date is in the future.
 */
export function isPaused(compound: Compound, referenceDate: Date = new Date()): boolean {
  if (!compound.pausedAt) return false;
  if (!compound.pauseRestartDate) return true; // paused indefinitely
  const restart = new Date(compound.pauseRestartDate);
  restart.setHours(0, 0, 0, 0);
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  return ref < restart;
}

/**
 * Get the number of days a compound has been paused (used for cycle offset).
 */
export function getPausedDays(compound: Compound, referenceDate: Date = new Date()): number {
  if (!compound.pausedAt) return 0;
  const pauseStart = new Date(compound.pausedAt);
  const end = compound.pauseRestartDate && new Date(compound.pauseRestartDate) < referenceDate
    ? new Date(compound.pauseRestartDate)
    : referenceDate;
  return Math.max(0, Math.floor((end.getTime() - pauseStart.getTime()) / (24 * 60 * 60 * 1000)));
}

/**
 * Determine the current cycling status of a compound.
 * If the compound has no cycle data, it's always ON with onFraction = 1.
 * If paused, adjusts cycle position by excluding pause duration.
 */
export function getCycleStatus(compound: Compound, referenceDate: Date = new Date()): CycleStatus {
  if (!compound.cycleOnDays || !compound.cycleOffDays || !compound.cycleStartDate) {
    return { hasCycle: false, isOn: true, daysLeftInPhase: 999, phaseLabel: 'Active', onFraction: 1 };
  }

  const cycleLength = compound.cycleOnDays + compound.cycleOffDays;
  const start = new Date(compound.cycleStartDate);
  const diffMs = referenceDate.getTime() - start.getTime();
  let diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  // Subtract paused days so cycle resumes from where it left off
  diffDays -= getPausedDays(compound, referenceDate);

  // Handle dates before cycle start — treat as ON from day 0
  const dayInCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength;

  const isOn = dayInCycle < compound.cycleOnDays;
  const daysLeftInPhase = isOn
    ? compound.cycleOnDays - dayInCycle
    : cycleLength - dayInCycle;

  const onFraction = compound.cycleOnDays / cycleLength;

  return {
    hasCycle: true,
    isOn,
    daysLeftInPhase,
    phaseLabel: isOn ? `ON (${daysLeftInPhase}d left)` : `OFF (${daysLeftInPhase}d left)`,
    onFraction,
  };
}

/**
 * Get the effective daily consumption adjusted for cycling and pause state.
 * Paused compounds consume nothing. During cycling OFF phases, average is reduced.
 */
export function getEffectiveDailyConsumption(compound: Compound): number {
  if (isPaused(compound)) return 0;
  const rawDaily = getNormalizedDailyConsumption(compound);
  const { onFraction } = getCycleStatus(compound);
  return rawDaily * onFraction;
}

/**
 * Calculate days remaining accounting for cycling ON/OFF periods and pause.
 * Paused compounds don't deplete, so days remaining is effectively infinite while paused.
 */
export function getDaysRemainingWithCycling(compound: Compound): number {
  if (isPaused(compound)) return 999;

  const dosePerActiveDay = compound.dosePerUse * compound.dosesPerDay;
  if (dosePerActiveDay === 0) return 999;
  const daysPerWeek = Math.min(7, Math.max(0, compound.daysPerWeek || 0));
  if (daysPerWeek === 0) return 999;

  // Use effective quantity (adjusted for usage since purchaseDate)
  const effectiveQty = getEffectiveQuantity(compound);

  // Total supply in raw dose units
  const totalSupply = compound.category === 'peptide' && compound.bacstatPerVial
    ? effectiveQty * compound.bacstatPerVial
    : compound.category === 'injectable-oil' && compound.vialSizeMl
      ? effectiveQty * compound.unitSize * compound.vialSizeMl
      : effectiveQty * compound.unitSize;

  if (!compound.cycleOnDays || !compound.cycleOffDays || !compound.cycleStartDate) {
    // No cycling — apply daysPerWeek fraction
    const dailyRate = dosePerActiveDay * (daysPerWeek / 7);
    return Math.max(0, Math.floor(totalSupply / dailyRate));
  }

  // With cycling: walk forward through cycle days, consuming only on ON + active days
  const cycleLength = compound.cycleOnDays + compound.cycleOffDays;
  const start = new Date(compound.cycleStartDate);
  const now = new Date();
  let diffMs = now.getTime() - start.getTime();
  let startDiffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  startDiffDays -= getPausedDays(compound, now);
  const startDayInCycle = ((startDiffDays % cycleLength) + cycleLength) % cycleLength;

  const onFraction = daysPerWeek / 7;
  let remaining = totalSupply;
  let day = 0;

  while (remaining > 0 && day < 3650) { // cap at 10 years
    const dayInCycle = (startDayInCycle + day) % cycleLength;
    const isOn = dayInCycle < compound.cycleOnDays;
    if (isOn) {
      remaining -= dosePerActiveDay * onFraction;
    }
    day++;
  }

  return Math.max(0, day - 1);
}
