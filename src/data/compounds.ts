export type CompoundCategory = 'peptide' | 'injectable-oil' | 'oral' | 'powder' | 'prescription' | 'vitamin' | 'holistic' | 'adaptogen' | 'nootropic' | 'essential-oil' | 'alternative-medicine' | 'probiotic' | 'topical';

export type CompoundStatus = 'good' | 'warning' | 'critical';

export interface Compound {
  id: string;
  name: string;
  category: CompoundCategory;
  // Vial/bottle info
  unitSize: number; // For oils: mg/mL concentration. For peptides: mg per vial. For orals/powders: count per bottle.
  unitLabel: string; // "mg vial", "mg/mL", "caps", "servings"
  unitPrice: number; // per-unit price (per vial for oils, per bottle for orals/powders)
  kitPrice?: number; // peptides only: price per kit (10 vials)
  vialSizeMl?: number; // oils only: vial volume in mL (e.g. 10)
  // Dosing
  dosePerUse: number;
  doseLabel: string; // "IU", "mg", "caps", "g"
  // Reconstitution (peptides only)
  bacstatPerVial?: number; // total IU per reconstituted vial (e.g. 200 for 2mL, 300 for 3mL)
  reconVolume?: number; // mL of bacstat water used to reconstitute
  // Scheduling
  dosesPerDay: number;
  daysPerWeek: number;
  timingNote?: string;
  cyclingNote?: string;
  // Cycling ON/OFF
  cycleOnDays?: number;
  cycleOffDays?: number;
  cycleStartDate?: string; // ISO date when current cycle started
  // Pause
  pausedAt?: string; // ISO timestamp when compound was paused
  pauseRestartDate?: string; // ISO date when compound should auto-resume (optional)
  // Inventory
  currentQuantity: number;
  purchaseDate: string; // ISO date (used for orals/powders only)
  reorderQuantity: number; // for peptides: number of kits; for others: number of units
  reorderType?: 'single' | 'kit'; // whether reorder quantity is single units or kits
  notes?: string;
  weightPerUnit?: number; // mg per individual unit (pill, cap, tab, scoop) for non-injectable compounds
  weightUnit?: string; // display unit for weightPerUnit ('g', 'mg', 'mcg', 'oz', 'lb')
  complianceDoseOffset?: number; // check-offs already accounted for before current stock period
  depletionAction?: 'pause' | 'dormant' | null; // action to take when stock runs out
  // Dilution / reconstitution
  solventType?: string;        // e.g. "Bacteriostatic Water", "RO Water"
  solventVolume?: number;      // e.g. 2
  solventUnit?: string;        // e.g. "mL", "oz"
  resultingConcentration?: number;
  concentrationUnit?: string;  // e.g. "mg/mL"
  storageInstructions?: string;
  prepNotes?: string;
}

const CONTAINER_TAG_REGEX = /\[CONTAINER:(bag|bottle)\]/i;
const COUNT_UNIT_REGEX = /\b(cap|caps|capsule|capsules|pill|pills|tab|tabs|tablet|tablets|softgel|softgels|serving|servings|scoop|scoops|unit|units)\b/i;
const POWDER_CONTAINER_HINT_REGEX = /\b(scoop|scoops|serving|servings|powder)\b/i;
const WEIGHT_HINT_REGEX = /(\d+(?:\.\d+)?)\s*(mcg|µg|mg|g)\b/i;

function toMg(value: number, unit: string): number {
  const normalized = unit.toLowerCase();
  if (normalized === 'mcg' || normalized === 'µg') return value / 1000;
  if (normalized === 'g') return value * 1000;
  return value;
}

export function normalizeCompoundUnitLabel(unitLabel: string | null | undefined, category?: CompoundCategory): string {
  const raw = (unitLabel || '').trim();
  if (!raw) return category === 'powder' ? 'servings' : 'caps';

  const lower = raw.toLowerCase();
  if (lower.includes('mg/ml')) return 'mg/mL';
  if (/\bmg\s*vial\b/i.test(raw)) return 'mg vial';
  if (/\bml\s*vial\b/i.test(raw)) return 'mL vial';
  if (/\b(capsule|capsules|cap|caps)\b/i.test(raw)) return 'caps';
  if (/\b(softgel|softgels)\b/i.test(raw)) return 'softgels';
  if (/\b(tab|tabs|tablet|tablets)\b/i.test(raw)) return 'tabs';
  if (/\b(pill|pills)\b/i.test(raw)) return 'pills';
  if (/\b(serving|servings)\b/i.test(raw)) return 'servings';
  if (/\b(scoop|scoops)\b/i.test(raw)) return 'scoops';
  if (/\b(drop|drops)\b/i.test(raw)) return 'drops';
  if (/\b(unit|units)\b/i.test(raw)) return 'units';
  if (/\b(spray|sprays)\b/i.test(raw)) return 'sprays';
  if (/\b(patch|patches)\b/i.test(raw)) return 'patches';
  if (/^iu$/i.test(raw)) return 'IU';
  if (/^ml$/i.test(raw)) return 'mL';
  if (/^fl\s*oz$/i.test(raw)) return 'fl oz';
  if (/^oz$/i.test(raw)) return 'oz';
  return raw;
}

export function getCompoundContainerKind(compound: Pick<Compound, 'category' | 'unitLabel' | 'notes'>): 'bag' | 'bottle' {
  const notesMatch = (compound.notes || '').match(CONTAINER_TAG_REGEX);
  if (notesMatch) return notesMatch[1].toLowerCase() as 'bag' | 'bottle';

  const normalizedLabel = normalizeCompoundUnitLabel(compound.unitLabel, compound.category).toLowerCase();
  if (compound.category === 'powder' || POWDER_CONTAINER_HINT_REGEX.test(normalizedLabel)) return 'bag';
  return 'bottle';
}

