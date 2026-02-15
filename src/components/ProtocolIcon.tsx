import { HeartPulse, ShieldCheck, Brain, Flame, Bandage, Target, Sparkles, FlaskConical, Syringe, Gauge } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const iconStringMap: Record<string, LucideIcon> = {
  'heart-pulse': HeartPulse,
  'shield-check': ShieldCheck,
  brain: Brain,
  flame: Flame,
  bandage: Bandage,
  target: Target,
  sparkles: Sparkles,
  syringe: Syringe,
  gauge: Gauge,
  'flask-conical': FlaskConical,
};

interface ProtocolIconProps {
  icon: string;
  className?: string;
}

const ProtocolIcon = ({ icon, className = 'w-4 h-4 text-primary' }: ProtocolIconProps) => {
  const IconComp = iconStringMap[icon];
  if (IconComp) {
    return <IconComp className={className} />;
  }
  // Fallback: render as text (for legacy emoji or custom icons)
  return <span className={className.includes('text-') ? '' : 'text-primary'}>{icon}</span>;
};

export default ProtocolIcon;
