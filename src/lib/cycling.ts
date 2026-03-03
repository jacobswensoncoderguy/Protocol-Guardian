import { Compound, getNormalizedDailyConsumption, getEffectiveQuantity, totalSupplyInDoseUnits } from '@/data/compounds';

export type ComplianceInfo = { checkedDoses: number; firstCheckDate: string | null; lastCheckDate: string | null };

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
export function getEffectiveDailyConsumption(compound: Compound, compliance?: ComplianceInfo): number {
  if (isPaused(compound)) return 0;
  const rawDaily = getNormalizedDailyConsumption(compound);
  const { onFraction } = getCycleStatus(compound);
  let adjusted = rawDaily * onFraction;

  // Scale by compliance rate if available
  if (compliance && compliance.firstCheckDate && compliance.lastCheckDate) {
    const first = new Date(compliance.firstCheckDate);
    const last = new Date(compliance.lastCheckDate);
    first.setHours(0, 0, 0, 0);
    last.setHours(0, 0, 0, 0);
    const trackingDays = Math.max(1, Math.floor((last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    const daysPerWeek = Math.min(7, Math.max(0, compound.daysPerWeek || 0));
    const expectedDoses = compound.dosesPerDay * trackingDays * (daysPerWeek / 7);
    if (expectedDoses > 0) {
      const complianceRate = Math.min(1, compliance.checkedDoses / expectedDoses);
      adjusted *= complianceRate;
    }
  }

  return adjusted;
}

/**
 * Calculate days remaining accounting for cycling ON/OFF periods and pause.
 * Paused compounds don't deplete, so days remaining is effectively infinite while paused.
 */
export function getDaysRemainingWithCycling(compound: Compound, compliance?: ComplianceInfo): number {
  if (isPaused(compound)) return 999;

  // Use getNormalizedDailyConsumption which correctly converts weight-based doses
  // to container units (pills) for oral/powder compounds
  const normalizedDaily = getNormalizedDailyConsumption(compound); // avg daily in container units
  if (normalizedDaily <= 0) return 999;

  const daysPerWeek = Math.min(7, Math.max(0, compound.daysPerWeek || 0));
  if (daysPerWeek === 0) return 999;

  // dosePerActiveDay in container units (undo the weekly averaging from getNormalizedDailyConsumption)
  const dosePerActiveDay = normalizedDaily * (7 / daysPerWeek);

  // Use effective quantity (adjusted for actual usage via compliance data)
  const effectiveQty = getEffectiveQuantity(compound, compliance);

  // Total supply in the same dose units as normalizedDaily (handles volume→drops, peptide IU, etc.)
  const totalSupply = totalSupplyInDoseUnits(compound, effectiveQty);

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