export function getDerivedWeightPerUnitMg(compound: Pick<Compound, 'category' | 'unitLabel' | 'doseLabel' | 'dosePerUse' | 'weightPerUnit'>): number | undefined {
  if (compound.category === 'peptide' || compound.category === 'injectable-oil') return undefined;
  if (compound.weightPerUnit && compound.weightPerUnit > 0) return compound.weightPerUnit;

  const normalizedLabel = normalizeCompoundUnitLabel(compound.unitLabel, compound.category).toLowerCase();
  if (!COUNT_UNIT_REGEX.test(normalizedLabel)) return undefined;

  const explicitWeight = (compound.unitLabel || '').match(WEIGHT_HINT_REGEX);
  if (explicitWeight) {
    const parsed = parseFloat(explicitWeight[1]);
    if (!isNaN(parsed) && parsed > 0) {
      return toMg(parsed, explicitWeight[2]);
    }
  }

  const dl = (compound.doseLabel || '').toLowerCase();
  if (dl.includes('mg') || dl.includes('mcg') || dl.includes('µg') || dl === 'g') {
    const inferred = toMg(compound.dosePerUse, dl.includes('mcg') || dl.includes('µg') ? 'mcg' : dl === 'g' ? 'g' : 'mg');
    return inferred > 0 ? inferred : undefined;
  }

  return undefined;
}

/**
 * Normalize daily consumption to native container units (pills, caps, servings)
 * for oral/powder compounds. When dosePerUse is stored in weight units (mg, mcg, g)
 * but unitSize is a count (pills per bottle), convert via weightPerUnit.
 */
export function getNormalizedDailyConsumption(compound: Compound): number {
  const rawDaily = (compound.dosePerUse * compound.dosesPerDay * compound.daysPerWeek) / 7;
  if (compound.category === 'peptide' || compound.category === 'injectable-oil') return rawDaily;

  const dl = compound.doseLabel.toLowerCase();
  const isWeightDose = dl.includes('mg') || dl.includes('mcg') || dl.includes('µg') || dl === 'g';
  const weightPerUnitMg = getDerivedWeightPerUnitMg(compound);

  if (isWeightDose && weightPerUnitMg && weightPerUnitMg > 0) {
    // Convert weight-based dose to pill/cap count
    let doseMg = compound.dosePerUse;
    if (dl.includes('mcg') || dl.includes('µg')) doseMg = compound.dosePerUse / 1000;
    else if (dl === 'g') doseMg = compound.dosePerUse * 1000;
    const pillsPerDose = doseMg / weightPerUnitMg;
    return (pillsPerDose * compound.dosesPerDay * compound.daysPerWeek) / 7;
  }

  // Non-weight, non-count dose (e.g. IU) on count-based containers (caps, tabs, etc.)
  // The dose is expressed in a unit that doesn't match the container's count units.
  // Assume 1 container-unit per dose (e.g. 1 cap per dose of 5000 IU).
  // Return consumption in container-count units so it matches totalSupplyInDoseUnits.
  const normalizedUnitLabel = normalizeCompoundUnitLabel(compound.unitLabel, compound.category).toLowerCase();
  const isCountContainer = COUNT_UNIT_REGEX.test(normalizedUnitLabel);
  const isCountDose = COUNT_UNIT_REGEX.test(dl);
  const isDropDose = dl === 'drops' || dl === 'drop';

  if (!isWeightDose && !isCountDose && !isDropDose && isCountContainer && compound.dosePerUse > 0) {
    // Return dosesPerDay in container units (1 unit per dose)
    return (compound.dosesPerDay * compound.daysPerWeek) / 7;
  }

  return rawDaily;
}

/**
 * Compute how many native supply units (IU for peptides, mg for oils, pills/scoops etc
 * for orals/powders) have been consumed since the purchaseDate.
 *
 * When `compliance` data is provided, the calculation is split:
 *   - Before the first check-off date: theoretical consumption (assume all taken)
 *   - From the first check-off onward: actual checked doses × dosePerUse
 * When no compliance data is provided, falls back to fully theoretical calculation.
 */
export function getConsumedSinceDate(
  compound: Compound,
  referenceDate: Date = new Date(),
  compliance?: { checkedDoses: number; firstCheckDate: string | null; lastCheckDate: string | null }
): number {
  const now = new Date(referenceDate);
  now.setHours(0, 0, 0, 0);

  // If we have compliance data with actual check-offs, always use it
  // (even without a purchaseDate — checked doses are ground truth)
  if (compliance && compliance.firstCheckDate && compliance.checkedDoses > 0) {
    const firstCheck = new Date(compliance.firstCheckDate);
    firstCheck.setHours(0, 0, 0, 0);

    // If we also have a purchaseDate, add theoretical consumption for the pre-tracking period
    let theoreticalPreTracking = 0;
    if (compound.purchaseDate) {
      const purchaseDay = new Date(compound.purchaseDate);
      purchaseDay.setHours(0, 0, 0, 0);
      const preTrackingDays = Math.max(0, Math.floor((firstCheck.getTime() - purchaseDay.getTime()) / (24 * 60 * 60 * 1000)));
      if (preTrackingDays > 0) {
        theoreticalPreTracking = getTheoreticalConsumption(compound, preTrackingDays, purchaseDay);
      }
    }

    // Actual consumption = checked doses (minus offset for prior stock) × dose per use
    const offset = compound.complianceDoseOffset || 0;
    const effectiveCheckedDoses = Math.max(0, compliance.checkedDoses - offset);
    const actualPostTracking = effectiveCheckedDoses * compound.dosePerUse;
    return theoreticalPreTracking + actualPostTracking;
  }

  // No compliance data — fall back to theoretical consumption from purchaseDate
  if (!compound.purchaseDate) return 0;

  const purchaseDay = new Date(compound.purchaseDate);
  purchaseDay.setHours(0, 0, 0, 0);
  const daysSincePurchase = Math.floor((now.getTime() - purchaseDay.getTime()) / (24 * 60 * 60 * 1000));
  if (daysSincePurchase <= 0) return 0;

  return getTheoreticalConsumption(compound, daysSincePurchase, purchaseDay);
}

/**
 * Calculate theoretical consumption for a given number of days from a start date.
 * Extracted to share between compliance-aware and fallback paths.
 */
