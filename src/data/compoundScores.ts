/**
 * Compound-level scores for bioavailability, efficacy, and effectiveness.
 *
 * These are STATIC, evidence-based scores that do NOT change with tolerance level.
 * Bioavailability is adjusted dynamically based on the user's actual delivery method.
 *
 * - bioavailability: How well the compound is absorbed/utilized given its delivery method (0-100%)
 * - efficacy: Likelihood of achieving statistically significant benefits based on published evidence (0-100%)
 * - effectiveness: Overall real-world effectiveness score combining bioavailability, efficacy, and practical factors (0-100%)
 * - evidenceTier: Primary evidence backing for these scores
 */

export type DeliveryMethod = 'Peptide' | 'Oil' | 'Oral' | 'Powder' | string;

export interface CompoundScores {
  bioavailability: number;
  efficacy: number;
  effectiveness: number;
  evidenceTier: 'RCT' | 'Meta' | 'Clinical' | 'Anecdotal' | 'Theoretical' | 'Mixed';
  confidencePct?: number;
  confidenceNote?: string;
}

/** Base scores keyed by delivery method: injectable, oral, default */
interface DeliveryScores {
  injectable: number;   // SubQ / IM injection
  oral: number;         // Oral / capsule / tablet
  default: number;      // Fallback if category unknown
}

