/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  DELIVERY METHOD TAXONOMY & CALCULATION ENGINE                   ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  Two-axis model:                                                 ║
 * ║    Category  = WHAT it is (peptide, vitamin, nootropic, etc.)   ║
 * ║    Delivery  = HOW you take it (SubQ injection, nasal spray…)   ║
 * ║                                                                  ║
 * ║  Each delivery method defines:                                   ║
 * ║    1. Required fields and their labels                           ║
 * ║    2. A math chain that converts container → doses available     ║
 * ║    3. Valid dose/container unit sets                              ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ─── Delivery Method Enum ────────────────────────────────────────────────────

export type DeliveryMethod =
  | 'subq-injection'       // Reconstituted peptide → syringe → subcutaneous
  | 'im-injection'         // Pre-mixed oil → syringe → intramuscular
  | 'oral-swallow'         // Pill, capsule, tablet, softgel
  | 'oral-powder'          // Loose powder, scoop/weigh → mix → drink
  | 'oral-liquid'          // Pre-mixed liquid, measured in mL or drops
  | 'sublingual'           // Under tongue — drops, tabs, or spray
  | 'nasal-spray'          // Fine-mist sprayer (peptides, nootropics, etc.)
  | 'topical-cream'        // Cream, lotion, gel — measured in pumps or applications
  | 'topical-patch'        // Transdermal patch
  | 'rectal'               // Suppository
  | 'inhaled'              // Nebulizer, inhaler
  | 'iv-drip';             // IV infusion (clinic-administered)

// ─── Metadata ────────────────────────────────────────────────────────────────

export interface DeliveryMethodMeta {
  id: DeliveryMethod;
  icon: string;
  label: string;
  subtitle: string;
  /** Which container/supply fields this method needs */
  containerFields: ContainerFieldSet;
  /** Which dosing fields this method needs */
  dosingFields: DosingFieldSet;
  /** The math chain to compute "doses available from supply" */
  mathChain: MathChainType;
  /** Valid dose units for this delivery method */
  validDoseUnits: string[];
  /** Valid container/supply units */
  validContainerUnits: string[];
  /** Whether reconstitution/dilution section is relevant */
  hasReconstitution: boolean;
  /** Whether injection site rotation is relevant */
  hasInjectionSites: boolean;
}

// ─── Field Sets ──────────────────────────────────────────────────────────────

export type ContainerFieldSet =
  | 'vial-weight'     // Peptide vial: powder weight (mg) + solvent → reconstitute
  | 'vial-volume'     // Oil vial: volume (mL) + concentration (mg/mL)
  | 'count-container' // Bottle of pills: count per container
  | 'weight-container'// Bag/tub of powder: total weight (g)
  | 'volume-container'// Liquid bottle: total volume (mL or fl oz)
  | 'spray-container' // Spray bottle: total volume + mL per spray → spray count
  | 'patch-box'       // Box of patches: count per box
  | 'suppository-box' // Box of suppositories: count per box
  | 'iv-bag';         // IV bag: volume (mL) + concentration

export type DosingFieldSet =
  | 'volume-dose'    // Dose in mL (draw with syringe)
  | 'weight-dose'    // Dose in mg/mcg/g
  | 'count-dose'     // Dose in pills/caps/tabs
  | 'spray-dose'     // Dose in sprays/pumps
  | 'pump-dose'      // Dose in pumps (topical)
  | 'patch-dose'     // Dose in patches (usually 1)
  | 'drop-dose'      // Dose in drops
  | 'application-dose'; // Dose in applications (generic topical)

// ─── Math Chain Types ────────────────────────────────────────────────────────
// Each type defines HOW we convert from container supply to doses available.

