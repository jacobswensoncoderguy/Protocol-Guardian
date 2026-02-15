/**
 * Maps compound IDs to body zones they primarily affect.
 * Used to drive the 3D body heat-map visualization.
 */

export type BodyZone = 'brain' | 'heart' | 'arms' | 'core' | 'legs' | 'immune' | 'hormonal';

export interface BodyZoneInfo {
  label: string;
  color: string; // neon premium palette HSL
  description: string;
}

export const BODY_ZONES: Record<BodyZone, BodyZoneInfo> = {
  brain:    { label: 'Cognitive', color: 'hsl(270, 100%, 65%)', description: 'Focus, memory, neuroprotection' },
  heart:    { label: 'Cardiovascular', color: 'hsl(330, 100%, 60%)', description: 'Heart health, blood flow, endurance' },
  arms:     { label: 'Musculoskeletal', color: 'hsl(230, 100%, 65%)', description: 'Muscle growth, strength, recovery' },
  core:     { label: 'Metabolic', color: 'hsl(45, 100%, 55%)', description: 'Fat loss, energy, metabolism' },
  legs:     { label: 'Recovery', color: 'hsl(160, 100%, 45%)', description: 'Tissue repair, joint health' },
  immune:   { label: 'Immune', color: 'hsl(200, 100%, 60%)', description: 'Immune regulation, longevity' },
  hormonal: { label: 'Hormonal', color: 'hsl(15, 100%, 60%)', description: 'Testosterone, GH, thyroid optimization' },
};

// Map each compound to its affected body zones with an intensity weight (0-1)
export const COMPOUND_ZONE_MAP: Record<string, Partial<Record<BodyZone, number>>> = {
  // Peptides
  '5-amino-1mq':    { core: 0.9, heart: 0.3 },
  'b12':            { brain: 0.5, heart: 0.4, immune: 0.3 },
  'bpc-157':        { legs: 0.9, core: 0.5, heart: 0.3 },
  'cerebroprotein':  { brain: 0.95 },
  'cjc-1295':       { hormonal: 0.8, arms: 0.6, core: 0.4 },
  'ghk-cu':         { legs: 0.7, immune: 0.5, arms: 0.3 },
  'igf1-lr3':       { arms: 0.9, core: 0.5, hormonal: 0.4 },
  'ipamorelin':     { hormonal: 0.8, arms: 0.5, core: 0.3 },
  'mots-c':         { core: 0.8, heart: 0.5, immune: 0.4 },
  'retatrutide':    { core: 0.95, heart: 0.4 },
  'selank':         { brain: 0.8, immune: 0.4 },
  'semax':          { brain: 0.9 },
  'tb-500':         { legs: 0.85, heart: 0.4, immune: 0.3 },
  'tesamorelin':    { core: 0.7, hormonal: 0.6 },
  'thymosin-a1':    { immune: 0.9 },
  // Injectable oils
  'deca':           { arms: 0.8, legs: 0.6, hormonal: 0.5 },
  'test-cyp':       { hormonal: 0.95, arms: 0.7, core: 0.4, brain: 0.3 },
  'nad-plus':       { brain: 0.6, core: 0.5, immune: 0.5, heart: 0.4 },
  // Orals
  'anavar':         { arms: 0.85, core: 0.6 },
  'winstrol':       { arms: 0.8, core: 0.5 },
  'tadalafil':      { heart: 0.7, hormonal: 0.5 },
  'l-arginine':     { heart: 0.8, arms: 0.3 },
  'l-citrulline':   { heart: 0.7, arms: 0.3 },
  'pycnogenol':     { heart: 0.6, immune: 0.4 },
  'citrus-bergamot': { heart: 0.7, core: 0.3 },
  'coq10':          { heart: 0.8, brain: 0.3, core: 0.3 },
  'semaglutide':    { core: 0.9, heart: 0.4 },
};

/**
 * Given a list of active compound IDs, compute an intensity (0-1) for each body zone.
 */
export function computeZoneIntensities(compoundIds: string[]): Record<BodyZone, number> {
  const zones: Record<BodyZone, number> = {
    brain: 0, heart: 0, arms: 0, core: 0, legs: 0, immune: 0, hormonal: 0,
  };

  // Normalize compound IDs to match our mapping keys
  const normalize = (id: string) => id.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  for (const rawId of compoundIds) {
    const id = normalize(rawId);
    const mapping = COMPOUND_ZONE_MAP[id];
    if (!mapping) continue;
    for (const [zone, weight] of Object.entries(mapping)) {
      zones[zone as BodyZone] = Math.min(1, zones[zone as BodyZone] + (weight as number));
    }
  }

  // Cap all at 1
  for (const key of Object.keys(zones) as BodyZone[]) {
    zones[key] = Math.min(1, zones[key]);
  }

  return zones;
}