/** Normalize compound name to a lookup key */
function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/\s*\d+\s*m[gc]g?\b/gi, '')
    .replace(/\s*\d+\s*iu\b/gi, '')
    .replace(/\s*\d+\s*ml\b/gi, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Map user compound category to delivery type */
function categoryToDelivery(category?: string): 'injectable' | 'oral' {
  if (!category) return 'oral';
  const cat = category.toLowerCase();
  if (cat === 'peptide' || cat === 'oil' || cat === 'injectable-oil' || cat.includes('inject')) return 'injectable';
  return 'oral'; // Oral, Powder, etc.
}

/**
 * Base scores table. Each compound stores:
 * - bioavailability as { injectable, oral, default } to reflect actual delivery method
 * - efficacy, effectiveness, evidenceTier remain constant regardless of delivery
 */
interface BaseScoreEntry {
  bio: DeliveryScores;
  efficacy: number;
  effectiveness: number;
  evidenceTier: 'RCT' | 'Meta' | 'Clinical' | 'Anecdotal' | 'Theoretical' | 'Mixed';
}

const BASE_SCORES: Record<string, BaseScoreEntry> = {
  // ── AAS / Hormones ──
  'test-cypionate':       { bio: { injectable: 95, oral: 5,  default: 95 }, efficacy: 98, effectiveness: 96, evidenceTier: 'RCT' },
  'testosterone-cypionate': { bio: { injectable: 95, oral: 5, default: 95 }, efficacy: 98, effectiveness: 96, evidenceTier: 'RCT' },
  'testosterone':         { bio: { injectable: 95, oral: 5,  default: 95 }, efficacy: 98, effectiveness: 96, evidenceTier: 'RCT' },
  'deca':                 { bio: { injectable: 92, oral: 8,  default: 92 }, efficacy: 90, effectiveness: 88, evidenceTier: 'RCT' },
  'nandrolone':           { bio: { injectable: 92, oral: 8,  default: 92 }, efficacy: 90, effectiveness: 88, evidenceTier: 'RCT' },
  'nandrolone-decanoate': { bio: { injectable: 92, oral: 8,  default: 92 }, efficacy: 90, effectiveness: 88, evidenceTier: 'RCT' },
  'anavar':               { bio: { injectable: 97, oral: 97, default: 97 }, efficacy: 85, effectiveness: 82, evidenceTier: 'RCT' },
  'oxandrolone':          { bio: { injectable: 97, oral: 97, default: 97 }, efficacy: 85, effectiveness: 82, evidenceTier: 'RCT' },

  // ── Peptides (GH axis) ──
  'ipamorelin':           { bio: { injectable: 88, oral: 15, default: 88 }, efficacy: 78, effectiveness: 75, evidenceTier: 'Clinical' },
  'cjc-1295':             { bio: { injectable: 85, oral: 12, default: 85 }, efficacy: 76, effectiveness: 74, evidenceTier: 'Clinical' },
  'tesamorelin':          { bio: { injectable: 90, oral: 10, default: 90 }, efficacy: 88, effectiveness: 85, evidenceTier: 'RCT' },
  'igf-1-lr3':            { bio: { injectable: 82, oral: 5,  default: 82 }, efficacy: 80, effectiveness: 72, evidenceTier: 'Clinical' },
  'igf-1':                { bio: { injectable: 82, oral: 5,  default: 82 }, efficacy: 80, effectiveness: 72, evidenceTier: 'Clinical' },

  // ── Peptides (Healing / Repair) ──
  'bpc-157':              { bio: { injectable: 78, oral: 35, default: 78 }, efficacy: 72, effectiveness: 70, evidenceTier: 'Anecdotal' },
  'tb-500':               { bio: { injectable: 75, oral: 10, default: 75 }, efficacy: 68, effectiveness: 65, evidenceTier: 'Anecdotal' },
  'thymosin-beta-4':      { bio: { injectable: 75, oral: 10, default: 75 }, efficacy: 68, effectiveness: 65, evidenceTier: 'Anecdotal' },

  // ── Metabolic Peptides ──
  'retatrutide':          { bio: { injectable: 92, oral: 15, default: 92 }, efficacy: 94, effectiveness: 90, evidenceTier: 'RCT' },
  '5-amino-1mq':          { bio: { injectable: 82, oral: 35, default: 55 }, efficacy: 65, effectiveness: 58, evidenceTier: 'Anecdotal' },
  'mots-c':               { bio: { injectable: 78, oral: 15, default: 60 }, efficacy: 55, effectiveness: 50, evidenceTier: 'Theoretical' },

  // ── Neuropeptides ──
  'semax':                { bio: { injectable: 70, oral: 20, default: 70 }, efficacy: 72, effectiveness: 68, evidenceTier: 'Clinical' },
  'selank':               { bio: { injectable: 68, oral: 18, default: 68 }, efficacy: 70, effectiveness: 65, evidenceTier: 'Clinical' },
  'cerebroprotein':       { bio: { injectable: 65, oral: 15, default: 65 }, efficacy: 60, effectiveness: 55, evidenceTier: 'Clinical' },

  // ── Skin / Collagen ──
  'ghk-cu':               { bio: { injectable: 72, oral: 20, default: 72 }, efficacy: 75, effectiveness: 70, evidenceTier: 'Clinical' },
  'collagen-peptides':    { bio: { injectable: 50, oral: 50, default: 50 }, efficacy: 60, effectiveness: 55, evidenceTier: 'Meta' },
  'collagen':             { bio: { injectable: 50, oral: 50, default: 50 }, efficacy: 60, effectiveness: 55, evidenceTier: 'Meta' },

  // ── Dopamine / Hormonal Support ──
  'cabergoline':          { bio: { injectable: 95, oral: 95, default: 95 }, efficacy: 95, effectiveness: 92, evidenceTier: 'RCT' },
  'tadalafil':            { bio: { injectable: 95, oral: 95, default: 95 }, efficacy: 92, effectiveness: 90, evidenceTier: 'RCT' },

  // ── Liver / Organ Support ──
  'tudca':                { bio: { injectable: 80, oral: 65, default: 65 }, efficacy: 82, effectiveness: 78, evidenceTier: 'RCT' },
  'nac':                  { bio: { injectable: 85, oral: 45, default: 45 }, efficacy: 80, effectiveness: 70, evidenceTier: 'Meta' },
  'n-acetyl-cysteine':    { bio: { injectable: 85, oral: 45, default: 45 }, efficacy: 80, effectiveness: 70, evidenceTier: 'Meta' },

  // ── Oral Supplements ──
  'ksm-66':               { bio: { injectable: 70, oral: 70, default: 70 }, efficacy: 78, effectiveness: 72, evidenceTier: 'RCT' },
  'ashwagandha':          { bio: { injectable: 70, oral: 70, default: 70 }, efficacy: 78, effectiveness: 72, evidenceTier: 'RCT' },
  'citrus-bergamot':      { bio: { injectable: 60, oral: 60, default: 60 }, efficacy: 72, effectiveness: 65, evidenceTier: 'Clinical' },
  'l-arginine':           { bio: { injectable: 90, oral: 35, default: 35 }, efficacy: 50, effectiveness: 40, evidenceTier: 'Mixed' },
  'l-citrulline':         { bio: { injectable: 80, oral: 80, default: 80 }, efficacy: 75, effectiveness: 72, evidenceTier: 'RCT' },
  'l-citrulline-malate':  { bio: { injectable: 82, oral: 82, default: 82 }, efficacy: 78, effectiveness: 75, evidenceTier: 'RCT' },
  'pycnogenol':           { bio: { injectable: 55, oral: 55, default: 55 }, efficacy: 68, effectiveness: 60, evidenceTier: 'Clinical' },
  'super-omega-3':        { bio: { injectable: 60, oral: 60, default: 60 }, efficacy: 82, effectiveness: 72, evidenceTier: 'Meta' },
  'omega-3':              { bio: { injectable: 60, oral: 60, default: 60 }, efficacy: 82, effectiveness: 72, evidenceTier: 'Meta' },
  'fish-oil':             { bio: { injectable: 60, oral: 60, default: 60 }, efficacy: 82, effectiveness: 72, evidenceTier: 'Meta' },
  'coq10':                { bio: { injectable: 70, oral: 40, default: 40 }, efficacy: 75, effectiveness: 60, evidenceTier: 'Meta' },
  'qunol-coq10':          { bio: { injectable: 70, oral: 55, default: 55 }, efficacy: 75, effectiveness: 65, evidenceTier: 'Meta' },
  'taurine':              { bio: { injectable: 95, oral: 90, default: 90 }, efficacy: 70, effectiveness: 68, evidenceTier: 'Clinical' },
  'nad':                  { bio: { injectable: 85, oral: 30, default: 30 }, efficacy: 72, effectiveness: 55, evidenceTier: 'Clinical' },
  'nad+':                 { bio: { injectable: 85, oral: 30, default: 30 }, efficacy: 72, effectiveness: 55, evidenceTier: 'Clinical' },
  'b12':                  { bio: { injectable: 98, oral: 60, default: 95 }, efficacy: 85, effectiveness: 82, evidenceTier: 'RCT' },
  'thymosin-alpha-1':     { bio: { injectable: 85, oral: 20, default: 85 }, efficacy: 82, effectiveness: 78, evidenceTier: 'RCT' },

  // ── Missing / Additional ──
  'semaglutide':          { bio: { injectable: 89, oral: 30, default: 89 }, efficacy: 95, effectiveness: 92, evidenceTier: 'RCT' },
  'winstrol':             { bio: { injectable: 95, oral: 85, default: 85 }, efficacy: 82, effectiveness: 78, evidenceTier: 'RCT' },
  'stanozolol':           { bio: { injectable: 95, oral: 85, default: 85 }, efficacy: 82, effectiveness: 78, evidenceTier: 'RCT' },
  'hawthorn':             { bio: { injectable: 50, oral: 50, default: 50 }, efficacy: 65, effectiveness: 58, evidenceTier: 'Clinical' },
  'hawthorn-berry':       { bio: { injectable: 50, oral: 50, default: 50 }, efficacy: 65, effectiveness: 58, evidenceTier: 'Clinical' },
  'milk-thistle':         { bio: { injectable: 50, oral: 40, default: 40 }, efficacy: 70, effectiveness: 60, evidenceTier: 'Meta' },
  'silymarin':            { bio: { injectable: 50, oral: 40, default: 40 }, efficacy: 70, effectiveness: 60, evidenceTier: 'Meta' },
  'magnesium':            { bio: { injectable: 70, oral: 55, default: 55 }, efficacy: 78, effectiveness: 70, evidenceTier: 'RCT' },
  'magnesium-glycinate':  { bio: { injectable: 70, oral: 65, default: 65 }, efficacy: 78, effectiveness: 72, evidenceTier: 'RCT' },
  'vitamin-c':            { bio: { injectable: 95, oral: 70, default: 70 }, efficacy: 72, effectiveness: 65, evidenceTier: 'Meta' },
  'ascorbic-acid':        { bio: { injectable: 95, oral: 70, default: 70 }, efficacy: 72, effectiveness: 65, evidenceTier: 'Meta' },
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

function lookupBase(name: string): BaseScoreEntry | null {
  const key = normalizeKey(name);
  if (BASE_SCORES[key]) return BASE_SCORES[key];
  if (ALIASES[key] && BASE_SCORES[ALIASES[key]]) return BASE_SCORES[ALIASES[key]];
  for (const [k, v] of Object.entries(BASE_SCORES)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

/**
 * Get compound scores adjusted for the user's actual delivery method.
 * @param compoundName - The compound name
 * @param category - The user's compound category (Peptide, Oil, Oral, Powder) which determines delivery method
 */
export function getCompoundScores(compoundName: string, category?: string): CompoundScores | null {
  const base = lookupBase(compoundName);
  if (!base) return null;

  const delivery = categoryToDelivery(category);
  const bio = base.bio[delivery];

  // Recalculate effectiveness as it's influenced by bioavailability
  const baseBio = base.bio.default;
  const bioShift = bio - baseBio;
  const adjustedEffectiveness = Math.min(100, Math.max(0, base.effectiveness + Math.round(bioShift * 0.4)));

  return {
    bioavailability: bio,
    efficacy: base.efficacy,
    effectiveness: adjustedEffectiveness,
    evidenceTier: base.evidenceTier,
  };
}

/** Get the delivery method label for display */
export function getDeliveryLabel(category?: string): string {
  if (!category) return 'Unknown';
  const cat = category.toLowerCase();
  if (cat === 'peptide') return 'SubQ Injection';
  if (cat === 'oil' || cat === 'injectable-oil' || cat.includes('inject')) return 'IM Injection';
  if (cat === 'oral') return 'Oral';
  if (cat === 'powder') return 'Oral (Powder)';
  return category;
}
