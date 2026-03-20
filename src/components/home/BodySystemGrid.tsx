import React from 'react';
import { Brain, Heart, Dumbbell, Flame, Shield, Zap, Activity } from 'lucide-react';
import { BodyZone } from '@/data/bodyZoneMapping';

interface SystemStatus {
  zone: BodyZone;
  label: string;
  emoji: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'active' | 'partial' | 'missed' | 'synced' | 'none';
}

interface BodySystemGridProps {
  zoneIntensities: Record<BodyZone, number>;
  complianceByZone?: Record<BodyZone, { taken: number; total: number }>;
  workoutLoggedToday?: boolean;
  onTapSystem?: (zone: BodyZone) => void;
}

const SYSTEMS: Omit<SystemStatus, 'status'>[] = [
  { zone: 'hormonal', label: 'Hormonal', emoji: '🟢', icon: Zap },
  { zone: 'core', label: 'Metabolic', emoji: '🔵', icon: Flame },
  { zone: 'brain', label: 'Cognitive', emoji: '🟡', icon: Brain },
  { zone: 'heart', label: 'Cardio', emoji: '🔴', icon: Heart },
  { zone: 'arms', label: 'Recovery', emoji: '🟠', icon: Activity },
  { zone: 'immune', label: 'Immune', emoji: '⚪', icon: Shield },
  { zone: 'legs', label: 'Training', emoji: '🟣', icon: Dumbbell },
];

const STATUS_STYLES = {
  active: { bg: 'bg-[hsl(var(--neon-green))]/10', border: 'border-[hsl(var(--neon-green))]/30', text: 'text-[hsl(var(--neon-green))]', label: 'ACTIVE' },
  partial: { bg: 'bg-[hsl(var(--neon-amber))]/10', border: 'border-[hsl(var(--neon-amber))]/30', text: 'text-[hsl(var(--neon-amber))]', label: 'PARTIAL' },
  missed: { bg: 'bg-destructive/10', border: 'border-destructive/30', text: 'text-destructive', label: 'MISSED' },
  synced: { bg: 'bg-primary/10', border: 'border-primary/30', text: 'text-primary', label: 'SYNCED' },
  none: { bg: 'bg-secondary/30', border: 'border-border/30', text: 'text-muted-foreground', label: '—' },
};

const BodySystemGrid: React.FC<BodySystemGridProps> = ({
  zoneIntensities, complianceByZone, workoutLoggedToday = false, onTapSystem,
}) => {
  const getStatus = (zone: BodyZone, label: string): 'active' | 'partial' | 'missed' | 'synced' | 'none' => {
    if (label === 'Training') return workoutLoggedToday ? 'synced' : 'none';
    const compliance = complianceByZone?.[zone];
    if (!compliance || compliance.total === 0) return 'none';
    if (compliance.taken === compliance.total) return 'active';
    if (compliance.taken > 0) return 'partial';
    return 'missed';
  };

  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Body Systems</p>
      <div className="grid grid-cols-2 gap-2">
        {SYSTEMS.map(sys => {
          const status = getStatus(sys.zone, sys.label);
          const style = STATUS_STYLES[status];
          const Icon = sys.icon;
          const intensity = zoneIntensities[sys.zone] ?? 0;

          return (
            <button
              key={sys.zone + sys.label}
              onClick={() => onTapSystem?.(sys.zone)}
              className={`flex items-center gap-2 p-2.5 rounded-xl border ${style.border} ${style.bg} transition-all active:scale-[0.97] text-left`}
            >
              <Icon className={`w-4 h-4 ${style.text} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-foreground truncate">{sys.label}</p>
                <p className={`text-[8px] font-bold uppercase tracking-wider ${style.text}`}>{style.label}</p>
              </div>
              {intensity > 0 && (
                <span className="text-[9px] font-mono text-muted-foreground">{Math.round(intensity * 100)}%</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BodySystemGrid;
