/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  PHASE 0 — CODEBASE AUDIT (CompoundCardV2 Technical Spec)      ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  SCHEMA AUDIT (user_compounds table)                            ║
 * ║  ─────────────────────────────────────────────────────────────── ║
 * ║  id              uuid     NOT NULL  PK, auto-generated          ║
 * ║  user_id         uuid     NOT NULL  FK→auth.users               ║
 * ║  compound_id     text     NOT NULL  library reference id        ║
 * ║  name            text     NOT NULL  display name                ║
 * ║  category        text     NOT NULL  CompoundCategory enum       ║
 * ║  unit_size       numeric  NOT NULL  container size (mg/count)   ║
 * ║  unit_label      text     NOT NULL  unit descriptor             ║
 * ║  unit_price      numeric  NOT NULL  price per unit              ║
 * ║  kit_price       numeric  NULL      kit price (peptides)        ║
 * ║  dose_per_use    numeric  NOT NULL  amount per dose             ║
 * ║  dose_label      text     NOT NULL  dose unit descriptor        ║
 * ║  bacstat_per_vial numeric NULL      IU per reconstituted vial   ║
 * ║  recon_volume    numeric  NULL      mL of bacstat water used    ║
 * ║  doses_per_day   integer  NOT NULL  frequency                   ║
 * ║  days_per_week   integer  NOT NULL  schedule frequency          ║
 * ║  timing_note     text     NULL      schedule description        ║
 * ║  cycling_note    text     NULL      cycle description           ║
 * ║  current_quantity numeric NOT NULL  containers on hand          ║
 * ║  purchase_date   date     NULL      last purchase date          ║
 * ║  reorder_quantity integer NOT NULL  reorder amount              ║
 * ║  reorder_type    text     NOT NULL  'single'|'kit'              ║
 * ║  notes           text     NULL      general notes               ║
 * ║  cycle_on_days   integer  NULL      cycle ON duration           ║
 * ║  cycle_off_days  integer  NULL      cycle OFF duration          ║
 * ║  cycle_start_date date    NULL      cycle start reference       ║
 * ║  vial_size_ml    numeric  NULL      injectable vial mL          ║
 * ║  weight_per_unit numeric  NULL      mg per pill/cap/scoop       ║
 * ║  weight_unit     text     NULL      unit for weight_per_unit    ║
 * ║  paused_at       timestamptz NULL   when paused                 ║
 * ║  pause_restart_date date  NULL      auto-resume date            ║
 * ║  compliance_dose_offset int NOT NULL  prior stock offset        ║
 * ║  depletion_action text   NULL      'pause'|'dormant'            ║
 * ║  solvent_type    text     NULL      reconstitution solvent       ║
 * ║  solvent_volume  numeric  NULL      solvent amount               ║
 * ║  solvent_unit    text     NULL      solvent measurement unit     ║
 * ║  resulting_concentration numeric NULL  calculated conc          ║
 * ║  concentration_unit text  NULL      conc unit (mg/mL etc)       ║
 * ║  storage_instructions text NULL     storage guidance             ║
 * ║  prep_notes      text     NULL      preparation instructions    ║
 * ║  created_at      timestamptz NOT NULL  auto-set                 ║
 * ║  updated_at      timestamptz NOT NULL  auto-updated             ║
 * ║                                                                  ║
 * ║  RELATED TABLES:                                                ║
 * ║  - dose_check_offs (compound_id → user_compounds.id)            ║
 * ║  - user_compound_protocols (user_compound_id → user_compounds)  ║
 * ║  - titration_schedules (user_compound_id → user_compounds)      ║
 * ║  - compound_custom_field_values (user_compound_id → user_comp.) ║
 * ║  - orders (compound_id → user_compounds.id)                     ║
 * ║  - weekly_schedule_snapshots (compound_snapshots JSON)           ║
 * ║  - protocol_changes (compound_id → user_compounds.id)           ║
 * ║                                                                  ║
 * ║  ⚠ UNUSED/REDUNDANT FLAGS:                                     ║
 * ║  - compounds table (separate seed library) — not user data      ║
 * ║  - reorder_type defaults 'single' — kit logic only for peptides ║
 * ║                                                                  ║
 * ║  CALCULATION FUNCTION AUDIT:                                     ║
 * ║  ─────────────────────────────────────────────────────────────── ║
 * ║  src/data/compounds.ts:                                         ║
 * ║    normalizeCompoundUnitLabel — standardizes unit labels         ║
 * ║    getCompoundContainerKind — derives 'bag'|'bottle'            ║
 * ║    getDerivedWeightPerUnitMg — infers mg per pill               ║
 * ║    getNormalizedDailyConsumption — daily usage in container unit ║
 * ║    getConsumedSinceDate — total consumed since purchase          ║
 * ║    consumedToContainerUnits — converts dose units to containers  ║
 * ║    getEffectiveQuantity — remaining qty after consumption        ║
 * ║    totalSupplyInDoseUnits — converts qty to dose units           ║
 * ║    getDaysRemaining — days of supply left                        ║
 * ║    getStatus — good/warning/critical status                      ║
 * ║    getReorderMonth/DateString — projected reorder date           ║
 * ║    getReorderCost — cost per reorder                             ║
 * ║    getMonthlyConsumptionCost — $/month                          ║
 * ║  src/lib/cycling.ts:                                             ║
 * ║    isPaused — check if compound is paused                        ║
 * ║    getPausedDays — days in pause state                           ║
 * ║    getCycleStatus — ON/OFF phase, days left, onFraction          ║
 * ║    getEffectiveDailyConsumption — cycling+pause adjusted         ║
 * ║    getDaysRemainingWithCycling — supply days with cycling        ║
 * ║  src/data/dilutionDefaults.ts:                                   ║
 * ║    getDilutionDefaults — smart defaults by compound name         ║
 * ║    calculateConcentration — mg/mL from powder + solvent          ║
 * ║    buildPrepGuide — full reconstitution guide object             ║
 * ║  src/lib/scheduleGenerator.ts:                                   ║
 * ║    generateScheduleFromCompounds — weekly schedule builder       ║
 * ║                                                                  ║
 * ║  ⚠ DUPLICATE OUTPUT FLAGS:                                     ║
 * ║  - getDaysRemaining (compounds.ts) vs getDaysRemainingWithCycl. ║
 * ║    Both compute days remaining; cycling version is superset.     ║
 * ║                                                                  ║
 * ║  DEPENDENCY AUDIT (26 files import from compounds):             ║
 * ║  ─────────────────────────────────────────────────────────────── ║
 * ║  Dashboard: DashboardView.tsx                                    ║
 * ║  Inventory: InventoryView.tsx (2522 lines — main compound UI)   ║
 * ║  Reorder: ReorderView.tsx                                        ║
 * ║  Cost: CostProjectionView.tsx                                    ║
 * ║  Schedule: WeeklyScheduleView.tsx, scheduleGenerator.ts          ║
 * ║  Compliance: ComplianceContext.tsx, useComplianceData.ts          ║
 * ║  Check-offs: useDoseCheckOffs.ts, useHistoricalCheckOffs.ts     ║
 * ║  Protocols: useProtocolAnalysis.ts, ProtocolChangeHistoryView    ║
 * ║  AI: AIInsightsView.tsx, ProtocolChat.tsx                        ║
 * ║  Compounds: useCompounds.ts, AddCompoundDialog.tsx               ║
 * ║  Info: CompoundInfoDrawer.tsx, CompoundScoreDrawer.tsx           ║
 * ║  Zones: ZoneDetailDrawer.tsx                                     ║
 * ║  Titration: TitrationView.tsx, useTitration.ts                   ║
 * ║  Other: CycleTimelineBar.tsx, HouseholdSyncPanel.tsx             ║
 * ║  Pages: Index.tsx, Onboarding.tsx                                ║
 * ║                                                                  ║
 * ║  MOBILE AUDIT:                                                   ║
 * ║  ─────────────────────────────────────────────────────────────── ║
 * ║  - useIsMobile hook (768px breakpoint)                           ║
 * ║  - Swipe tabs via useSwipeTabs hook (touch events)               ║
 * ║  - Pull-to-refresh via usePullToRefresh                          ║
 * ║  - Safe area insets in index.css (env safe-area-inset-*)         ║
 * ║  - Responsive: full-width on mobile, card grids on desktop       ║
 * ║  - Sheet components (bottom sheets) for mobile drawers           ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { Compound, CompoundCategory } from '@/data/compounds';

