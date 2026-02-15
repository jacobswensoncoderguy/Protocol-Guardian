import { Compound, CompoundCategory } from '@/data/compounds';
import { DayDose, DaySchedule } from '@/data/schedule';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Parse which days of the week a compound is used based on timingNote and daysPerWeek.
 * Returns array of day indices (0=Sun, 6=Sat).
 */
function parseDays(compound: Compound): number[] {
  const note = (compound.timingNote || '').toLowerCase();
  const dpw = compound.daysPerWeek;

  // Specific day patterns
  if (/\bm[\/-]f\b|mon[\s-]*fri/i.test(note)) return [1, 2, 3, 4, 5];
  if (/\bm\/w\/f\b/i.test(note)) return [1, 3, 5];
  if (/\bt\/th\b|tues.*thurs|tue.*thu/i.test(note)) return [2, 4];

  // Check for specific day names
  const dayMap: Record<string, number> = {
    su: 0, sun: 0, sunday: 0,
    mo: 1, mon: 1, monday: 1, 'm': 1,
    tu: 2, tue: 2, tues: 2, tuesday: 2,
    we: 3, wed: 3, wednesday: 3,
    th: 4, thu: 4, thurs: 4, thursday: 4,
    fr: 5, fri: 5, friday: 5,
    sa: 6, sat: 6, saturday: 6,
  };

  // Pattern like "M/T/W/Th/F/Sa" or individual day mentions (including 2-letter abbreviations)
  const dayPattern = /\b(su(?:n(?:day)?)?|mo(?:n(?:day)?)?|tu(?:e(?:s(?:day)?)?)?|we(?:d(?:nesday)?)?|th(?:u(?:rs(?:day)?)?)?|fr(?:i(?:day)?)?|sa(?:t(?:urday)?)?)\b/gi;
  const matches = note.match(dayPattern);
  if (matches && matches.length > 0) {
    const days = new Set<number>();
    matches.forEach(m => {
      const idx = dayMap[m.toLowerCase()];
      if (idx !== undefined) days.add(idx);
    });
    if (days.size > 0) return Array.from(days).sort();
  }

  // Check for "daily" or "nightly"
  if (/\bdaily\b|\bnightly\b|\bevery\s*day\b/i.test(note) || dpw === 7) {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  // Default based on daysPerWeek
  switch (dpw) {
    case 7: return [0, 1, 2, 3, 4, 5, 6];
    case 6: return [1, 2, 3, 4, 5, 6]; // Mon-Sat
    case 5: return [1, 2, 3, 4, 5]; // Mon-Fri
    case 4: return [1, 2, 4, 5]; // M/T/Th/F
    case 3: return [1, 3, 5]; // M/W/F
    case 2: return [2, 4]; // T/Th
    case 1: return [1]; // Monday
    default: return [0, 1, 2, 3, 4, 5, 6];
  }
}

/**
 * Parse the timing(s) of day for a compound from timingNote and dosesPerDay.
 */
function parseTimings(compound: Compound): ('morning' | 'afternoon' | 'evening')[] {
  const note = (compound.timingNote || '').toLowerCase();

  // Check for explicit timing keywords
  const hasMorningExplicit = /\bmorning\b|\bam\b/.test(note);
  const hasEveningExplicit = /\bevening\b|\bpm\b|\bnightly\b|\bnight\b/.test(note);
  const hasAfternoon = /\bafternoon\b|\bpost[- ]?workout\b|\bpre[- ]?workout\b/.test(note);
  const hasDaily = /\bdaily\b|\bevery\s*day\b/.test(note);

  // If note says "daily" but also specifies a specific time (e.g. "daily evening"),
  // only use the specific time — don't auto-add morning
  if (hasMorningExplicit || hasEveningExplicit || hasAfternoon) {
    const timings: ('morning' | 'afternoon' | 'evening')[] = [];
    if (hasMorningExplicit) timings.push('morning');
    if (hasAfternoon) timings.push('afternoon');
    if (hasEveningExplicit) timings.push('evening');
    return timings;
  }

  // "daily" without a specific AM/PM — use dosesPerDay to infer
  if (hasDaily) {
    if (compound.dosesPerDay >= 2) {
      return ['morning', 'evening'];
    }
    return ['morning'];
  }

  // If dosesPerDay >= 2 and no explicit timing, split morning + evening
  if (compound.dosesPerDay >= 2) {
    return ['morning', 'evening'];
  }

  // Default: morning
  return ['morning'];
}

/**
 * Format the dose display string for a compound.
 */
function formatDose(compound: Compound): string {
  const dose = compound.dosePerUse;
  const label = compound.doseLabel;

  // For pills, show count info
  if (label === 'pills' || label === 'caps' || label === 'softgels') {
    if (dose !== Math.floor(dose)) {
      return `${dose} ${label}`;
    }
    return `${dose} ${label}`;
  }

  // For weight-based doses
  if (label === 'g' && dose >= 1) {
    return `${dose}g`;
  }
  if (label === 'mg') {
    return `${dose}mg`;
  }
  if (label === 'IU') {
    return `${dose} IU`;
  }
  if (label === 'mL') {
    return `${dose} mL`;
  }

  return `${dose} ${label}`;
}

/**
 * Generate a dynamic weekly schedule from the user's compounds.
 */
export function generateScheduleFromCompounds(compounds: Compound[]): DaySchedule[] {
  const schedule: DaySchedule[] = DAYS.map((day, i) => ({
    dayIndex: i,
    dayName: day,
    shortName: SHORT_DAYS[i],
    doses: [],
  }));

  compounds.filter(c => c.daysPerWeek > 0 || (c.cycleOnDays && c.cycleOffDays)).forEach(compound => {
    const days = parseDays(compound);
    const timings = parseTimings(compound);
    const doseStr = formatDose(compound);

    timings.forEach(timing => {
      const dose: DayDose = {
        compoundId: compound.id,
        dose: doseStr,
        timing,
        category: compound.category as DayDose['category'],
      };

      days.forEach(dayIdx => {
        schedule[dayIdx].doses.push({ ...dose });
      });
    });
  });

  return schedule;
}