export type MathChainType =
  | 'reconstitute-then-draw'
  // vial powder (mg) + solvent (mL) → concentration (mg/mL)
  // → target dose (mg) / concentration = draw volume (mL)
  // → vial volume / draw volume = doses per vial
  // → doses per vial × vials on hand = total doses

  | 'concentration-draw'
  // oil vial: concentration (mg/mL) × vial volume (mL) = total mg
  // → target dose (mg) / concentration = draw volume (mL)
  // → vial volume / draw volume = doses per vial
  // → doses per vial × vials on hand = total doses

  | 'count-divide'
  // bottle of pills: count per container / pills per dose = doses per container
  // → doses per container × containers on hand = total doses

  | 'weight-divide'
  // powder: total weight (g) / dose weight (g) = doses per container
  // → doses per container × containers on hand = total doses

  | 'volume-to-drops'
  // liquid: total volume (mL) × drops per mL (≈20) = total drops
  // → total drops / drops per dose = total doses
  // Alternate: total volume / mL per dose = total doses

  | 'volume-to-sprays'
  // spray bottle: total volume (mL) / mL per spray = total sprays
  // → total sprays / sprays per dose = total doses
  // → mg per spray = total powder (mg) / total sprays
  // → mg per dose = mg per spray × sprays per dose

  | 'patch-count'
  // box: patches per box / patches per dose (usually 1) = doses per box
  // → doses per box × boxes on hand = total doses

  | 'suppository-count'
  // box: count per box / count per dose (usually 1) = doses per box

  | 'iv-volume';
  // bag: total volume / volume per infusion = sessions per bag

// ─── Delivery Method Registry ────────────────────────────────────────────────

