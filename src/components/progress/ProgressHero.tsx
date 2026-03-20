import React from 'react';
import { Target, TrendingUp, TrendingDown, Minus, Trophy, Clock } from 'lucide-react';
import { UserGoal } from '@/hooks/useGoals';

interface ProgressHeroProps {
  activeGoals: UserGoal[];
  achievedCount: number;
  overallProgress: number;
  onAddGoal?: () => void;
}

const ProgressHero: React.FC<ProgressHeroProps> = ({
  activeGoals, achievedCount, overallProgress, onAddGoal,
}) => {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const arcFraction = 0.75; // 270°
  const offset = circ * arcFraction - (overallProgress / 100) * circ * arcFraction;

  // Count goals by pace
  const onTrack = activeGoals.filter(g => {
    if (!g.target_date || !g.target_value || g.baseline_value == null) return true;
    const total = new Date(g.target_date).getTime() - new Date(g.baseline_date || Date.now()).getTime();
    const elapsed = Date.now() - new Date(g.baseline_date || Date.now()).getTime();
    const timePct = total > 0 ? (elapsed / total) * 100 : 100;
    const range = g.target_value - g.baseline_value;
    const progress = range !== 0 ? ((( g.current_value ?? g.baseline_value) - g.baseline_value) / range) * 100 : 100;
    return progress >= timePct;
  }).length;
  const behind = activeGoals.length - onTrack;

  const grade = overallProgress >= 90 ? 'A' : overallProgress >= 75 ? 'B' : overallProgress >= 55 ? 'C' : overallProgress >= 35 ? 'D' : 'F';
  const gradeColor = overallProgress >= 75 ? 'hsl(var(--neon-green))' : overallProgress >= 50 ? 'hsl(var(--neon-amber))' : 'hsl(var(--destructive))';

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
      <div className="flex items-center gap-4">
        {/* Radial gauge */}
        <div className="flex-shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120">
            {/* Track */}
            <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="7"
              strokeDasharray={`${circ * arcFraction} ${circ * (1 - arcFraction)}`}
              strokeLinecap="round" transform="rotate(135 60 60)" />
            {/* Progress */}
            <circle cx="60" cy="60" r={r} fill="none" stroke={gradeColor} strokeWidth="7"
              strokeDasharray={`${circ * arcFraction} ${circ * (1 - arcFraction)}`}
              strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(135 60 60)"
              style={{ filter: `drop-shadow(0 0 8px ${gradeColor})`, transition: 'stroke-dashoffset 1s ease-out' }} />
            <text x="60" y="52" textAnchor="middle" className="fill-foreground text-2xl font-black font-mono">{grade}</text>
            <text x="60" y="70" textAnchor="middle" className="fill-muted-foreground text-[9px] font-medium">{Math.round(overallProgress)}% overall</text>
          </svg>
        </div>

        {/* Stats grid */}
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border/20">
            <Target className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <div>
              <p className="text-lg font-bold font-mono text-foreground leading-none">{activeGoals.length}</p>
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Active</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border/20">
            <Trophy className="w-3.5 h-3.5 text-[hsl(var(--neon-amber))] flex-shrink-0" />
            <div>
              <p className="text-lg font-bold font-mono text-foreground leading-none">{achievedCount}</p>
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Achieved</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border/20">
            <TrendingUp className="w-3.5 h-3.5 text-[hsl(var(--neon-green))] flex-shrink-0" />
            <div>
              <p className="text-lg font-bold font-mono text-foreground leading-none">{onTrack}</p>
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider">On Track</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border/20">
            <TrendingDown className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
            <div>
              <p className="text-lg font-bold font-mono text-foreground leading-none">{behind}</p>
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Behind</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressHero;
