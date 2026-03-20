import React from 'react';
import { Dumbbell, ChevronRight } from 'lucide-react';
import ClickableCard from '@/components/ClickableCard';
import { BodyZone, BODY_ZONES } from '@/data/bodyZoneMapping';

interface StackGradeHeroProps {
  overallScore: number; // 0-100
  zoneIntensities: Record<BodyZone, number>;
  weeklyWorkoutCount?: number;
  complianceRate?: number;
  compoundCount: number;
  trendDirection?: 'up' | 'down' | 'flat';
  onTapSystem?: (zone: BodyZone) => void;
  onTapStat?: (stat: string) => void;
}

function scoreToGrade(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  return 'F';
}

const SYSTEM_MAP: { zone: BodyZone; emoji: string; label: string }[] = [
  { zone: 'hormonal', emoji: '🟢', label: 'Hormonal' },
  { zone: 'core', emoji: '🔵', label: 'Metabolic' },
  { zone: 'brain', emoji: '🟡', label: 'Cognitive' },
  { zone: 'heart', emoji: '🟠', label: 'Recovery' },
  { zone: 'heart', emoji: '🔴', label: 'Cardio' },
  { zone: 'legs', emoji: '🟣', label: 'Training' },
  { zone: 'immune', emoji: '⚪', label: 'Immune' },
];

const StackGradeHero: React.FC<StackGradeHeroProps> = ({
  overallScore, zoneIntensities, weeklyWorkoutCount = 0, complianceRate = 0,
  compoundCount, trendDirection = 'flat', onTapSystem, onTapStat,
}) => {
  const grade = scoreToGrade(overallScore);
  const pct = Math.min(100, Math.max(0, overallScore));
  const R = 54, STROKE = 7, C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;

  return (
    <ClickableCard className="p-4" showArrow={false}>
      <div className="flex gap-4">
        {/* Arc ring */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <svg width="128" height="128" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r={R} fill="none" stroke="hsl(var(--secondary))" strokeWidth={STROKE} />
            <circle
              cx="64" cy="64" r={R} fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${C}`}
              strokeLinecap="round"
              transform="rotate(-90 64 64)"
              style={{ filter: 'drop-shadow(0 0 8px hsl(var(--primary) / 0.4))' }}
            />
            <text x="64" y="58" textAnchor="middle" className="fill-foreground" style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'JetBrains Mono' }}>
              {grade}
            </text>
            <text x="64" y="78" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: '11px', fontWeight: 500 }}>
              {pct}%
            </text>
          </svg>
        </div>

        {/* Sub-grades */}
        <div className="flex-1 space-y-1.5 min-w-0">
          <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground mb-1">System Grades</p>
          {SYSTEM_MAP.map((sys, i) => {
            const intensity = zoneIntensities[sys.zone] ?? 0;
            const sysScore = Math.round(intensity * 100);
            const sysGrade = scoreToGrade(sysScore);
            const isTraining = sys.label === 'Training';

            return (
              <button
                key={i}
                onClick={() => onTapSystem?.(sys.zone)}
                className="w-full flex items-center gap-1.5 group hover:bg-secondary/30 rounded px-1 -mx-1 transition-colors"
              >
                <span className="text-[10px]">{sys.emoji}</span>
                <span className="text-[10px] text-muted-foreground flex-1 text-left truncate">{sys.label}</span>
                {isTraining && weeklyWorkoutCount === 0 ? (
                  <span className="text-[8px] text-muted-foreground/50 italic">No data</span>
                ) : (
                  <>
                    <span className="text-[10px] font-mono font-bold text-foreground w-6 text-right">{sysGrade}</span>
                    <div className="w-12 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${sysScore}%`,
                          backgroundColor: sysScore >= 80 ? 'hsl(var(--neon-green))' : sysScore >= 60 ? 'hsl(var(--primary))' : sysScore >= 40 ? 'hsl(var(--neon-amber))' : 'hsl(var(--destructive))',
                        }}
                      />
                    </div>
                  </>
                )}
                <ChevronRight className="w-3 h-3 text-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer stats */}
      <div className="grid grid-cols-4 gap-1 mt-3 pt-3 border-t border-border/30">
        {[
          { label: 'Compounds', value: String(compoundCount), key: 'compounds' },
          { label: 'Workouts/Wk', value: String(weeklyWorkoutCount), key: 'workouts' },
          { label: 'Compliance', value: `${Math.round(complianceRate)}%`, key: 'compliance' },
          { label: 'Trend', value: trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '→', key: 'trend' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => onTapStat?.(s.key)}
            className="text-center hover:bg-secondary/30 rounded p-1 transition-colors"
          >
            <p className={`text-sm font-mono font-bold ${
              s.key === 'trend'
                ? trendDirection === 'up' ? 'text-[hsl(var(--neon-green))]' : trendDirection === 'down' ? 'text-destructive' : 'text-foreground'
                : 'text-foreground'
            }`}>{s.value}</p>
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>
    </ClickableCard>
  );
};

export default StackGradeHero;
