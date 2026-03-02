import { useState, useMemo, useEffect, useRef } from 'react';
import { Activity, Target, Zap, Settings2, Check, TrendingUp, Lightbulb, ChevronRight, ArrowUpRight } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

// ── Ring metric definitions ──────────────────────────────────────
export interface RingMetric {
  id: string;
  label: string;
  value: number; // 0-100
  color: string; // HSL
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  detail?: string;
  advice?: string;
  rawValue?: string;
  weeklyTips?: string[]; // actionable tips for closing the ring this week
}

const RING_COLORS = [
  'hsl(2, 100%, 64%)',
  'hsl(142, 76%, 50%)',
  'hsl(195, 100%, 50%)',
  'hsl(270, 100%, 65%)',
  'hsl(45, 100%, 55%)',
  'hsl(330, 100%, 60%)',
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
      setAnimatedDash(dashLength);
      return;
    }
    const timer = setTimeout(() => {
      setAnimatedDash(dashLength);
      mounted.current = true;
    }, delay);
    return () => clearTimeout(timer);
  }, [dashLength, delay]);

  return (
    <g>
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth} opacity={0.15}
      />
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${animatedDash} ${circumference}`}
        transform={`rotate(-90 ${center} ${center})`}
        className="transition-all duration-[1200ms] ease-out"
        style={{ filter: `drop-shadow(0 0 6px ${color}90)` }}
      />
      {animatedDash > 2 && (
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth + 2}
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

// ── Weekly closing advice generator ──────────────────────────────
function getWeeklyClosingAdvice(id: string, value: number): string[] {
  if (value >= 90) return ['You\'re on track — maintain your current routine.'];
  
  const tips: string[] = [];
  const remaining = 100 - value;
  const daysLeft = Math.max(1, 7 - new Date().getDay()); // days left in week

  switch (id) {
    case 'coverage':
      tips.push(`${remaining}% gap remaining — add 1-2 compounds targeting uncovered body systems.`);
      tips.push('Review your "uncovered zones" list and pick the highest-impact one.');
      if (value < 50) tips.push('Focus on the 3 major systems first: Neurological, Cardiovascular, Musculoskeletal.');
      break;
    case 'protocol':
      tips.push(`Check off all doses for the next ${daysLeft} days to close this ring.`);
      tips.push('Set a daily alarm 30 min before your first dose window.');
      if (value < 60) tips.push('Missed doses hurt the most — even 1 catch-up day helps significantly.');
      break;
    case 'goals':
      tips.push(`Log ${Math.ceil(remaining / 20)} more readings this week to show progress.`);
      tips.push('Focus on goals closest to their target — quick wins boost your score.');
      if (value < 40) tips.push('Set a reminder to log one reading each morning.');
      break;
    case 'steps':
      tips.push(`Aim for ${Math.ceil(remaining * 100)} more steps/day over the next ${daysLeft} days.`);
      tips.push('Take a 15-minute walk after each meal for an easy 3,000+ step boost.');
      if (value < 50) tips.push('Park farther away or take stairs — small changes add up fast.');
      break;
    case 'calories':
      tips.push(`Burn ~${Math.ceil(remaining * 6)} more active calories/day to close this ring.`);
      tips.push('A 20-min HIIT session burns ~200 active calories.');
      if (value < 50) tips.push('Even brisk walking for 30 min adds ~150 active calories.');
      break;
    case 'heartRate':
      tips.push('Consistent cardio 3x/week lowers resting HR over time.');
      tips.push('Practice box breathing (4-4-4-4) for 5 min daily to improve HRV.');
      if (value < 50) tips.push('Reduce caffeine and prioritize 7+ hours of sleep.');
      break;
    case 'sleep':
      tips.push(`Aim for ${Math.ceil(remaining * 0.05 * 60)} more minutes of sleep tonight.`);
      tips.push('Dim screens 1 hour before bed and keep the room cool (65-68°F).');
      if (value < 50) tips.push('Set a hard bedtime alarm — consistency matters more than one long night.');
      break;
    case 'activeMin':
      tips.push(`Add ${Math.ceil(remaining * 0.3)} more active minutes/day this week.`);
      tips.push('A 10-min walk counts — break it into 2-3 short movement snacks.');
      if (value < 50) tips.push('Try standing meetings or desk stretches every hour.');
      break;
    default:
      if (id.startsWith('zone-')) {
        tips.push('Add a compound that targets this body zone to increase intensity.');
        tips.push('Check the compound library for options in this category.');
      } else {
        tips.push('Stay consistent with your routine to improve this metric.');
      }
  }
  return tips;
}

function getStatusLabel(value: number): { text: string; className: string } {
  if (value >= 90) return { text: 'On Track', className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  if (value >= 70) return { text: 'Good', className: 'text-primary bg-primary/10 border-primary/20' };
  if (value >= 40) return { text: 'Needs Work', className: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
  return { text: 'At Risk', className: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
}

// ── Ring Detail Sheet ────────────────────────────────────────────
const RingDetailSheet = ({ ring, open, onOpenChange }: {
  ring: (RingMetric & { color: string }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  if (!ring) return null;
  const Icon = ring.icon;
  const tips = ring.weeklyTips || getWeeklyClosingAdvice(ring.id, ring.value);
  const status = getStatusLabel(ring.value);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
        <SheetHeader className="pb-0">
          <SheetTitle className="sr-only">{ring.label} Details</SheetTitle>
        </SheetHeader>
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${ring.color}15` }}>
            <Icon className="w-5 h-5" style={{ color: ring.color }} />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-foreground">{ring.label}</p>
            {ring.rawValue && (
              <p className="text-xs text-muted-foreground font-mono">{ring.rawValue}</p>
            )}
          </div>
          <div className="text-right">
            <span className="text-3xl font-black font-mono" style={{ color: ring.color }}>
              {ring.value}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-secondary/50 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${ring.value}%`, backgroundColor: ring.color }}
          />
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${status.className}`}>
            {status.text}
          </span>
          {ring.detail && (
            <span className="text-xs text-muted-foreground">{ring.detail}</span>
          )}
        </div>

        {/* Weekly closing plan */}
        <div className="rounded-xl border border-border/40 bg-secondary/20 p-3.5 space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-sm font-semibold text-foreground">How to Close This Ring</p>
          </div>
          <div className="space-y-2">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <ArrowUpRight className="w-3.5 h-3.5 mt-0.5 text-primary/60 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
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
  const [selectedRing, setSelectedRing] = useState<(RingMetric & { color: string }) | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  const handleRingTap = (ring: RingMetric & { color: string }) => {
    setSelectedRing(ring);
    setSheetOpen(true);
  };

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

  // Calculate hit zones for click detection on SVG
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = 'touches' in e ? e.changedTouches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.changedTouches[0].clientY : e.clientY;
    const x = ((clientX - rect.left) / rect.width) * size;
    const y = ((clientY - rect.top) / rect.height) * size;
    const center = size / 2;
    const dist = Math.sqrt((x - center) ** 2 + (y - center) ** 2);

    // Find which ring was tapped (check from innermost to outermost)
    for (let i = activeRings.length - 1; i >= 0; i--) {
      const r = outerRadius - i * gap;
      if (Math.abs(dist - r) <= strokeWidth + 6) {
        handleRingTap(activeRings[i]);
        return;
      }
    }
    // Tapped center — open primary ring
    if (dist < outerRadius - (activeRings.length - 1) * gap - strokeWidth && primaryRing) {
      handleRingTap(primaryRing);
    }
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Rings SVG — clickable via coordinate detection */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          onClick={handleSvgClick}
          className="cursor-pointer"
          role="button"
          aria-label="Tap a ring for details"
        >
          {activeRings.map((ring, i) => (
            <ArcRing
              key={ring.id}
              radius={outerRadius - i * gap}
              progress={ring.value}
              color={ring.color}
              strokeWidth={strokeWidth}
              size={size}
              delay={i * 250}
            />
          ))}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {primaryRing && (
            <button
              onClick={() => handleRingTap(primaryRing)}
              className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform pointer-events-auto"
            >
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
          )}
        </div>
      </div>

      {/* Ring legends — clickable */}
      <div className="flex items-center justify-center gap-4 mt-2">
        {activeRings.map(ring => {
          const Icon = ring.icon;
          return (
            <button
              key={ring.id}
              onClick={() => handleRingTap(ring)}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer active:scale-95"
            >
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

      {/* Detail sheet */}
      <RingDetailSheet ring={selectedRing} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
};

export default HealthRings;