function getTheoreticalConsumption(compound: Compound, dayCount: number, fromDate: Date): number {
  if (dayCount <= 0) return 0;

  const dosePerActiveDay = compound.dosePerUse * compound.dosesPerDay;
  if (dosePerActiveDay === 0) return 0;

  const daysPerWeek = Math.min(7, Math.max(0, compound.daysPerWeek || 0));

  // No cycling: scale by daysPerWeek fraction
  if (!compound.cycleOnDays || !compound.cycleOffDays || !compound.cycleStartDate) {
    const activeDays = dayCount * (daysPerWeek / 7);
    return dosePerActiveDay * activeDays;
  }

  // With cycling: walk each day and only count ON days
  const cycleLength = compound.cycleOnDays + compound.cycleOffDays;
  const cycleStart = new Date(compound.cycleStartDate);
  const onFraction = daysPerWeek / 7;
  let consumed = 0;

  for (let d = 0; d < dayCount; d++) {
    const dayDate = new Date(fromDate.getTime() + d * 24 * 60 * 60 * 1000);
    const diffDays = Math.floor((dayDate.getTime() - cycleStart.getTime()) / (24 * 60 * 60 * 1000));
    const dayInCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength;
    if (dayInCycle < compound.cycleOnDays) {
      consumed += dosePerActiveDay * onFraction;
    }
  }

  return consumed;
}

/**
 * Standard conversion: 20 drops per mL (standard dropper).
 */
const DROPS_PER_ML = 20;

/**
 * Standard insulin syringe: 100 IU markings = 1 mL.
 * Used to convert IU (syringe units) to mL for injectable oils.
 */
const SYRINGE_IU_PER_ML = 100;

function isVolumeUnit(unit: string): boolean {
  return ['ml', 'floz', 'fl oz', 'oz'].includes(unit.toLowerCase().replace(/\s+/g, ''));
}

function toMl(value: number, unit: string): number {
  const u = unit.toLowerCase().replace(/\s+/g, '');
  if (u === 'floz' || u === 'fl oz') return value * 29.5735;
  if (u === 'oz') return value * 29.5735; // treat oz as fl oz for liquids
  return value; // already mL
}

/**
 * Convert consumed dose units back to container units (vials, bottles).
 * Handles volume-to-drops conversion when unitLabel is a volume and doseLabel is drops.
 */
export function consumedToContainerUnits(compound: Compound, consumed: number): number {
  if (compound.category === 'peptide' && compound.bacstatPerVial) {
    return consumed / compound.bacstatPerVial;
  }
  if (compound.category === 'injectable-oil' && compound.vialSizeMl && compound.unitSize) {
    const dl = (compound.doseLabel ?? '').toLowerCase();
    if (dl === 'iu') {
      return (consumed / SYRINGE_IU_PER_ML) / compound.vialSizeMl;
    }
    if (dl === 'mg') {
      return (consumed / compound.unitSize) / compound.vialSizeMl;
    }
    if (dl === 'ml') {
      return consumed / compound.vialSizeMl;
    }
    return 0;
  }
  // Volume container with drop dosing
  const normalizedUnitLabel = normalizeCompoundUnitLabel(compound.unitLabel, compound.category);
  const ul = normalizedUnitLabel.toLowerCase().replace(/\s+/g, '');
  const dl = compound.doseLabel.toLowerCase();
  if ((dl === 'drops' || dl === 'drop') && isVolumeUnit(ul)) {
    const mlPerContainer = toMl(compound.unitSize, ul);
    const dropsPerContainer = mlPerContainer * DROPS_PER_ML;
    return dropsPerContainer > 0 ? consumed / dropsPerContainer : 0;
  }

  // Weight-based dose on count-based containers (e.g. mg dose + caps per bottle)
  const isWeightDose = dl.includes('mg') || dl.includes('mcg') || dl.includes('µg') || dl === 'g';
  const weightPerUnitMg = getDerivedWeightPerUnitMg(compound);
  if (isWeightDose && weightPerUnitMg && compound.unitSize > 0) {
    let consumedMg = consumed;
    if (dl.includes('mcg') || dl.includes('µg')) consumedMg = consumed / 1000;
    else if (dl === 'g') consumedMg = consumed * 1000;
    const consumedCountUnits = consumedMg / weightPerUnitMg;
    return consumedCountUnits / compound.unitSize;
  }

  // Non-weight, non-count, non-drop dose (e.g. IU) on count-based containers
  // Convert consumed dose-units back to container-units via dosePerUse
  const isCountDose = COUNT_UNIT_REGEX.test(dl);
  const normalizedUL = normalizeCompoundUnitLabel(compound.unitLabel, compound.category).toLowerCase();
  const isCountContainer = COUNT_UNIT_REGEX.test(normalizedUL);
  if (!isWeightDose && !isCountDose && !(dl === 'drops' || dl === 'drop') && isCountContainer && compound.dosePerUse > 0) {
    const numDoses = consumed / compound.dosePerUse; // IU → number of doses
    // Each dose = 1 container-unit (cap/tab); divide by unitSize to get containers
    return compound.unitSize > 0 ? numDoses / compound.unitSize : 0;
  }

  const dl_ctcu = (compound.doseLabel ?? '').toLowerCase();
  const ul_ctcu = (compound.unitLabel ?? '').toLowerCase();

  // Spray compounds
  if (
    (dl_ctcu === 'sprays' || dl_ctcu === 'spray') &&
    compound.containerVolumeMl &&
    compound.mlPerSpray &&
    compound.mlPerSpray > 0
  ) {
    const totalSprays = compound.containerVolumeMl / compound.mlPerSpray;
    return totalSprays > 0 ? consumed / totalSprays : 0;
  }

  // Drop compounds
  if (
    (dl_ctcu === 'drops' || dl_ctcu === 'drop') &&
    compound.unitSize > 0 &&
    (ul_ctcu === 'ml' || ul_ctcu === 'fl oz' || ul_ctcu === 'oz')
  ) {
    const mlPerContainer = ul_ctcu === 'ml'
      ? compound.unitSize
      : compound.unitSize * 29.5735;
    const totalDrops = mlPerContainer * 20;
    return totalDrops > 0 ? consumed / totalDrops : 0;
  }

  // For orals/powders with count-based doses: consumed is already in unit counts
  if (compound.unitSize > 0) {
    return consumed / compound.unitSize;
  }
  return 0;
}

