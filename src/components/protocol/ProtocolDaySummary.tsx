import React from 'react';
import { Sun, Moon, Dumbbell, Check, Clock, Zap } from 'lucide-react';

interface ProtocolDaySummaryProps {
  dayLabel: string;
  morningCount: number;
  afternoonCount: number;
  eveningCount: number;
  completedCount: number;
  totalActive: number;
  isToday: boolean;
  weekCompletedDays: number; // out of 7
}

const ProtocolDaySummary: React.FC<ProtocolDaySummaryProps> = ({
  dayLabel, morningCount, afternoonCount, eveningCount,
  completedCount, totalActive, isToday, weekCompletedDays,
}) => {
  const pct = totalActive > 0 ? Math.round((completedCount / totalActive) * 100) : 0;
  const isComplete = totalActive > 0 && completedCount === totalActive;

  const timings = [
    { icon: Sun, label: 'AM', count: morningCount, color: 'text-[hsl(var(--neon-amber))]' },
    { icon: Dumbbell, label: 'PM', count: afternoonCount, color: 'text-primary' },
    { icon: Moon, label: 'EVE', count: eveningCount, color: 'text-[hsl(var(--neon-violet))]' },
  ];

  return (
    <div className={`rounded-2xl border p-4 mb-3 transition-all ${
      isComplete
        ? 'border-[hsl(var(--neon-green))]/30 bg-[hsl(var(--neon-green))]/5'
        : 'border-border/50 bg-card'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
            {isToday && <Zap className="w-3.5 h-3.5 text-primary" />}
            {dayLabel}
          </p>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            {weekCompletedDays}/7 days completed this week
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {isComplete ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-[hsl(var(--neon-green))] bg-[hsl(var(--neon-green))]/10 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" /> COMPLETE
            </span>
          ) : (
            <span className="text-sm font-mono font-bold text-foreground">
              {completedCount}/{totalActive}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-secondary/50 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: isComplete
              ? 'hsl(var(--neon-green))'
              : `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))`,
            boxShadow: isComplete
              ? '0 0 8px hsl(var(--neon-green) / 0.5)'
              : '0 0 6px hsl(var(--primary) / 0.3)',
          }}
        />
      </div>

      {/* Timing breakdown */}
      <div className="grid grid-cols-3 gap-2">
        {timings.map(t => (
          <div key={t.label} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-secondary/30 border border-border/20">
            <t.icon className={`w-3.5 h-3.5 ${t.color} flex-shrink-0`} />
            <div>
              <p className="text-xs font-bold font-mono text-foreground leading-none">{t.count}</p>
              <p className="text-[7px] text-muted-foreground uppercase tracking-wider">{t.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProtocolDaySummary;
