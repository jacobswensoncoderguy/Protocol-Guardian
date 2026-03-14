# Superhuman Protocol — Full Diagnostic Export
## Generated 2026-03-14

---

# TABLE OF CONTENTS
1. [Architecture Overview](#architecture)
2. [Database Schema (types.ts)](#database-schema)
3. [Core Math: compounds.ts](#compounds-ts)
4. [Cycling Logic: cycling.ts](#cycling-ts)
5. [Delivery Methods: deliveryMethods.ts](#delivery-methods-ts)
6. [Compliance Data Hook: useComplianceData.ts](#use-compliance-data)
7. [Compliance Context: ComplianceContext.tsx](#compliance-context)
8. [Compounds Hook: useCompounds.ts](#use-compounds)
9. [Dose Check-Offs Hook: useDoseCheckOffs.ts](#use-dose-check-offs)
10. [Schedule Generator: scheduleGenerator.ts](#schedule-generator)
11. [Schedule Types: schedule.ts](#schedule-ts)
12. [Weekly Schedule View: WeeklyScheduleView.tsx (partial)](#weekly-schedule-view)
13. [Inventory View: InventoryView.tsx (partial)](#inventory-view)
14. [Main Page: Index.tsx (partial)](#index-tsx)
15. [Auth Hook: useAuth.ts](#use-auth)
16. [App Entry: App.tsx](#app-tsx)

---

<a name="architecture"></a>
## 1. ARCHITECTURE OVERVIEW

### Stack
- React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- Supabase (via Lovable Cloud) for DB, auth, edge functions, realtime

### Key Data Flow for Depletion Tracking
```
User checks dose in WeeklyScheduleView
  → useDoseCheckOffs.toggleChecked() writes to `dose_check_offs` table
  → Realtime subscription in useComplianceData fires
  → get_compound_compliance RPC aggregates total checked doses per compound
  → ComplianceContext recalculates:
      - getEffectiveQtyAdjusted (remaining supply)
      - getDaysRemainingAdjusted (days until empty)
      - getConsumedAdjusted (total consumed)
  → InventoryView reads from ComplianceContext to display
```

### Known Issues
1. `deliveryMethods.ts` calculateSupply() is NOT wired into the main depletion pipeline
2. Depletion math is split between `compounds.ts` and `cycling.ts` with redundant functions
3. Unit conversions (IU→mL, mg→pills, sprays→mL) scattered across multiple files
4. The `dose_check_offs` table stores compound_id + timing + dose_index but the compliance RPC only returns aggregate counts per compound — no per-timing granularity

### Database Tables (key ones)
- `user_compounds` — user's compound inventory and config
- `dose_check_offs` — individual dose check marks (compound_id, timing, dose_index, check_date)
- `get_compound_compliance` — RPC that aggregates dose_check_offs into per-compound totals

---

<a name="database-schema"></a>
## 2. DATABASE SCHEMA (src/integrations/supabase/types.ts)

### user_compounds table
```typescript
user_compounds: {
  Row: {
    active_ingredient_total_mg: number | null
    bacstat_per_vial: number | null
    category: string
    compliance_dose_offset: number
    compound_id: string
    concentration_unit: string | null
    container_volume_ml: number | null
    created_at: string
    current_quantity: number
    cycle_off_days: number | null
    cycle_on_days: number | null
    cycle_start_date: string | null
    cycling_note: string | null
    days_per_week: number
    delivery_method: string | null
    depletion_action: string | null
    dose_label: string
    dose_per_use: number
    doses_per_day: number
    id: string
    kit_price: number | null
    ml_per_spray: number | null
    name: string
    notes: string | null
    pause_restart_date: string | null
    paused_at: string | null
    prep_notes: string | null
    purchase_date: string | null
    recon_volume: number | null
    reorder_quantity: number
    reorder_type: string
    resulting_concentration: number | null
    solvent_type: string | null
    solvent_unit: string | null
    solvent_volume: number | null
    sprays_per_dose: number | null
    storage_instructions: string | null
    timing_note: string | null
    unit_label: string
    unit_price: number
    unit_size: number
    updated_at: string
    user_id: string
    vial_size_ml: number | null
    wear_duration_hours: number | null
    weight_per_unit: number | null
    weight_unit: string | null
  }
}
```

### dose_check_offs table
```typescript
dose_check_offs: {
  Row: {
    check_date: string
    checked_at: string
    compound_id: string
    dose_index: number
    id: string
    timing: string
    user_id: string
  }
}
```

### get_compound_compliance RPC
```typescript
get_compound_compliance: {
  Args: { p_user_id: string }
  Returns: {
    checked_doses: number
    compound_id: string
    first_check_date: string
    last_check_date: string
  }[]
}
```

---

<a name="compounds-ts"></a>
## 3. CORE MATH: src/data/compounds.ts

```typescript
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
  pausedAt?: string;
  pauseRestartDate?: string;
  // Inventory
  currentQuantity: number;
  purchaseDate: string;
  reorderQuantity: number;
  reorderType?: 'single' | 'kit';
  notes?: string;
  weightPerUnit?: number; // mg per individual unit (pill, cap, tab, scoop)
  weightUnit?: string;
  complianceDoseOffset?: number; // check-offs already accounted for before current stock period
  depletionAction?: 'pause' | 'dormant' | null;
  // Dilution / reconstitution
  solventType?: string;
  solventVolume?: number;
  solventUnit?: string;
  resultingConcentration?: number;
  concentrationUnit?: string;
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
    let doseMg = compound.dosePerUse;
    if (dl.includes('mcg') || dl.includes('µg')) doseMg = compound.dosePerUse / 1000;
    else if (dl === 'g') doseMg = compound.dosePerUse * 1000;
    const pillsPerDose = doseMg / weightPerUnitMg;
    return (pillsPerDose * compound.dosesPerDay * compound.daysPerWeek) / 7;
  }

  const normalizedUnitLabel = normalizeCompoundUnitLabel(compound.unitLabel, compound.category).toLowerCase();
  const isCountContainer = COUNT_UNIT_REGEX.test(normalizedUnitLabel);
  const isCountDose = COUNT_UNIT_REGEX.test(dl);
  const isDropDose = dl === 'drops' || dl === 'drop';

  if (!isWeightDose && !isCountDose && !isDropDose && isCountContainer && compound.dosePerUse > 0) {
    return (compound.dosesPerDay * compound.daysPerWeek) / 7;
  }

  return rawDaily;
}

/**
 * Compute how many native supply units have been consumed since the purchaseDate.
 * When compliance data is provided, splits: pre-tracking = theoretical, post-tracking = actual.
 */
export function getConsumedSinceDate(
  compound: Compound,
  referenceDate: Date = new Date(),
  compliance?: { checkedDoses: number; firstCheckDate: string | null; lastCheckDate: string | null }
): number {
  const now = new Date(referenceDate);
  now.setHours(0, 0, 0, 0);

  if (compliance && compliance.firstCheckDate && compliance.checkedDoses > 0) {
    const firstCheck = new Date(compliance.firstCheckDate);
    firstCheck.setHours(0, 0, 0, 0);

    let theoreticalPreTracking = 0;
    if (compound.purchaseDate) {
      const purchaseDay = new Date(compound.purchaseDate);
      purchaseDay.setHours(0, 0, 0, 0);
      const preTrackingDays = Math.max(0, Math.floor((firstCheck.getTime() - purchaseDay.getTime()) / (24 * 60 * 60 * 1000)));
      if (preTrackingDays > 0) {
        theoreticalPreTracking = getTheoreticalConsumption(compound, preTrackingDays, purchaseDay);
      }
    }

    const offset = compound.complianceDoseOffset || 0;
    const effectiveCheckedDoses = Math.max(0, compliance.checkedDoses - offset);
    const actualPostTracking = effectiveCheckedDoses * compound.dosePerUse;
    return theoreticalPreTracking + actualPostTracking;
  }

  if (!compound.purchaseDate) return 0;

  const purchaseDay = new Date(compound.purchaseDate);
  purchaseDay.setHours(0, 0, 0, 0);
  const daysSincePurchase = Math.floor((now.getTime() - purchaseDay.getTime()) / (24 * 60 * 60 * 1000));
  if (daysSincePurchase <= 0) return 0;

  return getTheoreticalConsumption(compound, daysSincePurchase, purchaseDay);
}

function getTheoreticalConsumption(compound: Compound, dayCount: number, fromDate: Date): number {
  if (dayCount <= 0) return 0;
  const dosePerActiveDay = compound.dosePerUse * compound.dosesPerDay;
  if (dosePerActiveDay === 0) return 0;
  const daysPerWeek = Math.min(7, Math.max(0, compound.daysPerWeek || 0));

  if (!compound.cycleOnDays || !compound.cycleOffDays || !compound.cycleStartDate) {
    const activeDays = dayCount * (daysPerWeek / 7);
    return dosePerActiveDay * activeDays;
  }

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

const DROPS_PER_ML = 20;
const SYRINGE_IU_PER_ML = 100;

function isVolumeUnit(unit: string): boolean {
  return ['ml', 'floz', 'fl oz', 'oz'].includes(unit.toLowerCase().replace(/\s+/g, ''));
}

function toMl(value: number, unit: string): number {
  const u = unit.toLowerCase().replace(/\s+/g, '');
  if (u === 'floz' || u === 'fl oz') return value * 29.5735;
  if (u === 'oz') return value * 29.5735;
  return value;
}

/**
 * Convert consumed dose units back to container units (vials, bottles).
 */
export function consumedToContainerUnits(compound: Compound, consumed: number): number {
  if (compound.category === 'peptide' && compound.bacstatPerVial) {
    return consumed / compound.bacstatPerVial;
  }
  if (compound.category === 'injectable-oil' && compound.vialSizeMl) {
    const dl = compound.doseLabel.toLowerCase();
    if (dl === 'iu') {
      const consumedMl = consumed / SYRINGE_IU_PER_ML;
      return consumedMl / compound.vialSizeMl;
    }
    if (dl === 'ml') {
      return consumed / compound.vialSizeMl;
    }
    return consumed / (compound.unitSize * compound.vialSizeMl);
  }
  const normalizedUnitLabel = normalizeCompoundUnitLabel(compound.unitLabel, compound.category);
  const ul = normalizedUnitLabel.toLowerCase().replace(/\s+/g, '');
  const dl = compound.doseLabel.toLowerCase();
  if ((dl === 'drops' || dl === 'drop') && isVolumeUnit(ul)) {
    const mlPerContainer = toMl(compound.unitSize, ul);
    const dropsPerContainer = mlPerContainer * DROPS_PER_ML;
    return dropsPerContainer > 0 ? consumed / dropsPerContainer : 0;
  }

  const isWeightDose = dl.includes('mg') || dl.includes('mcg') || dl.includes('µg') || dl === 'g';
  const weightPerUnitMg = getDerivedWeightPerUnitMg(compound);
  if (isWeightDose && weightPerUnitMg && compound.unitSize > 0) {
    let consumedMg = consumed;
    if (dl.includes('mcg') || dl.includes('µg')) consumedMg = consumed / 1000;
    else if (dl === 'g') consumedMg = consumed * 1000;
    const consumedCountUnits = consumedMg / weightPerUnitMg;
    return consumedCountUnits / compound.unitSize;
  }

  const isCountDose = COUNT_UNIT_REGEX.test(dl);
  const normalizedUL = normalizeCompoundUnitLabel(compound.unitLabel, compound.category).toLowerCase();
  const isCountContainer = COUNT_UNIT_REGEX.test(normalizedUL);
  if (!isWeightDose && !isCountDose && !(dl === 'drops' || dl === 'drop') && isCountContainer && compound.dosePerUse > 0) {
    const numDoses = consumed / compound.dosePerUse;
    return compound.unitSize > 0 ? numDoses / compound.unitSize : 0;
  }

  if (compound.unitSize > 0) {
    return consumed / compound.unitSize;
  }
  return 0;
}

export function getEffectiveQuantity(
  compound: Compound,
  compliance?: { checkedDoses: number; firstCheckDate: string | null; lastCheckDate: string | null }
): number {
  const consumed = getConsumedSinceDate(compound, new Date(), compliance);
  const consumedUnits = consumedToContainerUnits(compound, consumed);
  return Math.max(0, compound.currentQuantity - consumedUnits);
}

export function totalSupplyInDoseUnits(compound: Compound, effectiveQty: number): number {
  if (compound.category === 'peptide' && compound.bacstatPerVial) {
    return effectiveQty * compound.bacstatPerVial;
  }
  if (compound.category === 'injectable-oil' && compound.vialSizeMl) {
    const dl = compound.doseLabel.toLowerCase();
    if (dl === 'iu') {
      return effectiveQty * compound.vialSizeMl * SYRINGE_IU_PER_ML;
    }
    if (dl === 'ml') {
      return effectiveQty * compound.vialSizeMl;
    }
    return effectiveQty * compound.unitSize * compound.vialSizeMl;
  }
  const ul = compound.unitLabel.toLowerCase().replace(/\s+/g, '');
  const dl = compound.doseLabel.toLowerCase();
  if ((dl === 'drops' || dl === 'drop') && isVolumeUnit(ul)) {
    const mlPerContainer = toMl(compound.unitSize, ul);
    return effectiveQty * mlPerContainer * DROPS_PER_ML;
  }
  return effectiveQty * compound.unitSize;
}

export function getDaysRemaining(
  compound: Compound,
  compliance?: { checkedDoses: number; firstCheckDate: string | null; lastCheckDate: string | null }
): number {
  const normalizedDaily = getNormalizedDailyConsumption(compound);
  if (normalizedDaily <= 0) return 999;
  const daysPerWeek = Math.min(7, Math.max(0, compound.daysPerWeek || 0));
  if (daysPerWeek === 0) return 999;

  const dosePerActiveDay = normalizedDaily * (7 / daysPerWeek);
  const effectiveQty = getEffectiveQuantity(compound, compliance);
  const totalSupply = totalSupplyInDoseUnits(compound, effectiveQty);
  const dailyRate = dosePerActiveDay * (daysPerWeek / 7);

  if (compliance && compliance.firstCheckDate && compliance.lastCheckDate) {
    const first = new Date(compliance.firstCheckDate);
    const last = new Date(compliance.lastCheckDate);
    first.setHours(0, 0, 0, 0);
    last.setHours(0, 0, 0, 0);
    const trackingDays = Math.max(1, Math.floor((last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    const expectedDoses = compound.dosesPerDay * trackingDays * (daysPerWeek / 7);
    if (expectedDoses > 0) {
      const complianceRate = Math.min(1, compliance.checkedDoses / expectedDoses);
      const adjustedDailyRate = dailyRate * complianceRate;
      if (adjustedDailyRate > 0) {
        return Math.max(0, Math.floor(totalSupply / adjustedDailyRate));
      }
    }
  }

  return Math.max(0, Math.floor(totalSupply / dailyRate));
}

export function getStatus(daysRemaining: number): CompoundStatus {
  if (daysRemaining > 30) return 'good';
  if (daysRemaining > 7) return 'warning';
  return 'critical';
}

export function getReorderMonth(compound: Compound): number {
  const days = getDaysRemaining(compound);
  const now = new Date();
  const reorderDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return reorderDate.getMonth();
}

export function getReorderDateString(compound: Compound): string {
  const days = getDaysRemaining(compound);
  const now = new Date();
  const reorderDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[reorderDate.getMonth()]} ${reorderDate.getFullYear()}`;
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

export function getMonthlyConsumptionCost(compound: Compound): number {
  const dailyConsumption = getNormalizedDailyConsumption(compound);
  if (dailyConsumption === 0) return 0;
  const monthlyConsumption = dailyConsumption * 30;

  if (compound.category === 'peptide' && compound.bacstatPerVial) {
    const vialsPerMonth = monthlyConsumption / compound.bacstatPerVial;
    const kitsPerMonth = vialsPerMonth / 10;
    return kitsPerMonth * (compound.kitPrice || 0);
  }

  const totalMgPerUnit = compound.category === 'injectable-oil' && compound.vialSizeMl
    ? compound.unitSize * compound.vialSizeMl
    : compound.unitSize;
  const unitsPerMonth = monthlyConsumption / totalMgPerUnit;
  return unitsPerMonth * compound.unitPrice;
}
```

---

<a name="cycling-ts"></a>
## 4. CYCLING LOGIC: src/lib/cycling.ts

```typescript
import { Compound, getNormalizedDailyConsumption, getEffectiveQuantity, totalSupplyInDoseUnits } from '@/data/compounds';

export type ComplianceInfo = { checkedDoses: number; firstCheckDate: string | null; lastCheckDate: string | null };

export interface CycleStatus {
  hasCycle: boolean;
  isOn: boolean;
  daysLeftInPhase: number;
  phaseLabel: string;
  onFraction: number;
}

export function isPaused(compound: Compound, referenceDate: Date = new Date()): boolean {
  if (!compound.pausedAt) return false;
  if (!compound.pauseRestartDate) return true;
  const restart = new Date(compound.pauseRestartDate);
  restart.setHours(0, 0, 0, 0);
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  return ref < restart;
}

export function getPausedDays(compound: Compound, referenceDate: Date = new Date()): number {
  if (!compound.pausedAt) return 0;
  const pauseStart = new Date(compound.pausedAt);
  const end = compound.pauseRestartDate && new Date(compound.pauseRestartDate) < referenceDate
    ? new Date(compound.pauseRestartDate)
    : referenceDate;
  return Math.max(0, Math.floor((end.getTime() - pauseStart.getTime()) / (24 * 60 * 60 * 1000)));
}

export function getCycleStatus(compound: Compound, referenceDate: Date = new Date()): CycleStatus {
  if (!compound.cycleOnDays || !compound.cycleOffDays || !compound.cycleStartDate) {
    return { hasCycle: false, isOn: true, daysLeftInPhase: 999, phaseLabel: 'Active', onFraction: 1 };
  }

  const cycleLength = compound.cycleOnDays + compound.cycleOffDays;
  const start = new Date(compound.cycleStartDate);
  const diffMs = referenceDate.getTime() - start.getTime();
  let diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  diffDays -= getPausedDays(compound, referenceDate);

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

export function getEffectiveDailyConsumption(compound: Compound, compliance?: ComplianceInfo): number {
  if (isPaused(compound)) return 0;
  const rawDaily = getNormalizedDailyConsumption(compound);
  const { onFraction } = getCycleStatus(compound);
  let adjusted = rawDaily * onFraction;

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

export function getDaysRemainingWithCycling(compound: Compound, compliance?: ComplianceInfo): number {
  if (isPaused(compound)) return 999;

  const normalizedDaily = getNormalizedDailyConsumption(compound);
  if (normalizedDaily <= 0) return 999;

  const daysPerWeek = Math.min(7, Math.max(0, compound.daysPerWeek || 0));
  if (daysPerWeek === 0) return 999;

  const dosePerActiveDay = normalizedDaily * (7 / daysPerWeek);
  const effectiveQty = getEffectiveQuantity(compound, compliance);
  const totalSupply = totalSupplyInDoseUnits(compound, effectiveQty);

  if (!compound.cycleOnDays || !compound.cycleOffDays || !compound.cycleStartDate) {
    const dailyRate = dosePerActiveDay * (daysPerWeek / 7);
    return Math.max(0, Math.floor(totalSupply / dailyRate));
  }

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

  while (remaining > 0 && day < 3650) {
    const dayInCycle = (startDayInCycle + day) % cycleLength;
    const isOn = dayInCycle < compound.cycleOnDays;
    if (isOn) {
      remaining -= dosePerActiveDay * onFraction;
    }
    day++;
  }

  return Math.max(0, day - 1);
}
```

---

<a name="delivery-methods-ts"></a>
## 5. DELIVERY METHODS: src/data/deliveryMethods.ts

```typescript
// NOTE: This file is 607 lines. Only the calculation engine is shown here.
// The full file defines 12 delivery methods with field definitions and math chains.

export function calculateSupply(chain: MathChainType, input: SupplyCalcInput): SupplyCalcResult {
  const containers = input.containersOnHand ?? 1;

  switch (chain) {
    case 'reconstitute-then-draw': {
      const powderMg = input.powderWeightMg ?? 0;
      const solventMl = input.solventVolumeMl ?? 1;
      const conc = powderMg / solventMl;
      const targetMg = input.doseAmount ?? 0;
      const drawMl = targetMg > 0 && conc > 0 ? targetMg / conc : 0;
      const dosesPerVial = drawMl > 0 ? Math.floor(solventMl / drawMl) : 0;
      return { dosesPerContainer: dosesPerVial, totalDosesAvailable: dosesPerVial * containers, drawVolumeMl: drawMl, concentrationMgMl: conc, mgPerDose: targetMg };
    }
    case 'concentration-draw': {
      const conc = input.concentrationMgMl ?? 0;
      const vialMl = input.vialSizeMl ?? 0;
      const targetMg = input.doseAmount ?? 0;
      const drawMl = targetMg > 0 && conc > 0 ? targetMg / conc : 0;
      const dosesPerVial = drawMl > 0 ? Math.floor(vialMl / drawMl) : 0;
      return { dosesPerContainer: dosesPerVial, totalDosesAvailable: dosesPerVial * containers, drawVolumeMl: drawMl, concentrationMgMl: conc, mgPerDose: targetMg };
    }
    case 'count-divide': {
      const count = input.countPerContainer ?? 0;
      const perDose = input.unitsPerDose ?? 1;
      const dosesPerContainer = perDose > 0 ? Math.floor(count / perDose) : 0;
      return { dosesPerContainer, totalDosesAvailable: dosesPerContainer * containers, mgPerDose: input.doseAmount };
    }
    case 'volume-to-sprays': {
      const volumeMl = input.containerVolumeMl ?? 0;
      const mlPerSpray = input.mlPerSpray ?? 0.1;
      const totalSprays = mlPerSpray > 0 ? Math.floor(volumeMl / mlPerSpray) : 0;
      const spraysPerDose = input.spraysPerDose ?? 1;
      const dosesPerContainer = spraysPerDose > 0 ? Math.floor(totalSprays / spraysPerDose) : 0;
      const activeMg = input.activeIngredientTotalMg ?? 0;
      const mgPerSpray = totalSprays > 0 && activeMg > 0 ? activeMg / totalSprays : undefined;
      return { dosesPerContainer, totalDosesAvailable: dosesPerContainer * containers, totalSpraysAvailable: totalSprays, mgPerSpray, mgPerDose: mgPerSpray && spraysPerDose ? mgPerSpray * spraysPerDose : undefined };
    }
    // ... weight-divide, volume-to-drops, patch-count, suppository-count, iv-volume also implemented
  }
}

// CRITICAL NOTE: calculateSupply() is NOT yet used by the main depletion pipeline.
// compounds.ts functions (getConsumedSinceDate, consumedToContainerUnits, etc.) do their own math.
```

---

<a name="use-compliance-data"></a>
## 6. COMPLIANCE DATA HOOK: src/hooks/useComplianceData.ts

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CompoundCompliance {
  compoundId: string;
  checkedDoses: number;
  firstCheckDate: string | null;
  lastCheckDate: string | null;
}

export interface ComplianceMap {
  get(compoundId: string): CompoundCompliance | undefined;
  entries: CompoundCompliance[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useComplianceData(userId: string | undefined): ComplianceMap {
  const [entries, setEntries] = useState<CompoundCompliance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompliance = useCallback(async () => {
    if (!userId) { setEntries([]); setLoading(false); return; }

    const { data, error } = await supabase.rpc('get_compound_compliance', { p_user_id: userId });

    if (error) {
      console.error('Failed to fetch compliance data:', error);
      setEntries([]);
    } else if (data) {
      setEntries(
        (data as any[]).map((row) => ({
          compoundId: row.compound_id,
          checkedDoses: Number(row.checked_doses),
          firstCheckDate: row.first_check_date,
          lastCheckDate: row.last_check_date,
        }))
      );
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchCompliance(); }, [fetchCompliance]);

  // Realtime: re-fetch when dose_check_offs change
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`compliance:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dose_check_offs', filter: `user_id=eq.${userId}` }, () => { fetchCompliance(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchCompliance]);

  const map = new Map(entries.map((e) => [e.compoundId, e]));
  return { get: (compoundId: string) => map.get(compoundId), entries, loading, refetch: fetchCompliance };
}
```

---

<a name="compliance-context"></a>
## 7. COMPLIANCE CONTEXT: src/contexts/ComplianceContext.tsx

```typescript
import React, { createContext, useContext, useMemo } from 'react';
import { useComplianceData, ComplianceMap, CompoundCompliance } from '@/hooks/useComplianceData';
import { Compound, getEffectiveQuantity, getDaysRemaining, getConsumedSinceDate, consumedToContainerUnits } from '@/data/compounds';
import { getDaysRemainingWithCycling, getEffectiveDailyConsumption, ComplianceInfo } from '@/lib/cycling';

interface ComplianceContextValue {
  compliance: ComplianceMap;
  getComplianceInfo: (compoundId: string) => ComplianceInfo | undefined;
  getDaysRemainingAdjusted: (compound: Compound) => number;
  getEffectiveDailyAdjusted: (compound: Compound) => number;
  getEffectiveQtyAdjusted: (compound: Compound) => number;
  getConsumedAdjusted: (compound: Compound) => number;
  refetchCompliance: () => Promise<void>;
}

const ComplianceContext = createContext<ComplianceContextValue | null>(null);

export function ComplianceProvider({ userId, children }: { userId: string | undefined; children: React.ReactNode }) {
  const compliance = useComplianceData(userId);

  const value = useMemo<ComplianceContextValue>(() => {
    const getInfo = (compoundId: string): ComplianceInfo | undefined => {
      const c = compliance.get(compoundId);
      if (!c) return undefined;
      return { checkedDoses: c.checkedDoses, firstCheckDate: c.firstCheckDate, lastCheckDate: c.lastCheckDate };
    };

    return {
      compliance,
      getComplianceInfo: getInfo,
      getDaysRemainingAdjusted: (compound: Compound) => getDaysRemainingWithCycling(compound, getInfo(compound.id)),
      getEffectiveDailyAdjusted: (compound: Compound) => getEffectiveDailyConsumption(compound, getInfo(compound.id)),
      getEffectiveQtyAdjusted: (compound: Compound) => getEffectiveQuantity(compound, getInfo(compound.id)),
      getConsumedAdjusted: (compound: Compound) => getConsumedSinceDate(compound, new Date(), getInfo(compound.id)),
      refetchCompliance: compliance.refetch,
    };
  }, [compliance]);

  return <ComplianceContext.Provider value={value}>{children}</ComplianceContext.Provider>;
}

export function useCompliance(): ComplianceContextValue {
  const ctx = useContext(ComplianceContext);
  if (!ctx) {
    return {
      compliance: { get: () => undefined, entries: [], loading: false, refetch: async () => {} },
      getComplianceInfo: () => undefined,
      getDaysRemainingAdjusted: (c) => getDaysRemainingWithCycling(c),
      getEffectiveDailyAdjusted: (c) => getEffectiveDailyConsumption(c),
      getEffectiveQtyAdjusted: (c) => getEffectiveQuantity(c),
      getConsumedAdjusted: (c) => getConsumedSinceDate(c),
      refetchCompliance: async () => {},
    };
  }
  return ctx;
}
```

---

<a name="use-compounds"></a>
## 8. COMPOUNDS HOOK: src/hooks/useCompounds.ts

```typescript
// 296 lines — fetches user_compounds from DB, maps to Compound interface,
// provides updateCompound, addCompound, deleteCompound.
// Has realtime subscription on user_compounds table.
// Key mapping function: dbToCompound() converts snake_case DB rows to camelCase Compound.
// normalizeCompoundForApp() applies safety nets for zero-dose compounds.
// See full file in codebase.
```

---

<a name="use-dose-check-offs"></a>
## 9. DOSE CHECK-OFFS HOOK: src/hooks/useDoseCheckOffs.ts

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CheckOffKey {
  compoundId: string;
  timing: string;
  doseIndex: number;
}

function toKey(k: CheckOffKey): string {
  return `${k.compoundId}-${k.timing}-${k.doseIndex}`;
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr(): string { return dateStr(new Date()); }

function weekDayToDateStr(dayIndex: number, weekOffset: number = 0): string {
  const now = new Date();
  const todayDow = now.getDay();
  const diff = dayIndex - todayDow + (weekOffset * 7);
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  return dateStr(target);
}

export { weekDayToDateStr, todayStr };

export function useDoseCheckOffs(selectedDayIndex?: number, weekOffset: number = 0) {
  const { user } = useAuth();
  const [checkedDoses, setCheckedDoses] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const targetDate = selectedDayIndex !== undefined
    ? weekDayToDateStr(selectedDayIndex, weekOffset)
    : todayStr();

  useEffect(() => {
    if (!user) { setCheckedDoses(new Set()); setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('dose_check_offs')
        .select('compound_id, timing, dose_index')
        .eq('user_id', user.id)
        .eq('check_date', targetDate);
      if (data) {
        const keys = new Set(data.map(r => toKey({ compoundId: r.compound_id, timing: r.timing, doseIndex: r.dose_index })));
        setCheckedDoses(keys);
      }
      setLoading(false);
    };
    load();
  }, [user, targetDate]);

  const toggleChecked = useCallback(async (key: string) => {
    if (!user) return;
    // Parse key: "compoundId-timing-index"
    const lastDash = key.lastIndexOf('-');
    const doseIndex = parseInt(key.substring(lastDash + 1), 10);
    const rest = key.substring(0, lastDash);
    const secondLastDash = rest.lastIndexOf('-');
    const timing = rest.substring(secondLastDash + 1);
    const compoundId = rest.substring(0, secondLastDash);

    const isCurrentlyChecked = checkedDoses.has(key);

    // Optimistic update
    setCheckedDoses(prev => {
      const next = new Set(prev);
      if (isCurrentlyChecked) next.delete(key); else next.add(key);
      return next;
    });

    if (isCurrentlyChecked) {
      await supabase.from('dose_check_offs').delete()
        .eq('user_id', user.id).eq('check_date', targetDate)
        .eq('compound_id', compoundId).eq('timing', timing).eq('dose_index', doseIndex);
    } else {
      await supabase.from('dose_check_offs').insert({
        user_id: user.id, check_date: targetDate,
        compound_id: compoundId, timing, dose_index: doseIndex,
      });
    }
  }, [user, targetDate, checkedDoses]);

  return { checkedDoses, toggleChecked, loading };
}
```

---

<a name="schedule-generator"></a>
## 10. SCHEDULE GENERATOR: src/lib/scheduleGenerator.ts

```typescript
import { Compound, CompoundCategory } from '@/data/compounds';
import { DayDose, DaySchedule } from '@/data/schedule';
import { CustomField } from '@/hooks/useCustomFields';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDays(compound: Compound): number[] {
  const note = (compound.timingNote || '').toLowerCase();
  const dpw = compound.daysPerWeek;
  if (dpw === 7 || /\bdaily\b|\bnightly\b|\bevery\s*day\b/i.test(note)) return [0,1,2,3,4,5,6];
  if (/\bm[\/-]f\b|mon[\s-]*fri/i.test(note)) return [1,2,3,4,5];
  if (/\bm\/w\/f\b/i.test(note)) return [1,3,5];
  if (/\bt\/th\b/i.test(note)) return [2,4];
  // ... day name parsing, default patterns based on dpw
  switch (dpw) {
    case 6: return [1,2,3,4,5,6];
    case 5: return [1,2,3,4,5];
    case 4: return [1,2,4,5];
    case 3: return [1,3,5];
    case 2: return [2,4];
    case 1: return [1];
    default: return [0,1,2,3,4,5,6];
  }
}

function parseTimings(compound: Compound, effectiveDosesPerDay: number): ('morning' | 'afternoon' | 'evening')[] {
  const note = (compound.timingNote || '').toLowerCase();
  const hasMorning = /\b(mornings?|am)\b/.test(note);
  const hasEvening = /\b(evenings?|pm|nightl?y?|nights?)\b/.test(note);
  const hasAfternoon = /\b(afternoons?|post[- ]?workouts?|pre[- ]?workouts?)\b/.test(note);

  if (hasMorning || hasEvening || hasAfternoon) {
    const timings: ('morning' | 'afternoon' | 'evening')[] = [];
    if (hasMorning) timings.push('morning');
    if (hasAfternoon) timings.push('afternoon');
    if (hasEvening) timings.push('evening');
    return timings;
  }
  if (effectiveDosesPerDay >= 2) return ['morning', 'evening'];
  return ['morning'];
}

export function generateScheduleFromCompounds(compounds: Compound[], customFields?, customFieldValues?): DaySchedule[] {
  const schedule: DaySchedule[] = DAYS.map((day, i) => ({ dayIndex: i, dayName: day, shortName: SHORT_DAYS[i], doses: [] }));

  compounds.filter(c => c.daysPerWeek > 0 || (c.cycleOnDays && c.cycleOffDays)).forEach(compound => {
    const days = parseDays(compound);
    const effectiveDpd = getEffectiveDosesPerDay(compound, customFields, customFieldValues);
    const timings = parseTimings(compound, effectiveDpd);
    const doseStr = formatDose(compound);

    timings.forEach(timing => {
      const dose: DayDose = { compoundId: compound.id, dose: doseStr, timing, category: compound.category };
      days.forEach(dayIdx => { schedule[dayIdx].doses.push({ ...dose }); });
    });
  });

  return schedule;
}
```

---

<a name="schedule-ts"></a>
## 11. SCHEDULE TYPES: src/data/schedule.ts

```typescript
export interface DayDose {
  compoundId: string;
  dose: string;
  timing: 'morning' | 'afternoon' | 'evening';
  category: string;
}

export interface DaySchedule {
  dayIndex: number;
  dayName: string;
  shortName: string;
  doses: DayDose[];
}

// NOTE: This file also contains a hardcoded weeklySchedule array (legacy).
// The app now uses generateScheduleFromCompounds() from scheduleGenerator.ts instead.
```

---

<a name="use-auth"></a>
## 15. AUTH HOOK: src/hooks/useAuth.ts

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const timeout = setTimeout(() => { setLoading(false); }, 8000);
    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);
  return { user, session, loading, signOut };
}
```

---

<a name="app-tsx"></a>
## 16. APP ENTRY: src/App.tsx

```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";

const AuthGuard = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<AuthGuard><Index /></AuthGuard>} />
          <Route path="/admin" element={<AuthGuard><AdminDashboard /></AuthGuard>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
```

---

## END OF DIAGNOSTIC EXPORT

### Key Questions for Diagnosis:
1. When a dose is checked off in WeeklyScheduleView, does the data flow correctly through dose_check_offs → get_compound_compliance RPC → ComplianceContext → InventoryView?
2. Is the `getConsumedSinceDate` function correctly using `checkedDoses * dosePerUse` for the post-tracking period? Does this produce the right units for ALL compound types?
3. Does `consumedToContainerUnits` correctly convert the consumed dose-units back to container-units for every category (peptide IU, oil mg/mL/IU, oral caps, powder servings)?
4. Is there a unit mismatch between what `dosePerUse` represents and what `consumedToContainerUnits` expects?
5. Why does `getDaysRemainingWithCycling` in cycling.ts duplicate logic from `getDaysRemaining` in compounds.ts — and do they produce different results?