export const DELIVERY_METHODS: Record<DeliveryMethod, DeliveryMethodMeta> = {

  'subq-injection': {
    id: 'subq-injection',
    icon: '💉',
    label: 'Under-the-skin injection',
    subtitle: 'Mix the powder, draw into syringe, inject under the skin',
    containerFields: 'vial-weight',
    dosingFields: 'weight-dose',
    mathChain: 'reconstitute-then-draw',
    validDoseUnits: ['mg', 'mcg', 'IU'],
    validContainerUnits: ['mg vial'],
    hasReconstitution: true,
    hasInjectionSites: true,
  },

  'im-injection': {
    id: 'im-injection',
    icon: '💉',
    label: 'Muscle injection',
    subtitle: 'Draw the oil into a syringe, inject into muscle',
    containerFields: 'vial-volume',
    dosingFields: 'weight-dose',
    mathChain: 'concentration-draw',
    validDoseUnits: ['mg', 'mL'],
    validContainerUnits: ['mL vial'],
    hasReconstitution: false,
    hasInjectionSites: true,
  },

  'oral-swallow': {
    id: 'oral-swallow',
    icon: '💊',
    label: 'Oral Pill / Capsule',
    subtitle: 'Swallow whole — capsule, tablet, softgel',
    containerFields: 'count-container',
    dosingFields: 'count-dose',
    mathChain: 'count-divide',
    validDoseUnits: ['caps', 'tabs', 'softgels', 'pills', 'mg', 'mcg', 'IU'],
    validContainerUnits: ['caps', 'tabs', 'softgels', 'pills'],
    hasReconstitution: false,
    hasInjectionSites: false,
  },

  'oral-powder': {
    id: 'oral-powder',
    icon: '🥄',
    label: 'Oral Powder',
    subtitle: 'Scoop/weigh → mix → drink',
    containerFields: 'weight-container',
    dosingFields: 'weight-dose',
    mathChain: 'weight-divide',
    validDoseUnits: ['g', 'mg', 'mcg', 'scoops'],
    validContainerUnits: ['g', 'oz', 'lb', 'scoops', 'servings'],
    hasReconstitution: false,
    hasInjectionSites: false,
  },

  'oral-liquid': {
    id: 'oral-liquid',
    icon: '💧',
    label: 'Oral Liquid',
    subtitle: 'Measured liquid — drops, mL, tsp',
    containerFields: 'volume-container',
    dosingFields: 'drop-dose',
    mathChain: 'volume-to-drops',
    validDoseUnits: ['drops', 'mL', 'tsp', 'tbsp'],
    validContainerUnits: ['mL', 'fl oz', 'oz', 'L'],
    hasReconstitution: false,
    hasInjectionSites: false,
  },

  'sublingual': {
    id: 'sublingual',
    icon: '👅',
    label: 'Under the tongue',
    subtitle: 'Under tongue — drops, tabs, or spray',
    containerFields: 'volume-container',
    dosingFields: 'drop-dose',
    mathChain: 'volume-to-drops',
    validDoseUnits: ['drops', 'mg', 'mcg', 'tabs', 'sprays'],
    validContainerUnits: ['mL', 'fl oz', 'tabs', 'sprays'],
    hasReconstitution: false,
    hasInjectionSites: false,
  },

  'nasal-spray': {
    id: 'nasal-spray',
    icon: '🫁',
    label: 'Nasal Spray',
    subtitle: 'Fine-mist sprayer — peptides, nootropics, etc.',
    containerFields: 'spray-container',
    dosingFields: 'spray-dose',
    mathChain: 'volume-to-sprays',
    validDoseUnits: ['sprays', 'mg', 'mcg'],
    validContainerUnits: ['mL', 'fl oz'],
    hasReconstitution: true, // peptide sprays need reconstitution
    hasInjectionSites: false,
  },

  'topical-cream': {
    id: 'topical-cream',
    icon: '🧴',
    label: 'Topical Cream / Gel',
    subtitle: 'Apply to skin — cream, lotion, gel, ointment',
    containerFields: 'volume-container',
    dosingFields: 'pump-dose',
    mathChain: 'volume-to-sprays', // same math: volume / mL-per-pump
    validDoseUnits: ['pumps', 'mg', 'mL', 'applications'],
    validContainerUnits: ['mL', 'fl oz', 'oz', 'g'],
    hasReconstitution: false,
    hasInjectionSites: false,
  },

  'topical-patch': {
    id: 'topical-patch',
    icon: '🩹',
    label: 'Skin patch',
    subtitle: 'Stick-on patch — slow release through skin',
    containerFields: 'patch-box',
    dosingFields: 'patch-dose',
    mathChain: 'patch-count',
    validDoseUnits: ['patches', 'mg'],
    validContainerUnits: ['patches'],
    hasReconstitution: false,
    hasInjectionSites: false,
  },

  'rectal': {
    id: 'rectal',
    icon: '💊',
    label: 'Suppository',
    subtitle: 'Rectal or vaginal suppository',
    containerFields: 'suppository-box',
    dosingFields: 'count-dose',
    mathChain: 'suppository-count',
    validDoseUnits: ['units', 'mg'],
    validContainerUnits: ['units'],
    hasReconstitution: false,
    hasInjectionSites: false,
  },

  'inhaled': {
    id: 'inhaled',
    icon: '🌬️',
    label: 'Inhaled / Nebulized',
    subtitle: 'Inhaler, nebulizer, or vaporizer',
    containerFields: 'volume-container',
    dosingFields: 'spray-dose',
    mathChain: 'volume-to-sprays',
    validDoseUnits: ['puffs', 'mL', 'mg'],
    validContainerUnits: ['mL', 'puffs'],
    hasReconstitution: false,
    hasInjectionSites: false,
  },

  'iv-drip': {
    id: 'iv-drip',
    icon: '🩸',
    label: 'IV drip (clinic)',
    subtitle: 'Given through an IV at a clinic',
    containerFields: 'iv-bag',
    dosingFields: 'volume-dose',
    mathChain: 'iv-volume',
    validDoseUnits: ['mL', 'mg'],
    validContainerUnits: ['mL'],
    hasReconstitution: false,
    hasInjectionSites: false,
  },
};

// ─── Field Definitions per Container Type ────────────────────────────────────
// These define WHICH inputs appear in Step 2 of the wizard.

export interface FieldDef {
  key: string;
  label: string;
  unit?: string;
  type: 'number' | 'text' | 'select';
  required: boolean;
  helpText?: string;
  options?: string[];
}

