import { Compound } from '@/data/compounds';
import { validateCompoundForMath } from '@/data/compounds';
import { isPaused } from '@/lib/cycling';

/** Returns true if the compound is dormant or paused */
export function isCompoundInactive(c: Compound): boolean {
  return !!(c.pausedAt || c.notes?.includes('[DORMANT]'));
}

/** Returns active compounds with broken math validation, using the same
 *  validateCompoundForMath function used by inventory cards. */
export function getCompoundsNeedingAttention(compounds: Compound[]): { compound: Compound; errorCount: number }[] {
  return compounds
    .filter(c => !isCompoundInactive(c) && !isPaused(c))
    .map(c => ({ compound: c, errorCount: validateCompoundForMath(c).length }))
    .filter(item => item.errorCount > 0);
}