/**
 * Get the effective quantity remaining, accounting for usage since purchaseDate.
 * When compliance data is provided, uses actual check-off consumption.
 * We cap at [0, currentQuantity] to avoid negatives or exceeding what was purchased.
 */
export function getEffectiveQuantity(
  compound: Compound,
  compliance?: { checkedDoses: number; firstCheckDate: string | null; lastCheckDate: string | null }
): number {
  const consumed = getConsumedSinceDate(compound, new Date(), compliance);
  const consumedUnits = consumedToContainerUnits(compound, consumed);
  return Math.max(0, compound.currentQuantity - consumedUnits);
}

/**
 * Get total supply in raw dose units (IU, mg, caps) from effective quantity.
 * Handles volume-to-drops conversion when unitLabel is a volume (mL, fl oz, oz)
 * and doseLabel is drops (standard: 20 drops per mL).
 */
export function totalSupplyInDoseUnits(compound: Compound, effectiveQty: number): number {
  if (compound.category === 'peptide' && compound.bacstatPerVial) {
    return effectiveQty * compound.bacstatPerVial;
  }
  if (compound.category === 'injectable-oil' && compound.vialSizeMl) {
    const dl = (compound.doseLabel ?? '').toLowerCase();
    if (dl === 'iu') {
      return effectiveQty * compound.vialSizeMl * SYRINGE_IU_PER_ML;
    }
    if (dl === 'mg') {
      return effectiveQty * compound.unitSize * compound.vialSizeMl;
    }
    if (dl === 'ml') {
      return effectiveQty * compound.vialSizeMl;
    }
    // Unrecognized doseLabel: return 0
    return 0;
  }
  // Volume container with drop dosing: convert volume to drops
  const ul = compound.unitLabel.toLowerCase().replace(/\s+/g, '');
  const dl = compound.doseLabel.toLowerCase();
  if ((dl === 'drops' || dl === 'drop') && isVolumeUnit(ul)) {
    const mlPerContainer = toMl(compound.unitSize, ul);
    return effectiveQty * mlPerContainer * DROPS_PER_ML;
  }
  const dl_tsidu = (compound.doseLabel ?? '').toLowerCase();
  const ul_tsidu = (compound.unitLabel ?? '').toLowerCase();

  // Spray compounds
  if (
    (dl_tsidu === 'sprays' || dl_tsidu === 'spray') &&
    compound.containerVolumeMl &&
    compound.mlPerSpray &&
    compound.mlPerSpray > 0
  ) {
    return effectiveQty * (compound.containerVolumeMl / compound.mlPerSpray);
  }

  // Drop compounds (verify formula: effectiveQty × unitSize_mL × 20)
  if (
    (dl_tsidu === 'drops' || dl_tsidu === 'drop') &&
    compound.unitSize > 0 &&
    (ul_tsidu === 'ml' || ul_tsidu === 'fl oz' || ul_tsidu === 'oz')
  ) {
    const mlPerContainer = ul_tsidu === 'ml'
      ? compound.unitSize
      : compound.unitSize * 29.5735;
    return effectiveQty * mlPerContainer * 20;
  }

  // orals/powders: effectiveQty is in containers, unitSize = units per container
  return effectiveQty * compound.unitSize;
}

export function getStatus(daysRemaining: number): CompoundStatus {
  if (daysRemaining > 30) return 'good';
  if (daysRemaining > 7) return 'warning';
  return 'critical';
}

export function getReorderCost(compound: Compound): number {
  if (compound.category === 'peptide') {
    if (compound.reorderType === 'single') {
      return compound.reorderQuantity * compound.unitPrice;
    }
    return compound.reorderQuantity * (compound.kitPrice || 0);
  }
  return compound.reorderQuantity * compound.unitPrice;
}

export function getMonthlyConsumptionCost(
  compound: Compound,
  compliance?: {
    checkedDoses: number;
    firstCheckDate: string | null;
    lastCheckDate: string | null;
  }
): number {
  let daily = getNormalizedDailyConsumption(compound);
  if (daily === 0) return 0;

  // Step 1: apply compliance rate
  if (compliance?.firstCheckDate && compliance?.lastCheckDate) {
    const first = new Date(compliance.firstCheckDate);
    const last = new Date(compliance.lastCheckDate);
    first.setHours(0, 0, 0, 0);
    last.setHours(0, 0, 0, 0);
    const trackingDays = Math.max(
      1,
      Math.floor((last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000)) + 1
    );
    const daysPerWeek = Math.min(7, Math.max(0, compound.daysPerWeek || 0));
    const expectedDoses = compound.dosesPerDay * trackingDays * (daysPerWeek / 7);
    if (expectedDoses > 0) {
      const rate = Math.min(1, compliance.checkedDoses / expectedDoses);
      daily *= rate;
    }
  }

  // Step 2: apply cycling ON/OFF fraction AFTER compliance
  if (compound.cycleOnDays && compound.cycleOffDays) {
    const onFraction = compound.cycleOnDays / (compound.cycleOnDays + compound.cycleOffDays);
    daily *= onFraction;
  }

  const monthly = daily * 30;

  // Peptide
  if (compound.category === 'peptide' && compound.bacstatPerVial) {
    const vials = monthly / compound.bacstatPerVial;
    if (compound.reorderType === 'kit' && compound.kitPrice) {
      return (vials / 10) * compound.kitPrice;
    }
    return vials * compound.unitPrice;
  }

  // Injectable oil — branch on doseLabel
  if (compound.category === 'injectable-oil' && compound.vialSizeMl && compound.unitSize) {
    const dl = (compound.doseLabel ?? '').toLowerCase();
    let totalPerVial: number;
    if (dl === 'iu') {
      totalPerVial = compound.vialSizeMl * 100;
    } else if (dl === 'ml') {
      totalPerVial = compound.vialSizeMl;
    } else {
      // mg (default)
      totalPerVial = compound.unitSize * compound.vialSizeMl;
    }
    if (totalPerVial > 0) {
      return (monthly / totalPerVial) * compound.unitPrice;
    }
    return 0;
  }

  const dl_mcc = (compound.doseLabel ?? '').toLowerCase();
  const ul_mcc = (compound.unitLabel ?? '').toLowerCase();

  // Spray compounds
  if (
    (dl_mcc === 'sprays' || dl_mcc === 'spray') &&
    compound.containerVolumeMl &&
    compound.mlPerSpray &&
    compound.mlPerSpray > 0
  ) {
    const totalSprays = compound.containerVolumeMl / compound.mlPerSpray;
    if (totalSprays > 0) {
      return (monthly / totalSprays) * compound.unitPrice;
    }
    return 0;
  }

  // Drop compounds
  if (
    (dl_mcc === 'drops' || dl_mcc === 'drop') &&
    compound.unitSize > 0 &&
    (ul_mcc === 'ml' || ul_mcc === 'fl oz' || ul_mcc === 'oz')
  ) {
    const mlPerContainer = ul_mcc === 'ml'
      ? compound.unitSize
      : compound.unitSize * 29.5735;
    const totalDrops = mlPerContainer * 20;
    if (totalDrops > 0) {
      return (monthly / totalDrops) * compound.unitPrice;
    }
    return 0;
  }

  // Oral / powder / all other categories
  if (compound.unitSize > 0) {
    return (monthly / compound.unitSize) * compound.unitPrice;
  }

  return 0;
}

