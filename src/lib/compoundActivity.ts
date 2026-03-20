/**
 * Compound Activity Window Calculation
 * Determines which compounds are "active" in the user's system based on half-life data.
 */

export const HALF_LIFE_HOURS: Record<string, number> = {
  'tadalafil': 17.5,
  'ipamorelin': 2,
  'cjc-1295': 6,
  'cjc-1295 dac': 144,
  'l-citrulline': 1,
  'l-arginine': 1.5,
  'bpc-157': 4,
  'nad+': 3,
  'thymosin-alpha-1': 24,
  'mots-c': 12,
  'semax': 6,
  '5-amino-1mq': 6,
  'tb-500': 72,
  'pt-141': 2,
  'mk-677': 24,
  'ghr-2': 0.5,
  'ghr-6': 0.5,
  'selank': 0.5,
  'epithalon': 6,
  'ss-31': 4,
  'ghk-cu': 12,
  'aod-9604': 1,
  'tesamorelin': 0.5,
  'sermorelin': 0.2,
  'dihexa': 6,
  'cerebrolysin': 6,
  'testosterone cypionate': 192,
  'testosterone enanthate': 168,
  'nandrolone': 144,
  'oxandrolone': 9,
  'anastrozole': 50,
  'enclomiphene': 10,
  'pregnenolone': 3,
  'dhea': 12,
  'melatonin': 0.75,
  'modafinil': 15,
  'creatine': 24,
  'metformin': 6,
  'rapamycin': 62,
  'semaglutide': 168,
  'tirzepatide': 120,
  'retatrutide': 168,
};

export interface ActiveCompound {
  id: string;
  name: string;
  halfLifeHours: number;
  hoursSinceLastDose: number;
  activityRemaining: number; // 0-1
  lastDoseAt: Date;
}

export interface DoseLog {
  compound_id: string;
  check_date: string;
  checked_at: string;
  timing: string;
}

export function getHalfLife(compoundName: string): number {
  const key = compoundName.toLowerCase().trim();
  return HALF_LIFE_HOURS[key] ?? 8;
}

export function getActiveCompounds(
  doseLogs: DoseLog[],
  compounds: Array<{ id: string; name: string }>,
): ActiveCompound[] {
  const now = new Date();
  const results: ActiveCompound[] = [];

  for (const compound of compounds) {
    const lastDose = doseLogs
      .filter(log => log.compound_id === compound.id)
      .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())[0];

    if (!lastDose) continue;

    const halfLife = getHalfLife(compound.name);
    const hoursSince = (now.getTime() - new Date(lastDose.checked_at).getTime()) / (1000 * 60 * 60);
    const thresholdHours = halfLife * 3;

    if (hoursSince < thresholdHours) {
      results.push({
        id: compound.id,
        name: compound.name,
        halfLifeHours: halfLife,
        hoursSinceLastDose: hoursSince,
        activityRemaining: Math.max(0, 1 - hoursSince / thresholdHours),
        lastDoseAt: new Date(lastDose.checked_at),
      });
    }
  }

  return results;
}

export function getWorkoutCompoundOverlap(
  sessionStartTime: Date,
  sessionEndTime: Date,
  doseLogs: DoseLog[],
  compounds: Array<{ id: string; name: string }>,
): ActiveCompound[] {
  const results: ActiveCompound[] = [];

  for (const compound of compounds) {
    const lastDoseBefore = doseLogs
      .filter(log =>
        log.compound_id === compound.id &&
        new Date(log.checked_at) <= sessionStartTime
      )
      .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())[0];

    if (!lastDoseBefore) continue;

    const halfLife = getHalfLife(compound.name);
    const hoursAtSessionStart = (sessionStartTime.getTime() - new Date(lastDoseBefore.checked_at).getTime()) / (1000 * 60 * 60);
    const thresholdHours = halfLife * 3;

    if (hoursAtSessionStart < thresholdHours) {
      results.push({
        id: compound.id,
        name: compound.name,
        halfLifeHours: halfLife,
        hoursSinceLastDose: hoursAtSessionStart,
        activityRemaining: Math.max(0, 1 - hoursAtSessionStart / thresholdHours),
        lastDoseAt: new Date(lastDoseBefore.checked_at),
      });
    }
  }

  return results;
}

/** Mechanism notes for compound-workout synergy display */
export const COMPOUND_MECHANISMS: Record<string, string> = {
  'tadalafil': 'Enhanced blood flow and nutrient delivery',
  'l-citrulline': 'Nitric oxide boost — improved vasodilation',
  'l-arginine': 'Nitric oxide precursor — vasodilation support',
  'creatine': 'ATP regeneration — strength and power output',
  'bpc-157': 'Tissue repair and recovery acceleration',
  'tb-500': 'Systemic tissue repair and flexibility',
  'ipamorelin': 'Growth hormone pulse — recovery and lean mass',
  'cjc-1295': 'Sustained GH release — muscle protein synthesis',
  'mk-677': 'GH secretagogue — appetite and recovery',
  'nad+': 'Cellular energy and mitochondrial function',
  'mots-c': 'Mitochondrial peptide — exercise capacity',
  '5-amino-1mq': 'Fat metabolism enhancement',
  'testosterone cypionate': 'Anabolic — protein synthesis and recovery',
  'testosterone enanthate': 'Anabolic — protein synthesis and recovery',
  'semaglutide': 'GLP-1 agonist — metabolic regulation',
  'modafinil': 'Cognitive focus — mind-muscle connection',
  'semax': 'Neuroprotective — focus and coordination',
};

export function getMechanism(compoundName: string): string {
  return COMPOUND_MECHANISMS[compoundName.toLowerCase().trim()] ?? 'Supporting compound activity';
}