export const CONTAINER_FIELDS: Record<ContainerFieldSet, FieldDef[]> = {
  'vial-weight': [
    { key: 'powderWeightPerVial', label: 'Powder per vial', unit: 'mg', type: 'number', required: true, helpText: 'Total active compound weight in each vial' },
    { key: 'vialsInSupply', label: 'Vials on hand', type: 'number', required: true },
    { key: 'solventType', label: 'Solvent', type: 'select', required: true, options: ['Bacteriostatic Water', 'Sterile Water', 'Normal Saline', 'Other'] },
    { key: 'solventVolume', label: 'Solvent volume', unit: 'mL', type: 'number', required: true, helpText: 'mL of solvent added to each vial' },
  ],

  'vial-volume': [
    { key: 'concentration', label: 'Concentration', unit: 'mg/mL', type: 'number', required: true },
    { key: 'vialSizeMl', label: 'Vial size', unit: 'mL', type: 'number', required: true },
    { key: 'oilVialsInSupply', label: 'Vials on hand', type: 'number', required: true },
    { key: 'carrierOil', label: 'Carrier oil', type: 'select', required: false, options: ['MCT Oil', 'Grape Seed Oil', 'Sesame Oil', 'Castor Oil', 'Other'] },
  ],

  'count-container': [
    { key: 'countPerContainer', label: 'Count per container', type: 'number', required: true, helpText: 'Total pills/caps/tabs per bottle' },
    { key: 'containersInSupply', label: 'Containers on hand', type: 'number', required: true },
    { key: 'doseAmountPerUnit', label: 'Dose amount per unit', type: 'number', required: true, helpText: 'mg/mcg/IU per single pill or cap' },
    { key: 'doseAmountPerUnitUnit', label: 'Unit', type: 'select', required: true, options: ['mg', 'mcg', 'IU', 'g'] },
    { key: 'unitsPerDose', label: 'Units per dose', type: 'number', required: true, helpText: 'How many pills/caps per single dose' },
  ],

  'weight-container': [
    { key: 'containerSize', label: 'Container size', type: 'number', required: true },
    { key: 'containerSizeUnit', label: 'Unit', type: 'select', required: true, options: ['g', 'oz', 'lb', 'kg'] },
    { key: 'powderContainersInSupply', label: 'Containers on hand', type: 'number', required: true },
    { key: 'doseWeightPerServing', label: 'Weight per serving', type: 'number', required: true },
    { key: 'doseWeightUnit', label: 'Unit', type: 'select', required: true, options: ['g', 'mg', 'mcg', 'oz'] },
  ],

  'volume-container': [
    { key: 'containerVolume', label: 'Container volume', type: 'number', required: true },
    { key: 'containerVolumeUnit', label: 'Unit', type: 'select', required: true, options: ['mL', 'fl oz', 'oz', 'L'] },
    { key: 'liquidContainersInSupply', label: 'Containers on hand', type: 'number', required: true },
    { key: 'activeIngredientTotal', label: 'Total active ingredient', unit: 'mg', type: 'number', required: false, helpText: 'Total mg of active compound in the container (for mg-per-dose calculation)' },
  ],

  'spray-container': [
    { key: 'containerVolume', label: 'Container volume', type: 'number', required: true, helpText: 'Total liquid volume in the spray bottle' },
    { key: 'containerVolumeUnit', label: 'Unit', type: 'select', required: true, options: ['mL', 'fl oz'] },
    { key: 'mlPerSpray', label: 'mL per spray', type: 'number', required: true, helpText: 'Volume dispensed per pump/spray (typical fine mist: 0.05–0.1 mL)' },
    { key: 'activeIngredientTotal', label: 'Total active ingredient', unit: 'mg', type: 'number', required: true, helpText: 'Total mg of active compound dissolved in the bottle' },
    { key: 'sprayContainersInSupply', label: 'Containers on hand', type: 'number', required: true },
  ],

  'patch-box': [
    { key: 'patchesPerBox', label: 'Patches per box', type: 'number', required: true },
    { key: 'patchBoxesInSupply', label: 'Boxes on hand', type: 'number', required: true },
    { key: 'patchStrength', label: 'Strength per patch', unit: 'mg', type: 'number', required: false, helpText: 'Active ingredient per patch (for tracking)' },
    { key: 'wearDurationHours', label: 'Wear duration', unit: 'hours', type: 'number', required: false, helpText: 'How long each patch is worn' },
  ],

  'suppository-box': [
    { key: 'countPerBox', label: 'Count per box', type: 'number', required: true },
    { key: 'boxesInSupply', label: 'Boxes on hand', type: 'number', required: true },
    { key: 'strengthPerUnit', label: 'Strength per unit', unit: 'mg', type: 'number', required: false },
  ],

  'iv-bag': [
    { key: 'bagVolumeMl', label: 'Bag volume', unit: 'mL', type: 'number', required: true },
    { key: 'ivConcentration', label: 'Concentration', unit: 'mg/mL', type: 'number', required: false },
    { key: 'bagsInSupply', label: 'Bags on hand', type: 'number', required: true },
  ],
};

