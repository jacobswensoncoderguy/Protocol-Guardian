import React from 'react';
import { FlaskConical, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GoalReading } from '@/hooks/useGoalReadings';

interface ProtocolEvent {
  date: string;
  label: string;
  type: 'started' | 'dose_change' | 'stopped';
}

interface CausalityTimelineProps {
  readings: GoalReading[];
  protocolEvents?: ProtocolEvent[];
  goalColor: string;
  targetValue?: number | null;
  baselineValue?: number | null;
}

const CausalityTimeline: React.FC<CausalityTimelineProps> = ({
  readings, protocolEvents = [], goalColor, targetValue, baselineValue,
}) => {
  if (readings.length < 2 && protocolEvents.length === 0) return null;

  // Merge readings + protocol events into a unified timeline
  type TimelineItem = { date: Date; type: 'reading'; reading: GoalReading } | { date: Date; type: 'event'; event: ProtocolEvent };

  const items: TimelineItem[] = [
    ...readings.map(r => ({ date: new Date(r.reading_date), type: 'reading' as const, reading: r })),
    ...protocolEvents.map(e => ({ date: new Date(e.date), type: 'event' as const, event: e })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Only show last 8 items
  const visible = items.slice(-8);

  const getTrend = (idx: number): 'up' | 'down' | 'flat' => {
    if (idx === 0) return 'flat';
    const prev = visible.slice(0, idx).reverse().find(i => i.type === 'reading');
    const curr = visible[idx];
    if (!prev || prev.type !== 'reading' || curr.type !== 'reading') return 'flat';
    const diff = curr.reading.value - prev.reading.value;
    if (Math.abs(diff) < 0.01) return 'flat';
    // Direction depends on whether higher is better (target > baseline)
    return diff > 0 ? 'up' : 'down';
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
        <FlaskConical className="w-3 h-3" /> Causality Timeline
      </p>
      <div className="relative pl-4">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border/40" />

        {visible.map((item, i) => {
          if (item.type === 'event') {
            const eventColors = {
              started: 'bg-[hsl(var(--neon-green))]',
              dose_change: 'bg-[hsl(var(--neon-amber))]',
              stopped: 'bg-destructive',
            };
            return (
              <div key={`e-${i}`} className="relative flex items-center gap-2.5 py-1">
                <div className={`absolute left-[-9px] w-2.5 h-2.5 rounded-sm ${eventColors[item.event.type]} ring-2 ring-background`} />
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-muted-foreground w-14">
                    {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-[10px] font-medium text-foreground/80 px-1.5 py-0.5 rounded bg-secondary/40 border border-border/20">
                    {item.event.label}
                  </span>
                </div>
              </div>
            );
          }

          const trend = getTrend(i);
          const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
          const isGoodTrend = targetValue != null && baselineValue != null
            ? (targetValue > baselineValue ? trend === 'up' : trend === 'down')
            : trend === 'up';

          return (
            <div key={`r-${i}`} className="relative flex items-center gap-2.5 py-1">
              <div className="absolute left-[-8px] w-2 h-2 rounded-full ring-2 ring-background" style={{ backgroundColor: goalColor }} />
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-muted-foreground w-14">
                  {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-[11px] font-mono font-bold" style={{ color: goalColor }}>
                  {item.reading.value} {item.reading.unit}
                </span>
                {i > 0 && (
                  <TrendIcon className={`w-3 h-3 ${isGoodTrend ? 'text-[hsl(var(--neon-green))]' : trend === 'flat' ? 'text-muted-foreground' : 'text-destructive'}`} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CausalityTimeline;
