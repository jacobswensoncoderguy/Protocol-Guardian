import React from 'react';
import { Brain, ShieldAlert, Beaker, BarChart3, DollarSign, Lightbulb, Zap } from 'lucide-react';

interface AIIntelligenceHeroProps {
  overallGrade?: string;
  overallSummary?: string;
  contraindicationCount: number;
  bioIssueCount: number;
  recommendationCount: number;
  hasAnalysis: boolean;
  isLoading: boolean;
  onAnalyze: () => void;
}

const AIIntelligenceHero: React.FC<AIIntelligenceHeroProps> = ({
  overallGrade, overallSummary, contraindicationCount, bioIssueCount,
  recommendationCount, hasAnalysis, isLoading, onAnalyze,
}) => {
  const gradeColor = !overallGrade ? 'text-muted-foreground' :
    overallGrade.startsWith('A') ? 'text-[hsl(var(--neon-green))]' :
    overallGrade.startsWith('B') ? 'text-primary' :
    overallGrade.startsWith('C') ? 'text-[hsl(var(--neon-amber))]' :
    'text-destructive';

  const totalFindings = contraindicationCount + bioIssueCount;

  if (!hasAnalysis) {
    return (
      <button
        onClick={onAnalyze}
        disabled={isLoading}
        className="w-full rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5 text-center transition-all hover:bg-primary/10 active:scale-[0.98] disabled:opacity-60"
      >
        <Brain className="w-8 h-8 text-primary mx-auto mb-2" />
        <p className="text-sm font-bold text-foreground mb-1">Run AI Analysis</p>
        <p className="text-[10px] text-muted-foreground">
          {isLoading ? 'Analyzing your protocol…' : 'Get contraindication checks, bioavailability tips, and protocol grades'}
        </p>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
      <div className="flex items-center gap-4">
        {/* Grade */}
        <div className="flex-shrink-0 w-20 h-20 rounded-xl bg-secondary/30 border border-border/30 flex flex-col items-center justify-center">
          <span className={`text-3xl font-black font-mono ${gradeColor}`}>{overallGrade}</span>
          <span className="text-[7px] text-muted-foreground uppercase tracking-widest">Stack Grade</span>
        </div>

        {/* Summary */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-primary" /> AI Intelligence
          </p>
          <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3">
            {overallSummary || 'Protocol analysis complete.'}
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`flex items-center gap-1.5 p-2 rounded-lg border ${
          contraindicationCount > 0
            ? 'bg-destructive/5 border-destructive/20'
            : 'bg-[hsl(var(--neon-green))]/5 border-[hsl(var(--neon-green))]/20'
        }`}>
          <ShieldAlert className={`w-3.5 h-3.5 ${contraindicationCount > 0 ? 'text-destructive' : 'text-[hsl(var(--neon-green))]'}`} />
          <div>
            <p className="text-xs font-bold font-mono text-foreground leading-none">{contraindicationCount}</p>
            <p className="text-[7px] text-muted-foreground uppercase">Risks</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 p-2 rounded-lg border ${
          bioIssueCount > 0
            ? 'bg-[hsl(var(--neon-amber))]/5 border-[hsl(var(--neon-amber))]/20'
            : 'bg-[hsl(var(--neon-green))]/5 border-[hsl(var(--neon-green))]/20'
        }`}>
          <Beaker className={`w-3.5 h-3.5 ${bioIssueCount > 0 ? 'text-[hsl(var(--neon-amber))]' : 'text-[hsl(var(--neon-green))]'}`} />
          <div>
            <p className="text-xs font-bold font-mono text-foreground leading-none">{bioIssueCount}</p>
            <p className="text-[7px] text-muted-foreground uppercase">Bio Tips</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-primary/5 border border-primary/20">
          <Lightbulb className="w-3.5 h-3.5 text-primary" />
          <div>
            <p className="text-xs font-bold font-mono text-foreground leading-none">{recommendationCount}</p>
            <p className="text-[7px] text-muted-foreground uppercase">Actions</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIIntelligenceHero;