// ─── Compound Type (Wizard concept, maps to CompoundCategory) ────────────────

export type CompoundType =
  | 'lyophilized-peptide'
  | 'injectable-oil'
  | 'oral-pill'
  | 'oral-powder'
  | 'topical'
  | 'prescription';

export const COMPOUND_TYPE_META: Record<CompoundType, {
  icon: string;
  label: string;
  subtitle: string;
  category: CompoundCategory;
}> = {
  'lyophilized-peptide': { icon: '🧬', label: 'Lyophilized Peptide', subtitle: 'Requires reconstitution', category: 'peptide' },
  'injectable-oil':     { icon: '💉', label: 'Injectable Oil', subtitle: 'Pre-mixed, draw and inject', category: 'injectable-oil' },
  'oral-pill':          { icon: '💊', label: 'Oral Pill / Capsule', subtitle: 'Swallow whole', category: 'oral' },
  'oral-powder':        { icon: '🥄', label: 'Oral Powder', subtitle: 'Mix or measure by weight', category: 'powder' },
  'topical':            { icon: '🧴', label: 'Topical / Cream', subtitle: 'Apply to skin', category: 'topical' },
  'prescription':       { icon: '📋', label: 'Prescription', subtitle: 'Prescribed medication', category: 'prescription' },
};

