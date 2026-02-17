import { Compound, getNormalizedDailyConsumption } from '@/data/compounds';

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
 * Determine the current cycling status of a compound.
 * If the compound has no cycle data, it's always ON with onFraction = 1.
 */
export function getCycleStatus(compound: Compound, referenceDate: Date = new Date()): CycleStatus {
  if (!compound.cycleOnDays || !compound.cycleOffDays || !compound.cycleStartDate) {
    return { hasCycle: false, isOn: true, daysLeftInPhase: 999, phaseLabel: 'Active', onFraction: 1 };
  }

  const cycleLength = compound.cycleOnDays + compound.cycleOffDays;
  const start = new Date(compound.cycleStartDate);
  const diffMs = referenceDate.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

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
 * Get the effective daily consumption adjusted for cycling.
 * During OFF phases the compound isn't consumed, so the average daily burn
 * over a full cycle is reduced by the onFraction.
 */
export function getEffectiveDailyConsumption(compound: Compound): number {
  const rawDaily = getNormalizedDailyConsumption(compound);
  const { onFraction } = getCycleStatus(compound);
  return rawDaily * onFraction;
}

/**
 * Calculate days remaining accounting for cycling ON/OFF periods.
 * During OFF periods, no supply is consumed. This walks forward day-by-day
 * through the cycle to get an accurate depletion forecast.
 */
export function getDaysRemainingWithCycling(compound: Compound): number {
  const rawDaily = getNormalizedDailyConsumption(compound);
  if (rawDaily === 0) return 999;

  const totalSupply = compound.category === 'peptide' && compound.bacstatPerVial
    ? compound.currentQuantity * compound.bacstatPerVial
    : compound.category === 'injectable-oil' && compound.vialSizeMl
      ? compound.currentQuantity * compound.unitSize * compound.vialSizeMl
      : compound.currentQuantity * compound.unitSize;

  if (!compound.cycleOnDays || !compound.cycleOffDays || !compound.cycleStartDate) {
    // No cycling — simple division
    return Math.max(0, Math.floor(totalSupply / rawDaily));
  }

  // Walk forward through cycle to account for OFF days
  const cycleLength = compound.cycleOnDays + compound.cycleOffDays;
  const start = new Date(compound.cycleStartDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const startDayInCycle = ((Math.floor(diffMs / (24 * 60 * 60 * 1000)) % cycleLength) + cycleLength) % cycleLength;

  let remaining = totalSupply;
  let day = 0;

  while (remaining > 0 && day < 3650) { // cap at 10 years
    const dayInCycle = (startDayInCycle + day) % cycleLength;
    const isOn = dayInCycle < compound.cycleOnDays;
    if (isOn) {
      remaining -= rawDaily;
    }
    day++;
  }

  return Math.max(0, day - 1);
}
