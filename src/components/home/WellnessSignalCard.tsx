import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import ClickableCard from '@/components/ClickableCard';

interface WellnessSignalCardProps {
  todayScore?: number | null; // 0-10
  weekAvg?: number | null;
  energy?: number | null;
  mood?: number | null;
  sleep?: number | null;
  pain?: number | null;
  onOpenCheckin?: () => void;
  onTapMetric?: (metric: string) => void;
}

const WellnessSignalCard: React.FC<WellnessSignalCardProps> = ({
  todayScore, weekAvg, energy, mood, sleep, pain, onOpenCheckin, onTapMetric,
}) => {
  const hasData = todayScore != null;
  const trend = weekAvg != null && todayScore != null ? (todayScore > weekAvg ? 'up' : todayScore < weekAvg ? 'down' : 'flat') : null;

  const metrics = [
    { key: 'energy', label: 'Energy', value: energy, emoji: '⚡', max: 5 },
    { key: 'mood', label: 'Mood', value: mood, emoji: '😊', max: 5 },
    { key: 'sleep', label: 'Sleep', value: sleep, emoji: '🌙', max: 5 },
    { key: 'pain', label: 'Pain', value: pain, emoji: '🔥', max: 5 },
  ];

  return (
    <ClickableCard onClick={!hasData ? onOpenCheckin : undefined} className="p-3.5" showArrow={false}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-foreground">Wellness Signal</p>
        {hasData ? (
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-mono font-bold text-foreground">{todayScore?.toFixed(1)}</span>
            <span className="text-[9px] text-muted-foreground">/10</span>
            {trend && weekAvg != null && (
              <span className={`flex items-center gap-0.5 text-[9px] ${trend === 'up' ? 'text-[hsl(var(--neon-green))]' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground'}`}>
                {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
                {weekAvg.toFixed(1)} avg
              </span>
            )}
          </div>
        ) : (
          <button onClick={onOpenCheckin} className="text-[10px] text-primary font-medium hover:underline">
            Complete check-in →
          </button>
        )}
      </div>

      {hasData && (
        <div className="space-y-1.5">
          {metrics.map(m => (
            <button
              key={m.key}
              onClick={() => onTapMetric?.(m.key)}
              className="w-full flex items-center gap-2 hover:bg-secondary/30 rounded px-1 -mx-1 py-0.5 transition-colors"
            >
              <span className="text-[10px]">{m.emoji}</span>
              <span className="text-[10px] text-muted-foreground w-12 text-left">{m.label}</span>
              <div className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: m.value != null ? `${(m.value / m.max) * 100}%` : '0%',
                    backgroundColor: m.key === 'pain'
                      ? (m.value && m.value >= 4 ? 'hsl(var(--destructive))' : m.value && m.value >= 2 ? 'hsl(var(--neon-amber))' : 'hsl(var(--neon-green))')
                      : (m.value && m.value >= 4 ? 'hsl(var(--neon-green))' : m.value && m.value >= 2 ? 'hsl(var(--neon-amber))' : 'hsl(var(--destructive))'),
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-foreground w-4 text-right">{m.value ?? '—'}</span>
            </button>
          ))}
        </div>
      )}

      {hasData && (
        <p className="text-[8px] text-muted-foreground/50 mt-2 text-center">↗ Tap any metric for history + compound correlations</p>
      )}
    </ClickableCard>
  );
};

export default WellnessSignalCard;
