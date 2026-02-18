/**
 * Age- and gender-aware reference ranges for common biomarkers.
 * Ranges are approximate clinical guidelines — not a substitute for medical advice.
 */

export interface ReferenceRange {
  low: number;
  high: number;
  unit: string;
  label?: string; // optional display label e.g. "Optimal" vs "Standard"
}

interface RangeEntry {
  /** Gender: 'male' | 'female' | 'any' */
  gender?: 'male' | 'female' | 'any';
  /** Min age (inclusive). Omit = no lower bound */
  minAge?: number;
  /** Max age (inclusive). Omit = no upper bound */
  maxAge?: number;
  range: ReferenceRange;
}

// Normalise a biomarker name for lookup
export function normaliseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Map of normalised name → array of conditional range entries
// Checked in order; first match wins
const RANGES: Record<string, RangeEntry[]> = {
  // ─── Testosterone ─────────────────────────────────────────────
  testosterone: [
    { gender: 'male', minAge: 18, range: { low: 264, high: 916, unit: 'ng/dL' } },
    { gender: 'female', minAge: 18, range: { low: 15, high: 70, unit: 'ng/dL' } },
  ],
  totaltestosterone: [
    { gender: 'male', minAge: 18, range: { low: 264, high: 916, unit: 'ng/dL' } },
    { gender: 'female', minAge: 18, range: { low: 15, high: 70, unit: 'ng/dL' } },
  ],
  freetestosterone: [
    { gender: 'male', range: { low: 9, high: 30, unit: 'ng/dL' } },
    { gender: 'female', range: { low: 0.3, high: 1.9, unit: 'ng/dL' } },
  ],
  // ─── Estrogen / Estradiol ─────────────────────────────────────
  estradiol: [
    { gender: 'male', range: { low: 10, high: 40, unit: 'pg/mL' } },
    { gender: 'female', range: { low: 15, high: 350, unit: 'pg/mL', label: 'Varies by cycle phase' } },
  ],
  estrogen: [
    { gender: 'male', range: { low: 10, high: 40, unit: 'pg/mL' } },
    { gender: 'female', range: { low: 15, high: 350, unit: 'pg/mL', label: 'Varies by cycle phase' } },
  ],
  // ─── Blood Count ─────────────────────────────────────────────
  hemoglobin: [
    { gender: 'male', range: { low: 13.5, high: 17.5, unit: 'g/dL' } },
    { gender: 'female', range: { low: 12.0, high: 15.5, unit: 'g/dL' } },
  ],
  hematocrit: [
    { gender: 'male', range: { low: 38.8, high: 50.0, unit: '%' } },
    { gender: 'female', range: { low: 34.9, high: 44.5, unit: '%' } },
  ],
  redbloodcells: [
    { gender: 'male', range: { low: 4.5, high: 5.9, unit: 'M/uL' } },
    { gender: 'female', range: { low: 4.1, high: 5.1, unit: 'M/uL' } },
  ],
  rbc: [
    { gender: 'male', range: { low: 4.5, high: 5.9, unit: 'M/uL' } },
    { gender: 'female', range: { low: 4.1, high: 5.1, unit: 'M/uL' } },
  ],
  whitebloodcells: [{ range: { low: 4.5, high: 11.0, unit: 'K/uL' } }],
  wbc: [{ range: { low: 4.5, high: 11.0, unit: 'K/uL' } }],
  platelets: [{ range: { low: 150, high: 400, unit: 'K/uL' } }],
  // ─── Metabolic ───────────────────────────────────────────────
  glucose: [{ range: { low: 70, high: 100, unit: 'mg/dL' } }],
  fastingglucose: [{ range: { low: 70, high: 99, unit: 'mg/dL' } }],
  hba1c: [{ range: { low: 4.0, high: 5.7, unit: '%' } }],
  insulin: [{ range: { low: 2.6, high: 24.9, unit: 'uIU/mL' } }],
  // ─── Lipids ──────────────────────────────────────────────────
  cholesterol: [{ range: { low: 125, high: 200, unit: 'mg/dL' } }],
  totalcholesterol: [{ range: { low: 125, high: 200, unit: 'mg/dL' } }],
  ldl: [{ range: { low: 0, high: 100, unit: 'mg/dL' } }],
  ldlcholesterol: [{ range: { low: 0, high: 100, unit: 'mg/dL' } }],
  hdl: [
    { gender: 'male', range: { low: 40, high: 60, unit: 'mg/dL' } },
    { gender: 'female', range: { low: 50, high: 60, unit: 'mg/dL' } },
  ],
  hdlcholesterol: [
    { gender: 'male', range: { low: 40, high: 60, unit: 'mg/dL' } },
    { gender: 'female', range: { low: 50, high: 60, unit: 'mg/dL' } },
  ],
  triglycerides: [{ range: { low: 0, high: 150, unit: 'mg/dL' } }],
  // ─── Thyroid ─────────────────────────────────────────────────
  tsh: [{ range: { low: 0.4, high: 4.0, unit: 'mIU/L' } }],
  t3: [{ range: { low: 100, high: 200, unit: 'ng/dL' } }],
  freet3: [{ range: { low: 2.3, high: 4.2, unit: 'pg/mL' } }],
  t4: [{ range: { low: 5.0, high: 12.0, unit: 'ug/dL' } }],
  freet4: [{ range: { low: 0.8, high: 1.8, unit: 'ng/dL' } }],
  // ─── Liver ───────────────────────────────────────────────────
  alt: [
    { gender: 'male', range: { low: 7, high: 56, unit: 'U/L' } },
    { gender: 'female', range: { low: 7, high: 45, unit: 'U/L' } },
  ],
  ast: [
    { gender: 'male', range: { low: 10, high: 40, unit: 'U/L' } },
    { gender: 'female', range: { low: 10, high: 35, unit: 'U/L' } },
  ],
  alp: [{ range: { low: 44, high: 147, unit: 'U/L' } }],
  bilirubin: [{ range: { low: 0.2, high: 1.2, unit: 'mg/dL' } }],
  // ─── Kidney ──────────────────────────────────────────────────
  creatinine: [
    { gender: 'male', range: { low: 0.7, high: 1.3, unit: 'mg/dL' } },
    { gender: 'female', range: { low: 0.6, high: 1.1, unit: 'mg/dL' } },
  ],
  bun: [{ range: { low: 7, high: 20, unit: 'mg/dL' } }],
  egfr: [{ range: { low: 60, high: 120, unit: 'mL/min/1.73m²' } }],
  uricacid: [
    { gender: 'male', range: { low: 3.4, high: 7.0, unit: 'mg/dL' } },
    { gender: 'female', range: { low: 2.4, high: 6.0, unit: 'mg/dL' } },
  ],
  // ─── Hormones ────────────────────────────────────────────────
  lh: [
    { gender: 'male', range: { low: 1.7, high: 8.6, unit: 'mIU/mL' } },
    { gender: 'female', range: { low: 2.4, high: 12.6, unit: 'mIU/mL', label: 'Follicular phase' } },
  ],
  fsh: [
    { gender: 'male', range: { low: 1.5, high: 12.4, unit: 'mIU/mL' } },
    { gender: 'female', range: { low: 3.5, high: 12.5, unit: 'mIU/mL', label: 'Follicular phase' } },
  ],
  prolactin: [
    { gender: 'male', range: { low: 2, high: 18, unit: 'ng/mL' } },
    { gender: 'female', range: { low: 2, high: 29, unit: 'ng/mL' } },
  ],
  shbg: [
    { gender: 'male', range: { low: 10, high: 57, unit: 'nmol/L' } },
    { gender: 'female', range: { low: 18, high: 114, unit: 'nmol/L' } },
  ],
  dhea: [
    { gender: 'male', minAge: 18, maxAge: 29, range: { low: 280, high: 640, unit: 'ug/dL' } },
    { gender: 'male', minAge: 30, maxAge: 39, range: { low: 120, high: 520, unit: 'ug/dL' } },
    { gender: 'male', minAge: 40, maxAge: 49, range: { low: 95, high: 530, unit: 'ug/dL' } },
    { gender: 'male', minAge: 50, range: { low: 70, high: 310, unit: 'ug/dL' } },
    { gender: 'female', minAge: 18, maxAge: 29, range: { low: 65, high: 380, unit: 'ug/dL' } },
    { gender: 'female', minAge: 30, range: { low: 45, high: 270, unit: 'ug/dL' } },
  ],
  dheassulfate: [
    { gender: 'male', minAge: 18, maxAge: 29, range: { low: 280, high: 640, unit: 'ug/dL' } },
    { gender: 'male', minAge: 30, maxAge: 39, range: { low: 120, high: 520, unit: 'ug/dL' } },
    { gender: 'male', minAge: 40, range: { low: 70, high: 310, unit: 'ug/dL' } },
    { gender: 'female', minAge: 18, maxAge: 29, range: { low: 65, high: 380, unit: 'ug/dL' } },
    { gender: 'female', minAge: 30, range: { low: 45, high: 270, unit: 'ug/dL' } },
  ],
  cortisol: [{ range: { low: 6, high: 23, unit: 'ug/dL', label: 'AM (8am)' } }],
  igf1: [
    { gender: 'male', minAge: 18, maxAge: 24, range: { low: 116, high: 358, unit: 'ng/mL' } },
    { gender: 'male', minAge: 25, maxAge: 39, range: { low: 88, high: 246, unit: 'ng/mL' } },
    { gender: 'male', minAge: 40, range: { low: 71, high: 212, unit: 'ng/mL' } },
    { gender: 'female', minAge: 18, maxAge: 24, range: { low: 107, high: 367, unit: 'ng/mL' } },
    { gender: 'female', minAge: 25, maxAge: 39, range: { low: 76, high: 256, unit: 'ng/mL' } },
    { gender: 'female', minAge: 40, range: { low: 56, high: 194, unit: 'ng/mL' } },
  ],
  growthhormone: [
    { gender: 'male', range: { low: 0, high: 3, unit: 'ng/mL' } },
    { gender: 'female', range: { low: 0, high: 8, unit: 'ng/mL' } },
  ],
  // ─── Vitamins & Minerals ──────────────────────────────────────
  vitaminD: [{ range: { low: 30, high: 100, unit: 'ng/mL', label: 'Optimal: 40–80' } }],
  vitamind: [{ range: { low: 30, high: 100, unit: 'ng/mL', label: 'Optimal: 40–80' } }],
  vitaminb12: [{ range: { low: 200, high: 900, unit: 'pg/mL' } }],
  ferritin: [
    { gender: 'male', range: { low: 20, high: 250, unit: 'ng/mL' } },
    { gender: 'female', range: { low: 12, high: 150, unit: 'ng/mL' } },
  ],
  iron: [
    { gender: 'male', range: { low: 65, high: 175, unit: 'ug/dL' } },
    { gender: 'female', range: { low: 50, high: 170, unit: 'ug/dL' } },
  ],
  magnesium: [{ range: { low: 1.7, high: 2.3, unit: 'mg/dL' } }],
  calcium: [{ range: { low: 8.5, high: 10.5, unit: 'mg/dL' } }],
  sodium: [{ range: { low: 136, high: 145, unit: 'mEq/L' } }],
  potassium: [{ range: { low: 3.5, high: 5.0, unit: 'mEq/L' } }],
  // ─── Inflammation ─────────────────────────────────────────────
  crp: [{ range: { low: 0, high: 3.0, unit: 'mg/L', label: 'High-sensitivity; <1 optimal' } }],
  hscrp: [{ range: { low: 0, high: 3.0, unit: 'mg/L', label: '<1 optimal' } }],
  esr: [
    { gender: 'male', range: { low: 0, high: 15, unit: 'mm/hr' } },
    { gender: 'female', range: { low: 0, high: 20, unit: 'mm/hr' } },
  ],
  // ─── DEXA Body Comp ───────────────────────────────────────────
  bodyfatpercent: [
    { gender: 'male', minAge: 18, maxAge: 39, range: { low: 8, high: 20, unit: '%' } },
    { gender: 'male', minAge: 40, range: { low: 11, high: 22, unit: '%' } },
    { gender: 'female', minAge: 18, maxAge: 39, range: { low: 21, high: 33, unit: '%' } },
    { gender: 'female', minAge: 40, range: { low: 23, high: 36, unit: '%' } },
  ],
  bodyfat: [
    { gender: 'male', minAge: 18, maxAge: 39, range: { low: 8, high: 20, unit: '%' } },
    { gender: 'male', minAge: 40, range: { low: 11, high: 22, unit: '%' } },
    { gender: 'female', minAge: 18, maxAge: 39, range: { low: 21, high: 33, unit: '%' } },
    { gender: 'female', minAge: 40, range: { low: 23, high: 36, unit: '%' } },
  ],
  bonemineraldensity: [
    { gender: 'male', range: { low: 1.0, high: 1.4, unit: 'g/cm²' } },
    { gender: 'female', range: { low: 0.9, high: 1.3, unit: 'g/cm²' } },
  ],
  bmd: [
    { gender: 'male', range: { low: 1.0, high: 1.4, unit: 'g/cm²' } },
    { gender: 'female', range: { low: 0.9, high: 1.3, unit: 'g/cm²' } },
  ],
};

/**
 * Look up the reference range for a biomarker given optional gender and age.
 * Returns null if no range is found.
 */
export function getReferenceRange(
  markerName: string,
  gender?: string | null,
  age?: number | null,
): ReferenceRange | null {
  const key = normaliseName(markerName);
  const entries = RANGES[key];
  if (!entries) return null;

  const g = gender === 'male' || gender === 'female' ? gender : undefined;
  const a = typeof age === 'number' && age > 0 ? age : undefined;

  for (const entry of entries) {
    // Gender filter
    if (entry.gender && entry.gender !== 'any' && g && entry.gender !== g) continue;
    // Age lower bound
    if (entry.minAge !== undefined && a !== undefined && a < entry.minAge) continue;
    // Age upper bound
    if (entry.maxAge !== undefined && a !== undefined && a > entry.maxAge) continue;
    return entry.range;
  }

  // Fallback: return first entry ignoring gender/age
  return entries[0]?.range ?? null;
}

/** Format a reference range as a compact string, e.g. "264–916 ng/dL" */
export function formatRange(range: ReferenceRange): string {
  const lo = range.low === 0 ? '<' + range.high : `${range.low}–${range.high}`;
  return `${lo} ${range.unit}`;
}
