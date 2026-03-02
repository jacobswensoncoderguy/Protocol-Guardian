import { useState, useMemo } from 'react';
import { Activity, Target, Zap, Settings2, Check } from 'lucide-react';

// ── Ring metric definitions ──────────────────────────────────────
export interface RingMetric {
  id: string;
  label: string;
  value: number; // 0-100
  color: string; // HSL
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

const RING_COLORS = [
  'hsl(2, 100%, 64%)',    // Red — Move ring
  'hsl(142, 76%, 50%)',   // Green — Exercise ring
  'hsl(195, 100%, 50%)',  // Cyan — Stand ring
  'hsl(270, 100%, 65%)',  // Purple
  'hsl(45, 100%, 55%)',   // Gold
  'hsl(330, 100%, 60%)',  // Pink
];

interface HealthRingsProps {
  /** Available metrics the user can pick from */
  availableMetrics: RingMetric[];
  /** Which metric IDs are currently selected (max 3) */
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  size?: number;
  className?: string;
}

// ── Single arc ring (Apple Health style) ──────────────────────────
const ArcRing = ({ radius, progress, color, strokeWidth, size }: {
  radius: number; progress: number; color: string; strokeWidth: number; size: number;
}) => {
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const dashLength = (clampedProgress / 100) * circumference;

  return (
    <g>
      {/* Track */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none"
        stroke={`${color}`}
        strokeWidth={strokeWidth}
        opacity={0.15}
      />
      {/* Progress arc */}
      {clampedProgress > 0 && (
        <circle
          cx={center} cy={center} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dashLength} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color}90)` }}
        />
      )}
      {/* End-cap glow when >2% */}
      {clampedProgress > 2 && (
        <circle
          cx={center} cy={center} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 2}
          strokeLinecap="round"
          strokeDasharray={`1 ${circumference}`}
          transform={`rotate(${-90 + (clampedProgress / 100) * 360} ${center} ${center})`}
          opacity={0.5}
          style={{ filter: `blur(3px)` }}
        />
      )}
    </g>
  );
};

const HealthRings = ({
  availableMetrics,
  selectedIds: externalSelectedIds,
  onSelectionChange,
  size = 180,
  className = '',
}: HealthRingsProps) => {
  const [showCustomize, setShowCustomize] = useState(false);
  const [internalSelected, setInternalSelected] = useState<string[]>(
    () => externalSelectedIds || availableMetrics.slice(0, 3).map(m => m.id)
  );

  const selectedIds = externalSelectedIds || internalSelected;

  const activeRings = useMemo(() => {
    return selectedIds
      .map((id, i) => {
        const metric = availableMetrics.find(m => m.id === id);
        if (!metric) return null;
        return { ...metric, color: RING_COLORS[i] || metric.color };
      })
      .filter(Boolean) as (RingMetric & { color: string })[];
  }, [selectedIds, availableMetrics]);

  const strokeWidth = size > 140 ? 14 : 10;
  const gap = strokeWidth + 4;
  const outerRadius = (size / 2) - strokeWidth / 2 - 2;

  const toggleMetric = (id: string) => {
    let next: string[];
    if (selectedIds.includes(id)) {
      next = selectedIds.filter(s => s !== id);
    } else {
      if (selectedIds.length >= 3) {
        next = [...selectedIds.slice(1), id]; // drop oldest, add new
      } else {
        next = [...selectedIds, id];
      }
    }
    if (onSelectionChange) onSelectionChange(next);
    else setInternalSelected(next);
  };

  // Calculate the primary (outermost) ring value for center display
  const primaryRing = activeRings[0];

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Rings SVG */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          {activeRings.map((ring, i) => (
            <ArcRing
              key={ring.id}
              radius={outerRadius - i * gap}
              progress={ring.value}
              color={ring.color}
              strokeWidth={strokeWidth}
              size={size}
            />
          ))}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {primaryRing && (
            <>
              <span
                className="text-2xl font-black font-mono leading-none"
                style={{ color: primaryRing.color, textShadow: `0 0 16px ${primaryRing.color}40` }}
              >
                {primaryRing.value}%
              </span>
              <span className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/60 mt-0.5 font-semibold">
                {primaryRing.label}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Ring legends */}
      <div className="flex items-center justify-center gap-4 mt-2">
        {activeRings.map(ring => {
          const Icon = ring.icon;
          return (
            <div key={ring.id} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: ring.color, boxShadow: `0 0 8px ${ring.color}60` }}
              />
              <Icon className="w-3 h-3" style={{ color: ring.color }} />
              <span className="text-[9px] font-semibold" style={{ color: ring.color }}>
                {ring.value}%
              </span>
              <span className="text-[8px] text-muted-foreground/50">{ring.label}</span>
            </div>
          );
        })}
      </div>

      {/* Customize toggle */}
      <button
        onClick={() => setShowCustomize(v => !v)}
        className="flex items-center gap-1 mt-2 text-[9px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
      >
        <Settings2 className="w-3 h-3" />
        Customize rings
      </button>

      {/* Customization panel */}
      {showCustomize && (
        <div className="mt-2 w-full max-w-xs bg-secondary/30 border border-border/30 rounded-xl p-3 space-y-1.5 animate-fade-in">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-semibold mb-1">Select up to 3 metrics</p>
          {availableMetrics.map(metric => {
            const isSelected = selectedIds.includes(metric.id);
            const Icon = metric.icon;
            const ringIndex = selectedIds.indexOf(metric.id);
            const displayColor = ringIndex >= 0 ? RING_COLORS[ringIndex] : 'hsl(var(--muted-foreground) / 0.3)';
            return (
              <button
                key={metric.id}
                onClick={() => toggleMetric(metric.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all active:scale-[0.98] ${
                  isSelected
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/20 bg-card/30 hover:border-border/40'
                }`}
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: `${displayColor}20` }}>
                  <Icon className="w-3 h-3" style={{ color: displayColor }} />
                </div>
                <span className="flex-1 text-left text-xs font-medium text-foreground">{metric.label}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{metric.value}%</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HealthRings;
