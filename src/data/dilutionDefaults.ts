/**
 * Smart dilution/reconstitution defaults by compound name and category.
 * When a compound is added, these defaults auto-populate the dilution fields.
 * Users can override any field.
 */

export interface DilutionDefault {
  solventType: string;
  solventVolume: number;
  solventUnit: string;
  resultingConcentration?: number;
  concentrationUnit?: string;
  storageInstructions?: string;
  prepNotes?: string;
}

/** Lookup by compound name (case-insensitive). Falls back to category defaults. */
const COMPOUND_DILUTION_MAP: Record<string, DilutionDefault> = {
  // ═══ Special compounds with unique dilution protocols ═══
  'methylene blue': {
    solventType: 'Reverse Osmosis Water',
    solventVolume: 2,
    solventUnit: 'oz',
    storageInstructions: 'Store in dark glass bottle, room temp. Avoid light exposure.',
    prepNotes: 'Add lyophilized powder to 2oz RO water. Shake gently until fully dissolved. Solution should be deep blue.',
  },
  'nad+ nasal spray': {
    solventType: 'Sterile Saline',
    solventVolume: 10,
    solventUnit: 'mL',
    storageInstructions: 'Refrigerate. Use within 30 days.',
    prepNotes: 'Dissolve lyophilized NAD+ in sterile saline. Transfer to nasal spray bottle.',
  },
  'glutathione nasal': {
    solventType: 'Sterile Saline',
    solventVolume: 10,
    solventUnit: 'mL',
    storageInstructions: 'Refrigerate. Use within 14 days.',
    prepNotes: 'Dissolve in sterile saline. Transfer to nasal spray bottle.',
  },
  'bpc-157 oral': {
    solventType: 'Reverse Osmosis Water',
    solventVolume: 30,
    solventUnit: 'mL',
    storageInstructions: 'Refrigerate. Use within 14 days.',
    prepNotes: 'Dissolve lyophilized BPC-157 in RO water for oral dosing. Take sublingually for best absorption.',
  },
};

/** Category-level defaults */
const CATEGORY_DILUTION_MAP: Record<string, DilutionDefault> = {
  peptide: {
    solventType: 'Bacteriostatic Water',
    solventVolume: 2,
    solventUnit: 'mL',
    storageInstructions: 'Refrigerate after reconstitution. Use within 28 days.',
    prepNotes: 'Inject bacteriostatic water slowly along vial wall. Swirl gently — do not shake. Allow to dissolve fully before drawing.',
  },
  'injectable-oil': {
    solventType: 'Pre-mixed (carrier oil)',
    solventVolume: 0,
    solventUnit: 'mL',
    storageInstructions: 'Store at room temperature. Protect from light.',
    prepNotes: 'Ready to inject — no reconstitution needed. Warm vial in hands for 60s to reduce PIP.',
  },
};

/**
 * Get dilution defaults for a compound.
 * Priority: exact name match → category default → null
 */
export function getDilutionDefaults(compoundName: string, category: string): DilutionDefault | null {
  const key = compoundName.toLowerCase().trim();
  if (COMPOUND_DILUTION_MAP[key]) return COMPOUND_DILUTION_MAP[key];
  if (CATEGORY_DILUTION_MAP[category]) return CATEGORY_DILUTION_MAP[category];
  return null;
}

/**
 * Calculate resulting concentration from compound data + dilution info.
 * Returns { value, unit } or null if not calculable.
 */
export function calculateConcentration(
  unitSize: number,       // mg per vial
  unitLabel: string,
  solventVolume: number,
  solventUnit: string,
): { value: number; unit: string } | null {
  if (!unitSize || !solventVolume || solventVolume <= 0) return null;
  
  // Convert solvent volume to mL for calculation
  let volumeMl = solventVolume;
  if (solventUnit === 'oz') volumeMl = solventVolume * 29.5735;
  else if (solventUnit === 'L') volumeMl = solventVolume * 1000;
  
  if (volumeMl <= 0) return null;

  // Determine if unitSize is in mg
  const ul = unitLabel.toLowerCase();
  if (ul.includes('mg') && !ul.includes('ml')) {
    const concMg = unitSize / volumeMl;
    if (concMg < 1) return { value: Math.round(concMg * 1000 * 100) / 100, unit: 'mcg/mL' };
    return { value: Math.round(concMg * 100) / 100, unit: 'mg/mL' };
  }
  
  return null;
}

