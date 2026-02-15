import { Brain, RefreshCw, ChevronRight, AlertTriangle, TrendingUp } from 'lucide-react';
import { StackAnalysis } from '@/hooks/useProtocolAnalysis';

interface ProtocolIntelligenceCardProps {
  analysis: StackAnalysis | null;
  loading: boolean;
  needsRefresh: boolean;
  toleranceLevel?: string;
  onRefresh: () => void;
  onViewDetails: () => void;
}

const gradeColor = (grade: string) => {
  if (grade.startsWith('A')) return 'text-status-good';
  if (grade.startsWith('B')) return 'text-primary';
  if (grade.startsWith('C')) return 'text-status-warning';
  return 'text-status-critical';
};

const severityIcon = (severity: string) => {
  if (severity === 'danger') return '🔴';
  if (severity === 'warning') return '🟡';
  return '🔵';
};

const toleranceLabels: Record<string, { icon: string; label: string }> = {
  conservative: { icon: '🛡️', label: 'Conservative' },
  moderate: { icon: '⚖️', label: 'Moderate' },
  aggressive: { icon: '⚡', label: 'Aggressive' },
  performance: { icon: '🚀', label: 'Performance' },
};

const ProtocolIntelligenceCard = ({ analysis, loading, needsRefresh, toleranceLevel, onRefresh, onViewDetails }: ProtocolIntelligenceCardProps) => {
  if (!analysis && !loading) {
    return (
      <button
        onClick={onRefresh}
        className="w-full bg-card rounded-lg border border-border/50 p-4 card-glow text-left"
      >
        <div className="flex items-center gap-2 text-primary">
          <Brain className="w-4 h-4" />
          <span className="text-sm font-semibold">Protocol Intelligence</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Tap to analyze your stack for contraindications, efficiency, and optimization.</p>
      </button>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border/50 p-4 card-glow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Protocol Intelligence</span>
        </div>
        <div className="flex items-center gap-2">
          {needsRefresh && !loading && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-mono">outdated</span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !analysis ? (
        <div className="space-y-2">
          <div className="h-3 bg-secondary/50 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-secondary/50 rounded animate-pulse w-1/2" />
          <div className="h-3 bg-secondary/50 rounded animate-pulse w-2/3" />
        </div>
      ) : analysis ? (
        <div className="space-y-3">
          {/* Grade */}
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-bold font-mono ${gradeColor(analysis.overallGrade)}`}>
              {analysis.overallGrade}
            </span>
            <div className="flex-1">
              {toleranceLevel && toleranceLabels[toleranceLevel] && (
                <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground mb-1">
                  {toleranceLabels[toleranceLevel].icon} {toleranceLabels[toleranceLevel].label}
                </span>
              )}
              <p className="text-xs text-muted-foreground leading-snug">{analysis.overallSummary}</p>
            </div>
          </div>

          {/* Top findings */}
          <div className="space-y-1.5">
            {analysis.contraindications.filter(c => c.severity !== 'info').slice(0, 3).map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="flex-shrink-0">{severityIcon(c.severity)}</span>
                <span className="text-foreground/80 leading-snug">{c.description}</span>
              </div>
            ))}
            {analysis.topRecommendations.slice(0, 2).map((r, i) => (
              <div key={`rec-${i}`} className="flex items-start gap-2 text-xs">
                <TrendingUp className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-foreground/80 leading-snug">{r}</span>
              </div>
            ))}
          </div>

          {/* View details */}
          <button
            onClick={onViewDetails}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
          >
            View full analysis
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default ProtocolIntelligenceCard;