/**
 * Validate that a compound has all required fields for accurate math.
 * Returns an array of error messages (empty = valid).
 */
export function validateCompoundForMath(compound: Compound): string[] {
  const errors: string[] = [];

  if (!compound.dosePerUse || compound.dosePerUse <= 0)
    errors.push('Dose per use must be greater than 0');
  if (!compound.dosesPerDay || compound.dosesPerDay <= 0)
    errors.push('Doses per day must be greater than 0');
  if (!compound.daysPerWeek || compound.daysPerWeek <= 0)
    errors.push('Days per week must be greater than 0');

  switch (compound.category) {
    case 'peptide':
      if (!compound.bacstatPerVial || compound.bacstatPerVial <= 0)
        errors.push('Reconstitution volume missing — set solvent volume so IU per vial can be calculated');
      if (!compound.reconVolume || compound.reconVolume <= 0)
        errors.push('Reconstitution volume (mL) required');
      if ((compound.doseLabel ?? '').toLowerCase() !== 'iu')
        errors.push('Peptide dose unit must be IU');
      break;

    case 'injectable-oil':
      if (!compound.vialSizeMl || compound.vialSizeMl <= 0)
        errors.push('Vial size (mL) required');
      if (!compound.unitSize || compound.unitSize <= 0)
        errors.push('Concentration (mg/mL) required as unit size');
      if (!['iu', 'mg', 'ml'].includes((compound.doseLabel ?? '').toLowerCase()))
        errors.push('Dose unit must be IU, mg, or mL');
      break;

    case 'oral':
    case 'powder':
    case 'vitamin':
    case 'adaptogen':
    case 'nootropic':
    case 'probiotic':
      if (!compound.unitSize || compound.unitSize <= 0)
        errors.push('Total count per bottle required (e.g. 90 for a 90-capsule bottle)');
      break;
  }

  return errors;
}

// Helper: date N days ago as ISO string
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

