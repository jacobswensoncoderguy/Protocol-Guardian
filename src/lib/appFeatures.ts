export interface AppFeatures {
  goal_tracking: boolean;
  supplementation: boolean;
  inventory_tracking: boolean;
  dosing_reorder: boolean;
  medical_records: boolean;
}

export const DEFAULT_APP_FEATURES: AppFeatures = {
  goal_tracking: true,
  supplementation: true,
  inventory_tracking: true,
  dosing_reorder: true,
  medical_records: true,
};

export const FEATURE_META: Record<keyof AppFeatures, { label: string; description: string; icon: string }> = {
  goal_tracking: {
    label: 'Goal Tracking',
    description: 'Track health goals, progress readings, and milestones over time',
    icon: '🎯',
  },
  supplementation: {
    label: 'Supplementation Protocol',
    description: 'Manage compounds, dosing schedules, and protocol groups',
    icon: '💊',
  },
  inventory_tracking: {
    label: 'Inventory Management',
    description: 'Track supply levels, depletion forecasts, and stock alerts',
    icon: '📦',
  },
  dosing_reorder: {
    label: 'Dosing & Reorder Tracking',
    description: 'Weekly dosing schedules, cost projections, and reorder management',
    icon: '🛒',
  },
  medical_records: {
    label: 'Medical Records & Labs',
    description: 'Upload bloodwork, DEXA scans, and track biomarker changes over time',
    icon: '📋',
  },
};