// ─── Math Chain Implementations ──────────────────────────────────────────────
// Each function takes container + dosing params and returns total doses available.

export interface SupplyCalcInput {
  // Container fields (not all used by every chain)
  powderWeightMg?: number;        // vial-weight
  solventVolumeMl?: number;       // vial-weight reconstitution
  concentrationMgMl?: number;     // vial-volume, iv-bag
  vialSizeMl?: number;            // vial-volume
  countPerContainer?: number;     // count-container, patch-box, suppository
  containerWeightG?: number;      // weight-container total weight in grams
  containerVolumeMl?: number;     // volume-container, spray-container
  mlPerSpray?: number;            // spray-container
  activeIngredientTotalMg?: number; // spray-container, volume-container
  containersOnHand?: number;      // all types

  // Dosing fields
  doseAmount?: number;            // target dose amount
  doseUnit?: string;              // target dose unit
  unitsPerDose?: number;          // pills/caps per dose (count-container)
  dropsPerDose?: number;          // drops per dose
  spraysPerDose?: number;         // sprays per dose
}

export interface SupplyCalcResult {
  dosesPerContainer: number;
  totalDosesAvailable: number;
  totalSpraysAvailable?: number;  // spray-specific
  mgPerSpray?: number;            // spray-specific
  mgPerDose?: number;             // computed mg per dose
  drawVolumeMl?: number;          // injection-specific
  concentrationMgMl?: number;     // computed concentration
  daysRemaining?: number;         // computed from dosesPerDay + daysPerWeek
}

const ML_PER_FL_OZ = 29.5735;
const DROPS_PER_ML = 20;

/** Convert volume to mL */
export function toMl(value: number, unit: string): number {
  const u = unit.toLowerCase().replace(/\s/g, '');
  if (u === 'ml') return value;
  if (u === 'floz' || u === 'fl oz') return value * ML_PER_FL_OZ;
  if (u === 'oz') return value * ML_PER_FL_OZ; // assume fluid oz
  if (u === 'l') return value * 1000;
  return value;
}

/** Convert weight to grams */
export function toGrams(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === 'g') return value;
  if (u === 'mg') return value / 1000;
  if (u === 'mcg' || u === 'µg') return value / 1_000_000;
  if (u === 'kg') return value * 1000;
  if (u === 'oz') return value * 28.3495;
  if (u === 'lb') return value * 453.592;
  return value;
}