export const defaultCompounds: Compound[] = [
  // ── PEPTIDES ──────────────────────────────────────────
  {
    id: '5-amino-1mq',
    name: '5-Amino-1MQ',
    category: 'peptide',
    unitSize: 50,
    unitLabel: 'mg vial',
    unitPrice: 11,
    kitPrice: 110,
    dosePerUse: 30,
    doseLabel: 'IU',
    bacstatPerVial: 200,
    reconVolume: 2,
    dosesPerDay: 1,
    daysPerWeek: 3,
    timingNote: 'M/W/F only',
    cyclingNote: '30 days on / 14 days off',
    currentQuantity: 3,
    purchaseDate: daysAgo(7),
    reorderQuantity: 5,
    cycleOnDays: 30,
    cycleOffDays: 14,
    cycleStartDate: daysAgo(0),
  },
  {
    id: 'b12',
    name: 'B12',
    category: 'peptide',
    unitSize: 10,
    unitLabel: 'mL vial',
    unitPrice: 5,
    kitPrice: 50,
    dosePerUse: 0.1,
    doseLabel: 'mL',
    reconVolume: 2,
    dosesPerDay: 1,
    daysPerWeek: 1,
    timingNote: '100 mg (1mg) weekly on Tuesday',
    cyclingNote: '28 days on / 14 days off',
    currentQuantity: 10,
    purchaseDate: daysAgo(14),
    reorderQuantity: 3,
    cycleOnDays: 28,
    cycleOffDays: 14,
    cycleStartDate: daysAgo(0),
  },
  {
    id: 'bpc-157',
    name: 'BPC-157',
    category: 'peptide',
    unitSize: 20,
    unitLabel: 'mg vial',
    unitPrice: 8.20,
    kitPrice: 82,
    dosePerUse: 10,
    doseLabel: 'IU',
    bacstatPerVial: 200,
    reconVolume: 2,
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '10 IU nightly (PM only)',
    cyclingNote: '42 days on / 21 days off (concurrent with TB-500)',
    currentQuantity: 5,
    purchaseDate: daysAgo(5),
    reorderQuantity: 10,
    cycleOnDays: 42,
    cycleOffDays: 21,
    cycleStartDate: daysAgo(0),
  },
  {
    id: 'cerebroprotein',
    name: 'Cerebroprotein',
    category: 'peptide',
    unitSize: 30,
    unitLabel: 'mg vial',
    unitPrice: 5.50,
    kitPrice: 55,
    dosePerUse: 30,
    doseLabel: 'IU',
    bacstatPerVial: 200,
    reconVolume: 2,
    dosesPerDay: 1,
    daysPerWeek: 5,
    timingNote: '30 IU M-F mornings',
    cyclingNote: '42 days on / 21 days off',
    currentQuantity: 3,
    purchaseDate: daysAgo(10),
    reorderQuantity: 5,
    cycleOnDays: 42,
    cycleOffDays: 21,
    cycleStartDate: daysAgo(0),
  },
  {
    id: 'cjc-1295',
    name: 'CJC-1295',
    category: 'peptide',
    unitSize: 10,
    unitLabel: 'mg vial',
    unitPrice: 14.20,
    kitPrice: 142,
    dosePerUse: 10,
    doseLabel: 'IU',
    bacstatPerVial: 200,
    reconVolume: 2,
    dosesPerDay: 2,
    daysPerWeek: 5,
    timingNote: '10 IU AM + 10 IU PM, M-F only',
    currentQuantity: 5,
    purchaseDate: daysAgo(3),
    reorderQuantity: 10,
  },
  {
    id: 'ghk-cu',
    name: 'GHK-Cu',
    category: 'peptide',
    unitSize: 100,
    unitLabel: 'mg vial',
    unitPrice: 5,
    kitPrice: 50,
    dosePerUse: 10,
    doseLabel: 'IU',
    bacstatPerVial: 200,
    reconVolume: 2,
    dosesPerDay: 1,
    daysPerWeek: 6,
    timingNote: 'M/T/W/Th/F/Sa evenings',
    cyclingNote: '56 days on / 21 days off',
    currentQuantity: 5,
    purchaseDate: daysAgo(5),
    reorderQuantity: 10,
    cycleOnDays: 56,
    cycleOffDays: 21,
    cycleStartDate: daysAgo(0),
  },
  {
    id: 'igf1-lr3',
    name: 'IGF-1 LR3',
    category: 'peptide',
    unitSize: 1,
    unitLabel: 'mg vial',
    unitPrice: 16.60,
    kitPrice: 166,
    dosePerUse: 15,
    doseLabel: 'IU',
    bacstatPerVial: 200,
    reconVolume: 2,
    dosesPerDay: 1,
    daysPerWeek: 4,
    timingNote: 'M/W/F/Sa post-workout',
    cyclingNote: '42 days on / 28 days off',
    currentQuantity: 4,
    purchaseDate: daysAgo(4),
    reorderQuantity: 8,
    cycleOnDays: 42,
    cycleOffDays: 28,
    cycleStartDate: daysAgo(0),
  },
  {
    id: 'ipamorelin',
    name: 'Ipamorelin',
    category: 'peptide',
    unitSize: 10,
    unitLabel: 'mg vial',
    unitPrice: 7.80,
    kitPrice: 78,
    dosePerUse: 10,
    doseLabel: 'IU',
    bacstatPerVial: 200,
    reconVolume: 2,
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '10 IU nightly',
    currentQuantity: 6,
    purchaseDate: daysAgo(12),
    reorderQuantity: 10,
  },
  {
    id: 'mots-c',
    name: 'MOTS-C',
    category: 'peptide',
    unitSize: 40,
    unitLabel: 'mg vial',
    unitPrice: 17,
    kitPrice: 170,
    dosePerUse: 50,
    doseLabel: 'IU',
    bacstatPerVial: 200,
    reconVolume: 2,
    dosesPerDay: 1,
    daysPerWeek: 3,
    timingNote: 'M/W/F',
    currentQuantity: 2,
    purchaseDate: daysAgo(6),
    reorderQuantity: 4,
  },
  {
    id: 'nad-plus',
    name: 'NAD+',
    category: 'injectable-oil',
    unitSize: 1000,
    unitLabel: 'mg/mL',
    unitPrice: 100,
    vialSizeMl: 10,
    dosePerUse: 1000,
    doseLabel: 'mg',
    dosesPerDay: 1,
    daysPerWeek: 2,
    timingNote: '1mL (1000mg) Tues/Thurs',
    currentQuantity: 7,
    purchaseDate: daysAgo(1),
    reorderQuantity: 1,
  },
  {
    id: 'retatrutide',
    name: 'Retatrutide',
    category: 'peptide',
    unitSize: 60,
    unitLabel: 'mg vial',
    unitPrice: 27,
    kitPrice: 270,
    dosePerUse: 15,
    doseLabel: 'IU',
    bacstatPerVial: 200,
    reconVolume: 2,
    dosesPerDay: 1,
    daysPerWeek: 1,
    timingNote: 'Sunday evening only',
    cyclingNote: '112 days on / 28 days off (ramp + taper)',
    currentQuantity: 3,
    purchaseDate: daysAgo(15),
    reorderQuantity: 4,
    cycleOnDays: 112,
    cycleOffDays: 28,
    cycleStartDate: daysAgo(0),
  },
  {
    id: 'selank',
    name: 'Selank',
    category: 'peptide',
    unitSize: 10,
    unitLabel: 'mg vial',
    unitPrice: 5.50,
    kitPrice: 55,
    dosePerUse: 15,
    doseLabel: 'IU',
    bacstatPerVial: 200,
    reconVolume: 2,
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '15 IU nightly',
    cyclingNote: '30 days on / 21 days off',
    currentQuantity: 4,
    purchaseDate: daysAgo(6),
    reorderQuantity: 8,
    cycleOnDays: 30,
    cycleOffDays: 21,
    cycleStartDate: daysAgo(0),
  },
  {
    id: 'semax',
    name: 'Semax',
    category: 'peptide',
    unitSize: 10,
    unitLabel: 'mg vial',
    unitPrice: 5.50,
    kitPrice: 55,
    dosePerUse: 10,
    doseLabel: 'IU',
    bacstatPerVial: 200,
    reconVolume: 2,
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '10 IU daily morning (AM only)',
    cyclingNote: '30 days on / 21 days off (same as Selank)',
    currentQuantity: 4,
    purchaseDate: daysAgo(2),
    reorderQuantity: 10,
    cycleOnDays: 30,
    cycleOffDays: 21,
    cycleStartDate: daysAgo(0),
  },
  {
    id: 'tb-500',
    name: 'TB-500',
    category: 'peptide',
    unitSize: 10,
    unitLabel: 'mg vial',
    unitPrice: 6.50,
    kitPrice: 65,
    dosePerUse: 100,
    doseLabel: 'IU',
    bacstatPerVial: 200,
    reconVolume: 2,
    dosesPerDay: 1,
    daysPerWeek: 2,
    timingNote: 'T/Th evenings',
    cyclingNote: '42 days on / 21 days off (concurrent with BPC-157)',
    currentQuantity: 2,
    purchaseDate: daysAgo(2),
    reorderQuantity: 4,
    cycleOnDays: 42,
    cycleOffDays: 21,
    cycleStartDate: daysAgo(0),
  },
  {
    id: 'tesamorelin',
    name: 'Tesamorelin',
    category: 'peptide',
    unitSize: 10,
    unitLabel: 'mg vial',
    unitPrice: 17,
    kitPrice: 170,
    dosePerUse: 20,
    doseLabel: 'IU',
    bacstatPerVial: 300,
    reconVolume: 3,
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '20 IU daily evening',
    cyclingNote: '90 days on / 21 days off',
    currentQuantity: 3,
    purchaseDate: daysAgo(3),
    reorderQuantity: 5,
    cycleOnDays: 90,
    cycleOffDays: 21,
    cycleStartDate: daysAgo(104),
  },
  {
    id: 'thymosin-a1',
    name: 'Thymosin Alpha-1',
    category: 'peptide',
    unitSize: 10,
    unitLabel: 'mg vial',
    unitPrice: 12.50,
    kitPrice: 125,
    dosePerUse: 40,
    doseLabel: 'IU',
    bacstatPerVial: 200,
    reconVolume: 2,
    dosesPerDay: 1,
    daysPerWeek: 3,
    timingNote: 'M/W/F',
    currentQuantity: 3,
    purchaseDate: daysAgo(8),
    reorderQuantity: 5,
  },
  // ── INJECTABLE OILS ───────────────────────────────────
  {
    id: 'deca',
    name: 'Deca (Nandrolone)',
    category: 'injectable-oil',
    unitSize: 300,
    unitLabel: 'mg/mL',
    unitPrice: 48,
    vialSizeMl: 10,
    dosePerUse: 83,
    doseLabel: 'mg',
    dosesPerDay: 1,
    daysPerWeek: 2,
    timingNote: '83mg M/F only',
    cyclingNote: '112 days on / 56 days off (run Cabergoline same cycle)',
    currentQuantity: 2,
    purchaseDate: daysAgo(20),
    reorderQuantity: 3,
    cycleOnDays: 112,
    cycleOffDays: 56,
    cycleStartDate: daysAgo(0),
  },
  {
    id: 'test-cyp',
    name: 'Test Cypionate',
    category: 'injectable-oil',
    unitSize: 250,
    unitLabel: 'mg/mL',
    unitPrice: 32,
    vialSizeMl: 10,
    dosePerUse: 35,
    doseLabel: 'mg',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '35mg daily',
    currentQuantity: 2,
    purchaseDate: daysAgo(10),
    reorderQuantity: 3,
  },
  // ── ORAL SUPPLEMENTS ──────────────────────────────────
  {
    id: 'anavar',
    name: 'Anavar 10mg',
    category: 'oral',
    unitSize: 100,
    unitLabel: 'pills',
    unitPrice: 95,
    dosePerUse: 2.5,
    doseLabel: 'pills',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '25mg (2.5 pills) daily',
    cyclingNote: '56 days on / 42 days off',
    currentQuantity: 1,
    purchaseDate: daysAgo(1),
    reorderQuantity: 2,
    cycleOnDays: 56,
    cycleOffDays: 42,
    cycleStartDate: daysAgo(0),
  },
  {
    id: 'ashwagandha',
    name: 'KSM-66 Ashwagandha 600mg',
    category: 'oral',
    unitSize: 60,
    unitLabel: 'caps',
    unitPrice: 24,
    dosePerUse: 1,
    doseLabel: 'cap',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '1 cap daily morning',
    currentQuantity: 2,
    purchaseDate: daysAgo(30),
    reorderQuantity: 3,
  },
  {
    id: 'bergamot',
    name: 'Citrus Bergamot 1200mg',
    category: 'oral',
    unitSize: 120,
    unitLabel: 'caps',
    unitPrice: 28,
    dosePerUse: 1,
    doseLabel: 'cap',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '600mg (1 cap) daily morning',
    currentQuantity: 1,
    purchaseDate: daysAgo(18),
    reorderQuantity: 2,
  },
  {
    id: 'cabergoline',
    name: 'Cabergoline 250mcg',
    category: 'oral',
    unitSize: 60,
    unitLabel: 'caps',
    unitPrice: 38,
    dosePerUse: 1,
    doseLabel: 'cap',
    dosesPerDay: 1,
    daysPerWeek: 2,
    timingNote: 'M/F only (or Sa only evening)',
    cyclingNote: '112 days on / 56 days off (sync with Deca)',
    currentQuantity: 1,
    purchaseDate: daysAgo(10),
    reorderQuantity: 2,
    cycleOnDays: 112,
    cycleOffDays: 56,
    cycleStartDate: daysAgo(0),
  },
  {
    id: 'hawthorn',
    name: 'Hawthorn Berry 500mg',
    category: 'oral',
    unitSize: 240,
    unitLabel: 'caps',
    unitPrice: 17,
    dosePerUse: 1,
    doseLabel: 'cap',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '1 cap daily evening',
    currentQuantity: 1,
    purchaseDate: daysAgo(20),
    reorderQuantity: 2,
  },
  {
    id: 'l-arginine',
    name: 'L-Arginine 1,000mg',
    category: 'oral',
    unitSize: 150,
    unitLabel: 'caps',
    unitPrice: 12,
    dosePerUse: 5,
    doseLabel: 'caps',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '5 caps (5g) daily morning',
    currentQuantity: 2,
    purchaseDate: daysAgo(15),
    reorderQuantity: 4,
  },
  {
    id: 'magnesium',
    name: 'Magnesium Glycinate 240mg',
    category: 'oral',
    unitSize: 180,
    unitLabel: 'caps',
    unitPrice: 22,
    dosePerUse: 1,
    doseLabel: 'cap',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '1 cap daily evening',
    currentQuantity: 1,
    purchaseDate: daysAgo(7),
    reorderQuantity: 2,
  },
  {
    id: 'milk-thistle',
    name: 'Milk Thistle 300mg',
    category: 'oral',
    unitSize: 120,
    unitLabel: 'caps',
    unitPrice: 15,
    dosePerUse: 1,
    doseLabel: 'cap',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '1 cap daily evening',
    currentQuantity: 2,
    purchaseDate: daysAgo(30),
    reorderQuantity: 3,
  },
  {
    id: 'nac',
    name: 'NAC 1,000mg',
    category: 'oral',
    unitSize: 120,
    unitLabel: 'caps',
    unitPrice: 16,
    dosePerUse: 1,
    doseLabel: 'cap',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '1 cap daily evening',
    currentQuantity: 2,
    purchaseDate: daysAgo(8),
    reorderQuantity: 3,
  },
  {
    id: 'omega3',
    name: 'Super Omega-3 Fish Oil',
    category: 'oral',
    unitSize: 120,
    unitLabel: 'softgels',
    unitPrice: 16,
    dosePerUse: 2,
    doseLabel: 'softgels',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '2 softgels daily morning',
    currentQuantity: 2,
    purchaseDate: daysAgo(25),
    reorderQuantity: 3,
  },
  {
    id: 'pycnogenol',
    name: 'Pycnogenol 150mg',
    category: 'oral',
    unitSize: 60,
    unitLabel: 'caps',
    unitPrice: 22,
    dosePerUse: 1,
    doseLabel: 'cap',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '1 cap daily morning',
    currentQuantity: 2,
    purchaseDate: daysAgo(10),
    reorderQuantity: 3,
  },
  {
    id: 'tadalafil',
    name: 'Tadalafil 5mg',
    category: 'oral',
    unitSize: 90,
    unitLabel: 'caps',
    unitPrice: 18,
    dosePerUse: 1,
    doseLabel: 'cap',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '1 cap daily morning',
    currentQuantity: 1,
    purchaseDate: daysAgo(12),
    reorderQuantity: 2,
  },
  {
    id: 'tudca',
    name: 'TUDCA 500mg',
    category: 'oral',
    unitSize: 30,
    unitLabel: 'caps',
    unitPrice: 32,
    dosePerUse: 1,
    doseLabel: 'cap',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '1 cap daily evening',
    currentQuantity: 2,
    purchaseDate: daysAgo(5),
    reorderQuantity: 4,
  },
  {
    id: 'ubiquinol',
    name: 'Qunol/CoQ10 200mg',
    category: 'oral',
    unitSize: 60,
    unitLabel: 'caps',
    unitPrice: 27,
    dosePerUse: 1,
    doseLabel: 'cap',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '1 cap daily morning',
    currentQuantity: 2,
    purchaseDate: daysAgo(15),
    reorderQuantity: 3,
  },
  // ── POWDERS ───────────────────────────────────────────
  {
    id: 'collagen',
    name: 'Collagen Peptides',
    category: 'powder',
    unitSize: 41,
    unitLabel: 'servings',
    unitPrice: 30,
    dosePerUse: 1,
    doseLabel: 'serving (11g)',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '11g evening only',
    currentQuantity: 2,
    purchaseDate: daysAgo(5),
    reorderQuantity: 3,
  },
  {
    id: 'citrulline',
    name: 'L-Citrulline Malate 2:1',
    category: 'powder',
    unitSize: 33,
    unitLabel: 'servings',
    unitPrice: 25,
    dosePerUse: 1,
    doseLabel: 'serving (9g)',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '9g pre-pump, mid-afternoon (1hr before)',
    currentQuantity: 2,
    purchaseDate: daysAgo(12),
    reorderQuantity: 3,
  },
  {
    id: 'taurine',
    name: 'Taurine',
    category: 'powder',
    unitSize: 100,
    unitLabel: 'servings',
    unitPrice: 18,
    dosePerUse: 1,
    doseLabel: 'serving (5g)',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '2.5g AM + 2.5g PM split',
    currentQuantity: 2,
    purchaseDate: daysAgo(8),
    reorderQuantity: 3,
  },
  {
    id: 'vitamin-c',
    name: 'Vitamin C 1g',
    category: 'powder',
    unitSize: 454,
    unitLabel: 'servings',
    unitPrice: 17,
    dosePerUse: 1,
    doseLabel: 'serving (1g)',
    dosesPerDay: 1,
    daysPerWeek: 7,
    timingNote: '1g evening only',
    currentQuantity: 1,
    purchaseDate: daysAgo(3),
    reorderQuantity: 1,
  },
  // ── BACKUP / INACTIVE COMPOUNDS ───────────────────────
  {
    id: 'semaglutide',
    name: 'Semaglutide',
    category: 'peptide',
    unitSize: 5,
    unitLabel: 'mg vial',
    unitPrice: 30,
    kitPrice: 300,
    dosePerUse: 0,
    doseLabel: 'IU',
    bacstatPerVial: 200,
    reconVolume: 2,
    dosesPerDay: 0,
    daysPerWeek: 0,
    timingNote: 'BACKUP — not currently active',
    notes: 'Backup GLP-1 if Retatrutide unavailable',
    currentQuantity: 0,
    purchaseDate: '',
    reorderQuantity: 0,
  },
  {
    id: 'winstrol',
    name: 'Winstrol (Stanozolol)',
    category: 'oral',
    unitSize: 100,
    unitLabel: 'pills',
    unitPrice: 85,
    dosePerUse: 0,
    doseLabel: 'pills',
    dosesPerDay: 0,
    daysPerWeek: 0,
    timingNote: 'BACKUP — not currently active',
    notes: 'Backup oral if Anavar unavailable',
    currentQuantity: 0,
    purchaseDate: '',
    reorderQuantity: 0,
  },
];
