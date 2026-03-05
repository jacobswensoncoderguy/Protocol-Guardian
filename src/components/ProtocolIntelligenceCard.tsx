import { Brain, RefreshCw, ChevronRight, TrendingUp, AlertCircle, CircleAlert, Info, EyeOff } from 'lucide-react';
import ChatMarkdown from '@/components/ChatMarkdown';
import InfoTooltip from '@/components/InfoTooltip';
import { Shield, Scale, Zap, Rocket } from 'lucide-react';
import { StackAnalysis } from '@/hooks/useProtocolAnalysis';
import type { LucideIcon } from 'lucide-react';
import ConfidenceBadge, { RiskSummaryBlock } from '@/components/ConfidenceBadge';

interface ProtocolIntelligenceCardProps {
  analysis: StackAnalysis | null;
  loading: boolean;
  needsRefresh: boolean;
  toleranceLevel?: string;
  excludedCounts?: { paused: number; dormant: number };
  onRefresh: () => void;
  onViewDetails: () => void;
}

const gradeColor = (grade: string) => {
  if (grade.startsWith('A')) return 'text-status-good';
  if (grade.startsWith('B')) return 'text-primary';
  if (grade.startsWith('C')) return 'text-status-warning';
  return 'text-status-critical';
};

const severityIconMap: Record<string, { Icon: LucideIcon; color: string }> = {
  danger: { Icon: AlertCircle, color: 'text-status-critical' },
  warning: { Icon: CircleAlert, color: 'text-status-warning' },
  info: { Icon: Info, color: 'text-primary' },
};

const toleranceLabels: Record<string, { Icon: LucideIcon; label: string }> = {
  conservative: { Icon: Shield, label: 'Conservative' },
  moderate: { Icon: Scale, label: 'Moderate' },
  aggressive: { Icon: Zap, label: 'Aggressive' },
  performance: { Icon: Rocket, label: 'Performance' },
};

const ProtocolIntelligenceCard = ({ analysis, loading, needsRefresh, toleranceLevel, excludedCounts, onRefresh, onViewDetails }: ProtocolIntelligenceCardProps) => {
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
          <InfoTooltip text="AI-powered analysis of your compound stack. Checks for contraindications, synergies, and optimization opportunities." />
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
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {toleranceLevel && toleranceLabels[toleranceLevel] && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {(() => { const { Icon } = toleranceLabels[toleranceLevel]; return <Icon className="w-2.5 h-2.5" />; })()}
                    {toleranceLabels[toleranceLevel].label}
                  </span>
                )}
                {excludedCounts && (excludedCounts.paused > 0 || excludedCounts.dormant > 0) && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    <EyeOff className="w-2.5 h-2.5" />
                    {[
                      excludedCounts.dormant > 0 ? `${excludedCounts.dormant} dormant` : null,
                      excludedCounts.paused > 0 ? `${excludedCounts.paused} paused` : null,
                    ].filter(Boolean).join(', ')} excluded
                  </span>
                )}
                {analysis.overallConfidencePct !== undefined && analysis.overallEvidenceTier && (
                  <ConfidenceBadge
                    data={{
                      confidencePct: analysis.overallConfidencePct,
                      evidenceTier: analysis.overallEvidenceTier as any,
                    }}
                    compact
                  />
                )}
              </div>
              <div className="text-xs text-muted-foreground leading-snug"><ChatMarkdown content={analysis.overallSummary} /></div>
            </div>
          </div>

          {/* Top findings */}
          <div className="space-y-1.5">
            {analysis.contraindications.filter(c => c.severity !== 'info').slice(0, 3).map((c, i) => {
              const sev = severityIconMap[c.severity] || severityIconMap.info;
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <sev.Icon className={`w-3 h-3 flex-shrink-0 mt-0.5 ${sev.color}`} />
                  <div className="text-foreground/80 leading-snug flex-1"><ChatMarkdown content={c.description} /></div>
                </div>
              );
            })}
            {analysis.topRecommendations.slice(0, 2).map((r, i) => (
              <div key={`rec-${i}`} className="flex items-start gap-2 text-xs">
                <TrendingUp className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-foreground/80 leading-snug flex-1"><ChatMarkdown content={r} /></div>
              </div>
            ))}
          </div>

          {/* Risk summary */}
          {analysis.riskSummary && (
            <RiskSummaryBlock riskSummary={analysis.riskSummary} toleranceLevel={toleranceLevel} />
          )}

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