export function calculateSupply(chain: MathChainType, input: SupplyCalcInput): SupplyCalcResult {
  const containers = input.containersOnHand ?? 1;

  switch (chain) {
    case 'reconstitute-then-draw': {
      // Peptide vial: powder (mg) dissolved in solvent (mL) → concentration
      const powderMg = input.powderWeightMg ?? 0;
      const solventMl = input.solventVolumeMl ?? 1;
      const conc = powderMg / solventMl; // mg/mL
      const targetMg = input.doseAmount ?? 0;
      const drawMl = targetMg > 0 && conc > 0 ? targetMg / conc : 0;
      const dosesPerVial = drawMl > 0 ? Math.floor(solventMl / drawMl) : 0;
      return {
        dosesPerContainer: dosesPerVial,
        totalDosesAvailable: dosesPerVial * containers,
        drawVolumeMl: drawMl,
        concentrationMgMl: conc,
        mgPerDose: targetMg,
      };
    }

    case 'concentration-draw': {
      // Oil vial: pre-mixed concentration
      const conc = input.concentrationMgMl ?? 0;
      const vialMl = input.vialSizeMl ?? 0;
      const targetMg = input.doseAmount ?? 0;
      const drawMl = targetMg > 0 && conc > 0 ? targetMg / conc : 0;
      const dosesPerVial = drawMl > 0 ? Math.floor(vialMl / drawMl) : 0;
      return {
        dosesPerContainer: dosesPerVial,
        totalDosesAvailable: dosesPerVial * containers,
        drawVolumeMl: drawMl,
        concentrationMgMl: conc,
        mgPerDose: targetMg,
      };
    }

    case 'count-divide': {
      const count = input.countPerContainer ?? 0;
      const perDose = input.unitsPerDose ?? 1;
      const dosesPerContainer = perDose > 0 ? Math.floor(count / perDose) : 0;
      return {
        dosesPerContainer,
        totalDosesAvailable: dosesPerContainer * containers,
        mgPerDose: input.doseAmount,
      };
    }

    case 'weight-divide': {
      const totalG = input.containerWeightG ?? 0;
      const doseG = input.doseAmount ?? 0;
      // Assume doseAmount is in same unit as container after conversion
      const dosesPerContainer = doseG > 0 ? Math.floor(totalG / doseG) : 0;
      return {
        dosesPerContainer,
        totalDosesAvailable: dosesPerContainer * containers,
        mgPerDose: doseG * 1000, // convert g to mg for display
      };
    }

    case 'volume-to-drops': {
      const volumeMl = input.containerVolumeMl ?? 0;
      const totalDrops = volumeMl * DROPS_PER_ML;
      const dropsPerDose = input.dropsPerDose ?? 1;
      const dosesPerContainer = dropsPerDose > 0 ? Math.floor(totalDrops / dropsPerDose) : 0;
      const activeMg = input.activeIngredientTotalMg ?? 0;
      const mgPerDrop = totalDrops > 0 && activeMg > 0 ? activeMg / totalDrops : undefined;
      return {
        dosesPerContainer,
        totalDosesAvailable: dosesPerContainer * containers,
        mgPerDose: mgPerDrop && dropsPerDose ? mgPerDrop * dropsPerDose : undefined,
      };
    }

    case 'volume-to-sprays': {
      // Spray bottle: volume / mL-per-spray = total sprays
      const volumeMl = input.containerVolumeMl ?? 0;
      const mlPerSpray = input.mlPerSpray ?? 0.1; // default fine mist
      const totalSprays = mlPerSpray > 0 ? Math.floor(volumeMl / mlPerSpray) : 0;
      const spraysPerDose = input.spraysPerDose ?? 1;
      const dosesPerContainer = spraysPerDose > 0 ? Math.floor(totalSprays / spraysPerDose) : 0;
      const activeMg = input.activeIngredientTotalMg ?? 0;
      const mgPerSpray = totalSprays > 0 && activeMg > 0 ? activeMg / totalSprays : undefined;
      return {
        dosesPerContainer,
        totalDosesAvailable: dosesPerContainer * containers,
        totalSpraysAvailable: totalSprays,
        mgPerSpray,
        mgPerDose: mgPerSpray && spraysPerDose ? mgPerSpray * spraysPerDose : undefined,
      };
    }

    case 'patch-count': {
      const count = input.countPerContainer ?? 0;
      // Usually 1 patch per dose
      return {
        dosesPerContainer: count,
        totalDosesAvailable: count * containers,
        mgPerDose: input.doseAmount,
      };
    }

    case 'suppository-count': {
      const count = input.countPerContainer ?? 0;
      return {
        dosesPerContainer: count,
        totalDosesAvailable: count * containers,
        mgPerDose: input.doseAmount,
      };
    }

    case 'iv-volume': {
      const bagMl = input.containerVolumeMl ?? 0;
      const doseMl = input.doseAmount ?? bagMl; // usually 1 bag = 1 session
      const dosesPerBag = doseMl > 0 ? Math.floor(bagMl / doseMl) : 1;
      return {
        dosesPerContainer: dosesPerBag,
        totalDosesAvailable: dosesPerBag * containers,
        mgPerDose: input.concentrationMgMl && doseMl ? input.concentrationMgMl * doseMl : undefined,
      };
    }
  }
}