export function compoundTypeFromCategory(cat: CompoundCategory): CompoundType {
  switch (cat) {
    case 'peptide': return 'lyophilized-peptide';
    case 'injectable-oil': return 'injectable-oil';
    case 'powder': return 'oral-powder';
    case 'topical': return 'topical';
    case 'prescription': return 'prescription';
    default: return 'oral-pill';
  }
}

// ─── Accent Color System ─────────────────────────────────────────────────────

export const CATEGORY_ACCENT: Record<string, string> = {
  peptide:       '190 100% 50%',    // cyan
  'injectable-oil': '39 100% 50%',  // amber
  nootropic:     '260 100% 65%',    // violet
  oral:          '142 80% 50%',     // emerald
  prescription:  '340 80% 60%',     // rose
  topical:       '35 40% 60%',      // sand
  powder:        '200 100% 63%',    // sky blue
  adaptogen:     '156 80% 58%',     // mint
  vitamin:       '45 100% 55%',     // gold
  holistic:      '156 80% 58%',     // mint (same as adaptogen)
  'essential-oil': '35 40% 60%',    // sand
  'alternative-medicine': '200 20% 55%', // slate
  probiotic:     '142 80% 50%',     // emerald
};

export function getAccentColor(category: string): string {
  return CATEGORY_ACCENT[category] || '200 20% 55%'; // slate default
}

// ─── Category Options for Step 1 ─────────────────────────────────────────────

export const CATEGORY_OPTIONS: { value: CompoundCategory; label: string }[] = [
  { value: 'peptide', label: 'Peptides' },
  { value: 'injectable-oil', label: 'Injectable Oils' },
  { value: 'nootropic', label: 'Nootropics' },
  { value: 'oral', label: 'Oral Supplements' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'topical', label: 'Topicals' },
  { value: 'powder', label: 'Powders' },
  { value: 'adaptogen', label: 'Adaptogens' },
  { value: 'vitamin', label: 'Vitamins' },
  { value: 'holistic', label: 'Holistic' },
];

// ─── Wizard State Machine Types ──────────────────────────────────────────────

export type WizardStep = 'IDLE' | 'STEP_1' | 'STEP_2' | 'STEP_3' | 'STEP_4' | 'STEP_5' | 'STEP_6' | 'SAVING' | 'SAVED' | 'ERROR';

