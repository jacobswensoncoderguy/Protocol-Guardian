import { Dumbbell, Flame, Heart, Brain, Zap, Sparkles, Bandage, Moon, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const GOAL_TYPE_LUCIDE_ICONS: Record<string, LucideIcon> = {
  muscle_gain: Dumbbell,
  fat_loss: Flame,
  cardiovascular: Heart,
  cognitive: Brain,
  hormonal: Zap,
  longevity: Sparkles,
  recovery: Bandage,
  sleep: Moon,
  libido: Flame,
  custom: Target,
};

export const getGoalIcon = (goalType: string): LucideIcon => {
  return GOAL_TYPE_LUCIDE_ICONS[goalType] || Target;
};
