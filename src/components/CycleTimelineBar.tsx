import { Compound } from '@/data/compounds';
import { getCycleStatus } from '@/lib/cycling';

interface CycleTimelineBarProps {
  compound: Compound;
  className?: string;
}

const CycleTimelineBar = ({ compound, className = '' }: CycleTimelineBarProps) => {
  const { hasCycle } = getCycleStatus(compound);
  if (!hasCycle || !compound.cycleOnDays || !compound.cycleOffDays || !compound.cycleStartDate) return null;

  const onDays = compound.cycleOnDays;
  const offDays = compound.cycleOffDays;
  const cycleLength = onDays + offDays;
  const onPct = (onDays / cycleLength) * 100;

  // Calculate current position in cycle
  const start = new Date(compound.cycleStartDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const dayInCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength;
  const progressPct = (dayInCycle / cycleLength) * 100;
  const isOn = dayInCycle < onDays;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span>ON {onDays}d</span>
        <span className={`font-semibold ${isOn ? 'text-status-good' : 'text-status-warning'}`}>
          Day {dayInCycle + 1} of {cycleLength}
        </span>
        <span>OFF {offDays}d</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden bg-muted/50 border border-border/30">
        {/* ON segment */}
        <div
          className="absolute inset-y-0 left-0 bg-status-good/25 border-r border-border/40"
          style={{ width: `${onPct}%` }}
        />
        {/* OFF segment is the remaining background */}

        {/* Today marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 z-10"
          style={{ left: `${progressPct}%` }}
        >
          <div className={`w-full h-full ${isOn ? 'bg-status-good' : 'bg-status-warning'}`} />
          <div
            className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border-2 border-card ${isOn ? 'bg-status-good' : 'bg-status-warning'}`}
          />
        </div>

        {/* Phase labels inside bar */}
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-status-good/70 uppercase tracking-wider">
          on
        </span>
        <span
          className="absolute top-1/2 -translate-y-1/2 text-[8px] font-bold text-muted-foreground/60 uppercase tracking-wider"
          style={{ left: `${onPct + 2}%` }}
        >
          off
        </span>
      </div>
    </div>
  );
};

export default CycleTimelineBar;
