export interface DayDose {
  compoundId: string;
  dose: string;
  timing: 'morning' | 'afternoon' | 'evening';
  category: 'peptide' | 'injectable-oil' | 'oral' | 'powder';
}

export interface DaySchedule {
  dayIndex: number;
  dayName: string;
  shortName: string;
  doses: DayDose[];
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Common nightly peptides (every day)
const nightlyPeptides: DayDose[] = [
  { compoundId: 'ipamorelin', dose: '10 IU', timing: 'evening', category: 'peptide' },
  { compoundId: 'selank', dose: '15 IU', timing: 'evening', category: 'peptide' },
  { compoundId: 'ghk-cu', dose: '10 IU', timing: 'evening', category: 'peptide' },
  { compoundId: 'bpc-157', dose: '10 IU', timing: 'evening', category: 'peptide' },
];

// Common morning peptides (Mon-Sat)
const commonMorningPeptides: DayDose[] = [
  { compoundId: 'cjc-1295', dose: '10 IU', timing: 'morning', category: 'peptide' },
  { compoundId: 'semax', dose: '10 IU', timing: 'morning', category: 'peptide' },
  { compoundId: 'cerebroprotein', dose: '30 IU', timing: 'morning', category: 'peptide' },
];

// Evening CJC (every day)
const eveningCJC: DayDose = { compoundId: 'cjc-1295', dose: '10 IU', timing: 'evening', category: 'peptide' };

// Full peptide day extras (M/W/F)
const fullDayExtras: DayDose[] = [
  { compoundId: '5-amino-1mq', dose: '30 IU', timing: 'morning', category: 'peptide' },
  { compoundId: 'thymosin-a1', dose: '40 IU', timing: 'morning', category: 'peptide' },
  { compoundId: 'mots-c', dose: '50 IU', timing: 'morning', category: 'peptide' },
];

const tb500Evening: DayDose = { compoundId: 'tb-500', dose: '100 IU', timing: 'evening', category: 'peptide' };

// Daily orals - morning
const morningOrals: DayDose[] = [
  { compoundId: 'anavar', dose: '25mg (2.5 pills)', timing: 'morning', category: 'oral' },
  { compoundId: 'bergamot', dose: '600mg', timing: 'morning', category: 'oral' },
  { compoundId: 'ashwagandha', dose: '600mg', timing: 'morning', category: 'oral' },
  { compoundId: 'tadalafil', dose: '5mg', timing: 'morning', category: 'oral' },
  { compoundId: 'ubiquinol', dose: '200mg (Qunol/CoQ10)', timing: 'morning', category: 'oral' },
  { compoundId: 'pycnogenol', dose: '150mg', timing: 'morning', category: 'oral' },
  { compoundId: 'omega3', dose: '2 softgels', timing: 'morning', category: 'oral' },
  { compoundId: 'l-arginine', dose: '5g (5 caps)', timing: 'morning', category: 'oral' },
];

// Daily orals - evening
const eveningOrals: DayDose[] = [
  { compoundId: 'nac', dose: '1g', timing: 'evening', category: 'oral' },
  { compoundId: 'tudca', dose: '500mg', timing: 'evening', category: 'oral' },
  { compoundId: 'milk-thistle', dose: '300mg', timing: 'evening', category: 'oral' },
  { compoundId: 'hawthorn', dose: '500mg', timing: 'evening', category: 'oral' },
  { compoundId: 'magnesium', dose: '240mg', timing: 'evening', category: 'oral' },
];

// Daily powders
const morningPowders: DayDose[] = [
  { compoundId: 'taurine', dose: '2.5g', timing: 'morning', category: 'powder' },
];

const afternoonPowders: DayDose[] = [
  { compoundId: 'citrulline', dose: '9g', timing: 'afternoon', category: 'powder' },
];

const eveningPowders: DayDose[] = [
  { compoundId: 'collagen', dose: '11g', timing: 'evening', category: 'powder' },
  { compoundId: 'taurine', dose: '2.5g', timing: 'evening', category: 'powder' },
  { compoundId: 'vitamin-c', dose: '1g', timing: 'evening', category: 'powder' },
];

// Test Cyp daily
const testCyp: DayDose = { compoundId: 'test-cyp', dose: '35mg', timing: 'morning', category: 'injectable-oil' };

// Deca M/F
const deca: DayDose = { compoundId: 'deca', dose: '83mg', timing: 'morning', category: 'injectable-oil' };

// IGF-1 post-workout
const igf1: DayDose = { compoundId: 'igf1-lr3', dose: '15 IU', timing: 'afternoon', category: 'peptide' };

// Tesamorelin T/Th/Sa
const tesamorelin: DayDose = { compoundId: 'tesamorelin', dose: '20 IU', timing: 'evening', category: 'peptide' };

// B12 Tuesday
const b12: DayDose = { compoundId: 'b12', dose: '100 IU (1mg)', timing: 'morning', category: 'peptide' };

// Cabergoline Saturday evening
const cabergoline: DayDose = { compoundId: 'cabergoline', dose: '250mcg', timing: 'evening', category: 'oral' };

// Retatrutide Sunday evening
const retatrutide: DayDose = { compoundId: 'retatrutide', dose: '15 IU', timing: 'evening', category: 'peptide' };

export const weeklySchedule: DaySchedule[] = [
  // Sunday (0)
  {
    dayIndex: 0,
    dayName: DAYS[0],
    shortName: SHORT_DAYS[0],
    doses: [
      testCyp,
      ...morningOrals,
      ...morningPowders,
      ...afternoonPowders,
      eveningCJC,
      ...nightlyPeptides,
      retatrutide,
      ...eveningOrals,
      ...eveningPowders,
    ],
  },
  // Monday (1) - Full
  {
    dayIndex: 1,
    dayName: DAYS[1],
    shortName: SHORT_DAYS[1],
    doses: [
      ...commonMorningPeptides,
      ...fullDayExtras,
      testCyp,
      deca,
      igf1,
      ...morningOrals,
      ...morningPowders,
      ...afternoonPowders,
      eveningCJC,
      ...nightlyPeptides,
      tb500Evening,
      ...eveningOrals,
      ...eveningPowders,
    ],
  },
  // Tuesday (2) - Light
  {
    dayIndex: 2,
    dayName: DAYS[2],
    shortName: SHORT_DAYS[2],
    doses: [
      ...commonMorningPeptides,
      testCyp,
      b12,
      igf1,
      ...morningOrals,
      ...morningPowders,
      ...afternoonPowders,
      eveningCJC,
      ...nightlyPeptides,
      tesamorelin,
      ...eveningOrals,
      ...eveningPowders,
    ],
  },
  // Wednesday (3) - Full
  {
    dayIndex: 3,
    dayName: DAYS[3],
    shortName: SHORT_DAYS[3],
    doses: [
      ...commonMorningPeptides,
      ...fullDayExtras,
      testCyp,
      deca,
      igf1,
      ...morningOrals,
      ...morningPowders,
      ...afternoonPowders,
      eveningCJC,
      ...nightlyPeptides,
      tb500Evening,
      ...eveningOrals,
      ...eveningPowders,
    ],
  },
  // Thursday (4) - Light
  {
    dayIndex: 4,
    dayName: DAYS[4],
    shortName: SHORT_DAYS[4],
    doses: [
      ...commonMorningPeptides,
      testCyp,
      igf1,
      ...morningOrals,
      ...morningPowders,
      ...afternoonPowders,
      eveningCJC,
      ...nightlyPeptides,
      tesamorelin,
      ...eveningOrals,
      ...eveningPowders,
    ],
  },
  // Friday (5) - Full
  {
    dayIndex: 5,
    dayName: DAYS[5],
    shortName: SHORT_DAYS[5],
    doses: [
      ...commonMorningPeptides,
      ...fullDayExtras,
      testCyp,
      deca,
      igf1,
      ...morningOrals,
      ...morningPowders,
      ...afternoonPowders,
      eveningCJC,
      ...nightlyPeptides,
      tb500Evening,
      ...eveningOrals,
      ...eveningPowders,
    ],
  },
  // Saturday (6) - Light + Cabergoline
  {
    dayIndex: 6,
    dayName: DAYS[6],
    shortName: SHORT_DAYS[6],
    doses: [
      ...commonMorningPeptides,
      testCyp,
      igf1,
      ...morningOrals,
      ...morningPowders,
      ...afternoonPowders,
      eveningCJC,
      ...nightlyPeptides,
      tesamorelin,
      cabergoline,
      ...eveningOrals,
      ...eveningPowders,
    ],
  },
];