// ─── Category → Allowed Delivery Methods ─────────────────────────────────────
// Not every category can use every delivery method. This maps which are valid.

export const CATEGORY_DELIVERY_MAP: Record<string, DeliveryMethod[]> = {
  'peptide':              ['subq-injection', 'nasal-spray', 'oral-swallow', 'sublingual', 'topical-cream'],
  'injectable-oil':       ['im-injection', 'subq-injection'],
  'oral':                 ['oral-swallow', 'oral-powder', 'oral-liquid', 'sublingual'],
  'powder':               ['oral-powder', 'oral-liquid', 'nasal-spray'],
  'vitamin':              ['oral-swallow', 'oral-liquid', 'sublingual', 'oral-powder', 'topical-patch', 'nasal-spray'],
  'prescription':         ['oral-swallow', 'subq-injection', 'im-injection', 'topical-cream', 'topical-patch', 'nasal-spray', 'inhaled', 'rectal', 'sublingual', 'oral-liquid', 'iv-drip'],
  'nootropic':            ['oral-swallow', 'oral-powder', 'nasal-spray', 'sublingual', 'oral-liquid'],
  'adaptogen':            ['oral-swallow', 'oral-powder', 'oral-liquid'],
  'holistic':             ['oral-swallow', 'oral-powder', 'oral-liquid', 'topical-cream', 'sublingual'],
  'essential-oil':        ['topical-cream', 'oral-liquid', 'sublingual', 'inhaled'],
  'alternative-medicine': ['oral-swallow', 'oral-powder', 'oral-liquid', 'topical-cream', 'sublingual', 'rectal'],
  'probiotic':            ['oral-swallow', 'oral-powder', 'rectal'],
  'topical':              ['topical-cream', 'topical-patch', 'nasal-spray'],
};

/** Get default delivery method for a category */
export function getDefaultDeliveryMethod(category: string): DeliveryMethod {
  const methods = CATEGORY_DELIVERY_MAP[category];
  return methods?.[0] ?? 'oral-swallow';
}

/** Get allowed delivery methods for a category */
export function getAllowedDeliveryMethods(category: string): DeliveryMethodMeta[] {
  const methods = CATEGORY_DELIVERY_MAP[category] ?? ['oral-swallow'];
  return methods.map(id => DELIVERY_METHODS[id]);
}

// ─── Helper: Spray bottle example (the user's peptide-in-spray-bottle case) ──
// 
// Input:
//   Container: 2 fl oz (= 59.15 mL) spray bottle
//   Active: 200 mg of peptide dissolved in the bottle
//   mL per spray: 0.1 mL (standard fine mist)
//   Sprays per dose: 2
//
// Math chain (volume-to-sprays):
//   totalSprays = 59.15 / 0.1 = 591 sprays
//   mgPerSpray = 200 / 591 = 0.338 mg/spray
//   dosesPerContainer = 591 / 2 = 295 doses
//   mgPerDose = 0.338 × 2 = 0.677 mg/dose
//
// Inventory:
//   At 2 doses/day, 7 days/week → 2 doses/day = 147.5 days supply
