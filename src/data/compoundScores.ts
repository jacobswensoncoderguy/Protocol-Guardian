/**
 * Compound-level scores for bioavailability, efficacy, and effectiveness.
 *
 * These are STATIC, evidence-based scores that do NOT change with tolerance level.
 *
 * - bioavailability: How well the compound is absorbed/utilized given optimal delivery method (0-100%)
 * - efficacy: Likelihood of achieving statistically significant benefits based on published evidence (0-100%)
 * - effectiveness: Overall real-world effectiveness score combining bioavailability, efficacy, and practical factors (0-100%)
 * - evidenceTier: Primary evidence backing for these scores
 */

export interface CompoundScores {
  bioavailability: number;
  efficacy: number;
  effectiveness: number;
  evidenceTier: 'RCT' | 'Meta' | 'Clinical' | 'Anecdotal' | 'Theoretical' | 'Mixed';
}

/** Normalize compound name to a lookup key */
function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '') // strip parentheticals like (Nandrolone)
    .replace(/\s*\d+\s*m[gc]g?\b/gi, '') // strip doses like 10mg, 400mcg
    .replace(/\s*\d+\s*iu\b/gi, '') // strip IU doses
    .replace(/\s*\d+\s*ml\b/gi, '') // strip mL
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const SCORES: Record<string, CompoundScores> = {
  // ── AAS / Hormones ──
  'test-cypionate': { bioavailability: 95, efficacy: 98, effectiveness: 96, evidenceTier: 'RCT' },
  'testosterone-cypionate': { bioavailability: 95, efficacy: 98, effectiveness: 96, evidenceTier: 'RCT' },
  'testosterone': { bioavailability: 95, efficacy: 98, effectiveness: 96, evidenceTier: 'RCT' },
  'deca': { bioavailability: 92, efficacy: 90, effectiveness: 88, evidenceTier: 'RCT' },
  'nandrolone': { bioavailability: 92, efficacy: 90, effectiveness: 88, evidenceTier: 'RCT' },
  'nandrolone-decanoate': { bioavailability: 92, efficacy: 90, effectiveness: 88, evidenceTier: 'RCT' },
  'anavar': { bioavailability: 97, efficacy: 85, effectiveness: 82, evidenceTier: 'RCT' },
  'oxandrolone': { bioavailability: 97, efficacy: 85, effectiveness: 82, evidenceTier: 'RCT' },

  // ── Peptides (GH axis) ──
  'ipamorelin': { bioavailability: 88, efficacy: 78, effectiveness: 75, evidenceTier: 'Clinical' },
  'cjc-1295': { bioavailability: 85, efficacy: 76, effectiveness: 74, evidenceTier: 'Clinical' },
  'tesamorelin': { bioavailability: 90, efficacy: 88, effectiveness: 85, evidenceTier: 'RCT' },
  'igf-1-lr3': { bioavailability: 82, efficacy: 80, effectiveness: 72, evidenceTier: 'Clinical' },
  'igf-1': { bioavailability: 82, efficacy: 80, effectiveness: 72, evidenceTier: 'Clinical' },

  // ── Peptides (Healing / Repair) ──
  'bpc-157': { bioavailability: 78, efficacy: 72, effectiveness: 70, evidenceTier: 'Anecdotal' },
  'tb-500': { bioavailability: 75, efficacy: 68, effectiveness: 65, evidenceTier: 'Anecdotal' },
  'thymosin-beta-4': { bioavailability: 75, efficacy: 68, effectiveness: 65, evidenceTier: 'Anecdotal' },

  // ── Metabolic Peptides ──
  'retatrutide': { bioavailability: 92, efficacy: 94, effectiveness: 90, evidenceTier: 'RCT' },
  '5-amino-1mq': { bioavailability: 55, efficacy: 65, effectiveness: 58, evidenceTier: 'Anecdotal' },
  'mots-c': { bioavailability: 60, efficacy: 55, effectiveness: 50, evidenceTier: 'Theoretical' },

  // ── Neuropeptides ──
  'semax': { bioavailability: 70, efficacy: 72, effectiveness: 68, evidenceTier: 'Clinical' },
  'selank': { bioavailability: 68, efficacy: 70, effectiveness: 65, evidenceTier: 'Clinical' },
  'cerebroprotein': { bioavailability: 65, efficacy: 60, effectiveness: 55, evidenceTier: 'Clinical' },

  // ── Skin / Collagen ──
  'ghk-cu': { bioavailability: 72, efficacy: 75, effectiveness: 70, evidenceTier: 'Clinical' },
  'collagen-peptides': { bioavailability: 50, efficacy: 60, effectiveness: 55, evidenceTier: 'Meta' },
  'collagen': { bioavailability: 50, efficacy: 60, effectiveness: 55, evidenceTier: 'Meta' },

  // ── Dopamine / Hormonal Support ──
  'cabergoline': { bioavailability: 95, efficacy: 95, effectiveness: 92, evidenceTier: 'RCT' },
  'tadalafil': { bioavailability: 95, efficacy: 92, effectiveness: 90, evidenceTier: 'RCT' },

  // ── Liver / Organ Support ──
  'tudca': { bioavailability: 65, efficacy: 82, effectiveness: 78, evidenceTier: 'RCT' },
  'nac': { bioavailability: 45, efficacy: 80, effectiveness: 70, evidenceTier: 'Meta' },
  'n-acetyl-cysteine': { bioavailability: 45, efficacy: 80, effectiveness: 70, evidenceTier: 'Meta' },

  // ── Oral Supplements ──
  'ksm-66': { bioavailability: 70, efficacy: 78, effectiveness: 72, evidenceTier: 'RCT' },
  'ashwagandha': { bioavailability: 70, efficacy: 78, effectiveness: 72, evidenceTier: 'RCT' },
  'citrus-bergamot': { bioavailability: 60, efficacy: 72, effectiveness: 65, evidenceTier: 'Clinical' },
  'l-arginine': { bioavailability: 35, efficacy: 50, effectiveness: 40, evidenceTier: 'Mixed' },
  'l-citrulline': { bioavailability: 80, efficacy: 75, effectiveness: 72, evidenceTier: 'RCT' },
  'l-citrulline-malate': { bioavailability: 82, efficacy: 78, effectiveness: 75, evidenceTier: 'RCT' },
  'pycnogenol': { bioavailability: 55, efficacy: 68, effectiveness: 60, evidenceTier: 'Clinical' },
  'super-omega-3': { bioavailability: 60, efficacy: 82, effectiveness: 72, evidenceTier: 'Meta' },
  'omega-3': { bioavailability: 60, efficacy: 82, effectiveness: 72, evidenceTier: 'Meta' },
  'fish-oil': { bioavailability: 60, efficacy: 82, effectiveness: 72, evidenceTier: 'Meta' },
  'coq10': { bioavailability: 40, efficacy: 75, effectiveness: 60, evidenceTier: 'Meta' },
  'qunol-coq10': { bioavailability: 55, efficacy: 75, effectiveness: 65, evidenceTier: 'Meta' },
  'taurine': { bioavailability: 90, efficacy: 70, effectiveness: 68, evidenceTier: 'Clinical' },
  'nad': { bioavailability: 30, efficacy: 72, effectiveness: 55, evidenceTier: 'Clinical' },
  'nad+': { bioavailability: 30, efficacy: 72, effectiveness: 55, evidenceTier: 'Clinical' },
  'b12': { bioavailability: 95, efficacy: 85, effectiveness: 82, evidenceTier: 'RCT' },
  'thymosin-alpha-1': { bioavailability: 85, efficacy: 82, effectiveness: 78, evidenceTier: 'RCT' },
};

/** Alias map for common name variations */
const ALIASES: Record<string, string> = {
  'test-cyp': 'test-cypionate',
  'test': 'testosterone',
  'deca-nandrolone': 'deca',
  'oxandrolone': 'anavar',
  'n-acetyl-cysteine': 'nac',
  'thymosin-beta': 'tb-500',
  'collagen-peptide': 'collagen-peptides',
  'ksm-66-ashwagandha': 'ksm-66',
  'ubiquinol': 'coq10',
  'coenzyme-q10': 'coq10',
};

export function getCompoundScores(compoundName: string): CompoundScores | null {
  const key = normalizeKey(compoundName);

  // Direct lookup
  if (SCORES[key]) return SCORES[key];

  // Alias lookup
  if (ALIASES[key] && SCORES[ALIASES[key]]) return SCORES[ALIASES[key]];

  // Fuzzy: check if key starts with or contains a known entry
  for (const [k, v] of Object.entries(SCORES)) {
    if (key.includes(k) || k.includes(key)) return v;
  }

  return null;
}