export const STEP_ORDER: WizardStep[] = ['STEP_1', 'STEP_2', 'STEP_3', 'STEP_4', 'STEP_5', 'STEP_6'];

export function stepToIndex(step: WizardStep): number {
  const idx = STEP_ORDER.indexOf(step);
  return idx >= 0 ? idx : -1;
}

export function indexToStep(index: number): WizardStep {
  return STEP_ORDER[index] || 'STEP_1';
}

// ─── Wizard Form Data ────────────────────────────────────────────────────────

export interface WizardFormData {
  // Step 1 — Identity
  name: string;
  compoundType: CompoundType | null;
  category: CompoundCategory;
  purposeNote: string;

  // Step 2 — Configuration (varies by type)
  // Peptide
  powderWeightPerVial: string;
  powderWeightUnit: string;
  vialsInSupply: string;
  solventType: string;
  solventVolume: string;
  storagePreRecon: string;
  storagePostRecon: string;
  expiryAfterRecon: string;
  expiryAfterReconUnit: string;
  reconstitutionDate: string;
  syringeRecommendation: string;

  // Injectable Oil
  concentration: string;
  concentrationUnit: string;
  vialSizeMl: string;
  oilVialsInSupply: string;
  injectionSiteRotation: boolean;
  carrierOil: string;

  // Oral Pill
  formFactor: string;
  containerType: string;
  countPerContainer: string;
  containersInSupply: string;
  doseAmountPerUnit: string;
  doseAmountPerUnitUnit: string;
  unitsPerDose: string;
  takeWithFood: string;

  // Oral Powder
  containerSize: string;
  containerSizeUnit: string;
  powderContainersInSupply: string;
  doseWeightPerServing: string;
  doseWeightUnit: string;
  measuringMethod: string;
  scoopSize: string;
  scoopSizeUnit: string;
  scoopCountPerDose: string;
  mixInstructions: string;
  powderTakeWithFood: string;

  // Topical
  topicalForm: string;
  topicalContainerSize: string;
  topicalContainerSizeUnit: string;
  topicalContainersInSupply: string;
  applicationUnit: string;
  dosePerApplication: string;
  dosesPerContainer: string;
  autoCalcDosesPerContainer: boolean;
  applicationSite: string;
  absorptionWindow: string;

  // Prescription extras
  prescriptionForm: string;
  prescriber: string;
  pharmacy: string;
  rxNumber: string;
  refillDate: string;
  daysSupplyPerFill: string;
  controlledSubstance: boolean;
  insuranceNotes: string;

  // Step 3 — Dosing
  targetDose: string;
  targetDoseUnit: string;
  dosesPerDay: string;
  timings: string[];
  schedulePreset: string;
  customDays: number[];
  specialTimingNote: string;

  // Step 4 — Cycling
  cyclingEnabled: boolean;
  cycleOnDays: string;
  cycleOffDays: string;
  cycleStartDate: string;
  cycleNotes: string;

  // Step 5 — Inventory & Reorder
  currentSupply: string;
  reorderThresholdDays: string;
  orderFormat: string;
  kitSize: string;
  pricePerKit: string;
  pricePerUnit: string;
  subscriptionInterval: string;
  subscriptionPrice: string;
  reorderQuantity: string;
  supplierNotes: string;
  autoReorderAlert: boolean;

  // General
  notes: string;
  prepNotes: string;
  storageInstructions: string;
}