/**
 * Build a human-readable prep guide from compound + dilution data.
 */
export function buildPrepGuide(compound: {
  name: string;
  category: string;
  unitSize: number;
  unitLabel: string;
  dosePerUse: number;
  doseLabel: string;
  bacstatPerVial?: number;
  reconVolume?: number;
  solventType?: string;
  solventVolume?: number;
  solventUnit?: string;
  resultingConcentration?: number;
  concentrationUnit?: string;
  storageInstructions?: string;
  prepNotes?: string;
}): PrepGuide | null {
  // Use stored dilution data or fall back to defaults
  const defaults = getDilutionDefaults(compound.name, compound.category);
  const solventType = compound.solventType || defaults?.solventType;
  const solventVolume = compound.solventVolume || defaults?.solventVolume;
  const solventUnit = compound.solventUnit || defaults?.solventUnit || 'mL';
  const storage = compound.storageInstructions || defaults?.storageInstructions;
  const prepNotes = compound.prepNotes || defaults?.prepNotes;
  
  // Need at least a solvent type to show anything
  if (!solventType) return null;
  // Skip "pre-mixed" compounds unless they have custom notes
  if (solventType.toLowerCase().includes('pre-mixed') && !compound.prepNotes && !compound.storageInstructions) return null;

  // Calculate concentration
  let concentration: { value: number; unit: string } | null = null;
  if (compound.resultingConcentration && compound.concentrationUnit) {
    concentration = { value: compound.resultingConcentration, unit: compound.concentrationUnit };
  } else if (solventVolume && solventVolume > 0) {
    concentration = calculateConcentration(compound.unitSize, compound.unitLabel, solventVolume, solventUnit);
  }

  // Calculate dose volume (how much liquid per dose)
  let doseVolume: string | null = null;
  if (concentration && concentration.value > 0 && compound.dosePerUse > 0) {
    const dl = compound.doseLabel.toLowerCase();
    if (dl.includes('mg') || dl.includes('mcg')) {
      let doseMg = compound.dosePerUse;
      if (dl.includes('mcg')) doseMg = compound.dosePerUse / 1000;
      let concMg = concentration.value;
      if (concentration.unit === 'mcg/mL') concMg = concentration.value / 1000;
      const mlPerDose = doseMg / concMg;
      if (mlPerDose > 0 && mlPerDose < 100) {
        doseVolume = `${mlPerDose.toFixed(2)} mL/dose`;
      }
    }
  }

  // For peptides with bacstat data, use IU-based dose volume
  if (compound.bacstatPerVial && compound.reconVolume && compound.dosePerUse > 0) {
    const iuPerMl = compound.bacstatPerVial / compound.reconVolume;
    const mlPerDose = compound.dosePerUse / iuPerMl;
    doseVolume = `${mlPerDose.toFixed(2)} mL/dose`;
  }

  // Calculate doses per vial
  let dosesPerVial: number | null = null;
  if (compound.bacstatPerVial && compound.dosePerUse > 0) {
    dosesPerVial = Math.floor(compound.bacstatPerVial / compound.dosePerUse);
  } else if (concentration && compound.dosePerUse > 0 && solventVolume) {
    let volumeMl = solventVolume;
    if (solventUnit === 'oz') volumeMl = solventVolume * 29.5735;
    const dl = compound.doseLabel.toLowerCase();
    if (dl.includes('mg')) {
      dosesPerVial = Math.floor((concentration.value * volumeMl) / compound.dosePerUse);
    }
  }

  return {
    solventType,
    solventVolume: solventVolume || 0,
    solventUnit,
    concentration: concentration ? `${concentration.value} ${concentration.unit}` : null,
    doseVolume,
    dosesPerVial,
    storageInstructions: storage || null,
    prepNotes: prepNotes || null,
  };
}

export interface PrepGuide {
  solventType: string;
  solventVolume: number;
  solventUnit: string;
  concentration: string | null;
  doseVolume: string | null;
  dosesPerVial: number | null;
  storageInstructions: string | null;
  prepNotes: string | null;
}
