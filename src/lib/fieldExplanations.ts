/**
 * Field explanation config for the InfoModal system.
 * Maps field keys to explanation data.
 */

export interface FieldExplanation {
  title: string;
  description: string;
  calculation?: string;
  factors?: string[];
  actionLabel?: string;
  actionTab?: string;
}

export const fieldExplanations: Record<string, FieldExplanation> = {
  'stack-grade': {
    title: 'Stack Grade',
    description: 'Your overall protocol grade is calculated from compound coverage across 7 body systems, weighted by protocol importance and adjusted for compliance.',
    calculation: 'Coverage % per system × compliance rate × system weight',
    factors: ['Number of active compounds per system', 'Weekly compliance rate', 'Dose consistency', 'Cycling adherence'],
    actionLabel: 'View Protocol',
    actionTab: 'schedule',
  },
  'compliance-rate': {
    title: 'Compliance Rate',
    description: 'Percentage of scheduled doses actually taken this week across all compounds.',
    calculation: 'Doses taken ÷ Doses scheduled × 100',
    factors: ['Missed morning doses', 'Skipped compounds', 'Late check-offs'],
    actionLabel: 'View Schedule',
    actionTab: 'schedule',
  },
  'active-compounds': {
    title: 'Active in Your System',
    description: 'Compounds currently producing biological effects based on their pharmacokinetic half-lives.',
    calculation: 'Active if hours since last dose < half-life × 3 (87.5% clearance threshold)',
    factors: ['Time since last dose', 'Compound half-life', 'Dose timing'],
    actionLabel: 'View Details',
    actionTab: 'dashboard',
  },
  'wellness-score': {
    title: 'Wellness Score',
    description: 'Composite score derived from your daily check-in data: Energy, Mood, Sleep, and inverse Pain.',
    calculation: '(Energy + Mood + Sleep + (6 - Pain)) ÷ 4, scaled to 10',
    factors: ['Energy level (1-5)', 'Mood rating (1-5)', 'Sleep quality (1-5)', 'Pain severity (1-5, inverted)'],
    actionLabel: 'Log Check-in',
    actionTab: 'tracking',
  },
  'workout-volume': {
    title: 'Total Volume',
    description: 'Sum of all weight × reps across all sets in this session.',
    calculation: 'Σ (weight × reps) for each set',
    factors: ['Exercise selection', 'Set count', 'Rep range', 'Weight used'],
  },
  'days-remaining': {
    title: 'Days Remaining',
    description: 'Estimated days of supply remaining for this compound based on current inventory and daily consumption rate.',
    calculation: 'Current quantity ÷ effective daily consumption',
    factors: ['Current stock level', 'Dose per use', 'Doses per day', 'Days per week', 'Cycling schedule'],
    actionLabel: 'View Inventory',
    actionTab: 'inventory',
  },
  'training-grade': {
    title: 'Training Grade',
    description: 'Derived from workout frequency, volume trends, and post-workout HRV data.',
    calculation: '(workouts/week ÷ 5) × 40% + (volume trend positive? 30% : 0%) + (HRV > 50? 30% : 15%)',
    factors: ['Weekly workout count', 'Volume progression', 'HRV recovery', 'Workout consistency'],
    actionLabel: 'View Workouts',
    actionTab: 'tracking',
  },
};