export const INITIAL_FORM_DATA: WizardFormData = {
  name: '',
  compoundType: 'oral-pill',
  category: 'oral',
  purposeNote: '',

  powderWeightPerVial: '',
  powderWeightUnit: 'mg',
  vialsInSupply: '1',
  solventType: '',
  solventVolume: '2',
  storagePreRecon: '',
  storagePostRecon: '',
  expiryAfterRecon: '28',
  expiryAfterReconUnit: 'days',
  reconstitutionDate: '',
  syringeRecommendation: '',

  concentration: '',
  concentrationUnit: 'mg/mL',
  vialSizeMl: '10',
  oilVialsInSupply: '1',
  injectionSiteRotation: false,
  carrierOil: '',

  formFactor: 'Capsule',
  containerType: 'Bottle',
  countPerContainer: '',
  containersInSupply: '1',
  doseAmountPerUnit: '',
  doseAmountPerUnitUnit: 'mg',
  unitsPerDose: '1',
  takeWithFood: 'Either',

  containerSize: '',
  containerSizeUnit: 'g',
  powderContainersInSupply: '1',
  doseWeightPerServing: '',
  doseWeightUnit: 'g',
  measuringMethod: 'Scoop',
  scoopSize: '',
  scoopSizeUnit: 'g',
  scoopCountPerDose: '1',
  mixInstructions: '',
  powderTakeWithFood: 'Either',

  topicalForm: 'Cream',
  topicalContainerSize: '',
  topicalContainerSizeUnit: 'mL',
  topicalContainersInSupply: '1',
  applicationUnit: 'Pump',
  dosePerApplication: '1',
  dosesPerContainer: '',
  autoCalcDosesPerContainer: false,
  applicationSite: '',
  absorptionWindow: '',

  prescriptionForm: 'Pill/Capsule',
  prescriber: '',
  pharmacy: '',
  rxNumber: '',
  refillDate: '',
  daysSupplyPerFill: '',
  controlledSubstance: false,
  insuranceNotes: '',

  targetDose: '',
  targetDoseUnit: 'mg',
  dosesPerDay: '1',
  timings: ['morning'],
  schedulePreset: 'Daily',
  customDays: [0, 1, 2, 3, 4, 5, 6],
  specialTimingNote: '',

  cyclingEnabled: false,
  cycleOnDays: '',
  cycleOffDays: '',
  cycleStartDate: '',
  cycleNotes: '',

  currentSupply: '1',
  reorderThresholdDays: '14',
  orderFormat: 'Single Unit',
  kitSize: '',
  pricePerKit: '',
  pricePerUnit: '',
  subscriptionInterval: '',
  subscriptionPrice: '',
  reorderQuantity: '1',
  supplierNotes: '',
  autoReorderAlert: true,

  notes: '',
  prepNotes: '',
  storageInstructions: '',
};

// ─── State Machine ───────────────────────────────────────────────────────────

export interface WizardState {
  step: WizardStep;
  formData: WizardFormData;
  highestStep: number; // highest completed step index
  error: string | null;
}

export type WizardEvent =
  | { type: 'START' }
  | { type: 'NEXT'; payload?: Partial<WizardFormData> }
  | { type: 'BACK' }
  | { type: 'JUMP'; stepNumber: number }
  | { type: 'UPDATE_FORM'; payload: Partial<WizardFormData> }
  | { type: 'SAVE' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR'; error: string }
  | { type: 'RESET' }
  | { type: 'EDIT_EXISTING'; formData: WizardFormData };

// ─── Timing Options ──────────────────────────────────────────────────────────

export const TIMING_OPTIONS = [
  { id: 'morning', icon: '🌅', label: 'Morning' },
  { id: 'midday', icon: '☀️', label: 'Midday' },
  { id: 'evening', icon: '🌙', label: 'Evening' },
  { id: 'pre-workout', icon: '💪', label: 'Pre-Workout' },
  { id: 'pre-sleep', icon: '😴', label: 'Pre-Sleep' },
  { id: 'with-meal', icon: '🍽️', label: 'With Meal' },
  { id: 'fasted', icon: '⏰', label: 'Fasted' },
] as const;

export const SCHEDULE_PRESETS = [
  { id: 'Daily', label: 'Daily', days: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'Weekdays', label: 'Weekdays (Mon–Fri)', days: [1, 2, 3, 4, 5] },
  { id: 'MWF', label: 'MWF', days: [1, 3, 5] },
  { id: 'EOD', label: 'EOD (Every Other Day)', days: [1, 3, 5] },
  { id: '5on2off', label: '5 on 2 off', days: [1, 2, 3, 4, 5] },
  { id: 'Custom', label: 'Custom', days: [] },
] as const;

export const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
