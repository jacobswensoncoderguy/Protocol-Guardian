import { useState, useMemo, useEffect, useRef } from 'react';
import { Activity, Target, Zap, Settings2, Check, TrendingUp, Lightbulb, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ── Ring metric definitions ──────────────────────────────────────
export interface RingMetric {
  id: string;
  label: string;
  value: number; // 0-100
  color: string; // HSL
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  /** Optional extra details for the popover */
  detail?: string;
  advice?: string;
  rawValue?: string; // e.g. "8,421 steps"
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
  availableMetrics: RingMetric[];
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  size?: number;
  className?: string;
}

// ── Single arc ring with entrance animation ──────────────────────
const ArcRing = ({ radius, progress, color, strokeWidth, size, delay }: {
  radius: number; progress: number; color: string; strokeWidth: number; size: number; delay: number;
}) => {
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const dashLength = (clampedProgress / 100) * circumference;

  const [animatedDash, setAnimatedDash] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) {
      // Subsequent value changes — animate immediately
      setAnimatedDash(dashLength);
      return;
    }
    // First mount — staggered entrance from 0
    const timer = setTimeout(() => {
      setAnimatedDash(dashLength);
      mounted.current = true;
    }, delay);
    return () => clearTimeout(timer);
  }, [dashLength, delay]);

  return (
    <g>
      {/* Track */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        opacity={0.15}
      />
      {/* Progress arc */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${animatedDash} ${circumference}`}
        transform={`rotate(-90 ${center} ${center})`}
        className="transition-all duration-[1200ms] ease-out"
        style={{ filter: `drop-shadow(0 0 6px ${color}90)` }}
      />
      {/* End-cap glow */}
      {animatedDash > 2 && (
        <circle
          cx={center} cy={center} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 2}
          strokeLinecap="round"
          strokeDasharray={`1 ${circumference}`}
          transform={`rotate(${-90 + (animatedDash / circumference) * 360} ${center} ${center})`}
          opacity={0.5}
          className="transition-all duration-[1200ms] ease-out"
          style={{ filter: `blur(3px)` }}
        />
      )}
    </g>
  );
};

// ── Ring Detail Popover ──────────────────────────────────────────
const RingDetailPopover = ({ ring, children }: {
  ring: RingMetric & { color: string };
  children: React.ReactNode;
}) => {
  const getDefaultAdvice = (id: string, value: number): string => {
    if (value >= 90) return 'Excellent! Maintain this consistency.';
    if (id === 'coverage') return 'Add compounds targeting uncovered body systems to improve coverage.';
    if (id === 'protocol') return 'Check off your daily doses consistently to raise your protocol score.';
    if (id === 'goals') return 'Log more readings toward your goals to track progress.';
    if (id.startsWith('zone-')) return 'Add compounds that target this body zone.';
    if (id === 'steps') return 'Take a walk or use stairs to hit your step goal.';
    if (id === 'calories') return 'Stay active throughout the day to burn more calories.';
    return value < 50 ? 'Focus on improving this metric for better results.' : 'Good progress — keep it up!';
  };

  const Icon = ring.icon;
  const advice = ring.advice || getDefaultAdvice(ring.id, ring.value);

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-0 overflow-hidden" align="center" sideOffset={8}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/30" style={{ background: `${ring.color}10` }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${ring.color}20` }}>
              <Icon className="w-4 h-4" style={{ color: ring.color }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{ring.label}</p>
              {ring.rawValue && (
                <p className="text-[10px] text-muted-foreground font-mono">{ring.rawValue}</p>
              )}
            </div>
            <span className="ml-auto text-xl font-black font-mono" style={{ color: ring.color }}>
              {ring.value}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 pt-3 pb-2">
          <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${ring.value}%`, backgroundColor: ring.color }}
            />
          </div>
        </div>

        {/* Detail */}
        {ring.detail && (
          <div className="px-4 pb-2">
            <div className="flex items-start gap-1.5">
              <TrendingUp className="w-3 h-3 mt-0.5 text-muted-foreground/60 flex-shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">{ring.detail}</p>
            </div>
          </div>
        )}

        {/* Advice */}
        <div className="px-4 pb-3">
          <div className="flex items-start gap-1.5 bg-primary/5 rounded-lg p-2 border border-primary/10">
            <Lightbulb className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
            <p className="text-[11px] text-primary/80 leading-relaxed">{advice}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ── Clickable ring hit area (invisible arc sector) ───────────────
const RingHitArea = ({ radius, strokeWidth, size, ring }: {
  radius: number; strokeWidth: number; size: number;
  ring: RingMetric & { color: string };
}) => {
  const center = size / 2;
  return (
    <RingDetailPopover ring={ring}>
      <circle
        cx={center} cy={center} r={radius}
        fill="none"
        stroke="transparent"
        strokeWidth={strokeWidth + 12}
        className="cursor-pointer"
        style={{ pointerEvents: 'stroke' }}
      />
    </RingDetailPopover>
  );
};

// ── Main HealthRings component ───────────────────────────────────
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
        next = [...selectedIds.slice(1), id];
      } else {
        next = [...selectedIds, id];
      }
    }
    if (onSelectionChange) onSelectionChange(next);
    else setInternalSelected(next);
  };

  const primaryRing = activeRings[0];

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Rings SVG — clickable */}
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
              delay={i * 250} // staggered entrance
            />
          ))}
          {/* Invisible click targets on top */}
          {activeRings.map((ring, i) => (
            <RingHitArea
              key={`hit-${ring.id}`}
              radius={outerRadius - i * gap}
              strokeWidth={strokeWidth}
              size={size}
              ring={ring}
            />
          ))}
        </svg>

        {/* Center content — also clickable for primary ring */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {primaryRing && (
            <RingDetailPopover ring={primaryRing}>
              <button className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform">
                <span
                  className="text-2xl font-black font-mono leading-none"
                  style={{ color: primaryRing.color, textShadow: `0 0 16px ${primaryRing.color}40` }}
                >
                  {primaryRing.value}%
                </span>
                <span className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/60 mt-0.5 font-semibold">
                  {primaryRing.label}
                </span>
              </button>
            </RingDetailPopover>
          )}
        </div>
      </div>

      {/* Ring legends — clickable */}
      <div className="flex items-center justify-center gap-4 mt-2">
        {activeRings.map(ring => {
          const Icon = ring.icon;
          return (
            <RingDetailPopover key={ring.id} ring={ring}>
              <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: ring.color, boxShadow: `0 0 8px ${ring.color}60` }}
                />
                <Icon className="w-3 h-3" style={{ color: ring.color }} />
                <span className="text-[9px] font-semibold" style={{ color: ring.color }}>
                  {ring.value}%
                </span>
                <span className="text-[8px] text-muted-foreground/50">{ring.label}</span>
              </button>
            </RingDetailPopover>
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
