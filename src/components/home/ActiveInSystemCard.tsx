import React from 'react';
import { Activity } from 'lucide-react';
import ClickableCard from '@/components/ClickableCard';

interface ActiveCompoundInfo {
  name: string;
  hoursRemaining: number;
}

interface ActiveInSystemCardProps {
  activeCount: number;
  totalCount: number;
  activeCompounds: ActiveCompoundInfo[];
  peakWindow?: string;
  onClick?: () => void;
}

const ActiveInSystemCard: React.FC<ActiveInSystemCardProps> = ({
  activeCount, totalCount, activeCompounds, peakWindow, onClick,
}) => {
  const visibleCompounds = activeCompounds.slice(0, 4);
  const moreCount = activeCompounds.length - 4;

  // Simple activity bars based on time remaining
  const bars = Array.from({ length: 24 }, (_, i) => {
    const hour = i;
    const count = activeCompounds.filter(c => c.hoursRemaining > (24 - hour)).length;
    return count / Math.max(1, totalCount);
  });

  return (
    <ClickableCard onClick={onClick} className="p-3.5" accentColor="hsl(var(--neon-green))" showArrow={false}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className="w-4 h-4 text-[hsl(var(--neon-green))]" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[hsl(var(--neon-green))] animate-pulse" />
          </div>
          <span className="text-xs font-semibold text-foreground">Active in Your System</span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">{activeCount} / {totalCount}</span>
      </div>

      {/* Activity curve */}
      <div className="flex items-end gap-[2px] h-8 mb-2">
        {bars.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all"
            style={{
              height: `${Math.max(8, v * 100)}%`,
              backgroundColor: v > 0.5 ? 'hsl(var(--neon-green) / 0.7)' : v > 0 ? 'hsl(var(--neon-green) / 0.3)' : 'hsl(var(--secondary))',
            }}
          />
        ))}
      </div>

      {peakWindow && (
        <p className="text-[9px] text-muted-foreground mb-2">Peak active window: {peakWindow}</p>
      )}

      {/* Active compound names */}
      <div className="flex flex-wrap gap-1">
        {visibleCompounds.map((c, i) => (
          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/50 text-muted-foreground border border-border/30">
            {c.name}
          </span>
        ))}
        {moreCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            +{moreCount} more
          </span>
        )}
      </div>
    </ClickableCard>
  );
};

export default ActiveInSystemCard;
