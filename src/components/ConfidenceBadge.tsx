import { FlaskConical, AlertTriangle, Info } from 'lucide-react';
import { useState } from 'react';

export type EvidenceTier = 'RCT-backed' | 'Meta-analysis' | 'Clinical observation' | 'Anecdotal' | 'Theoretical' | 'Mixed';

export interface ConfidenceData {
  confidencePct: number;
  evidenceTier: EvidenceTier;
  riskAtTolerance?: string;
}

const tierColor: Record<string, string> = {
  'RCT-backed': 'text-status-good bg-status-good/10 border-status-good/20',
  'Meta-analysis': 'text-status-good bg-status-good/10 border-status-good/20',
  'Clinical observation': 'text-primary bg-primary/10 border-primary/20',
  'Anecdotal': 'text-status-warning bg-accent/10 border-accent/20',
  'Theoretical': 'text-muted-foreground bg-secondary border-border/30',
  'Mixed': 'text-primary bg-primary/10 border-primary/20',
};

const tierLabel = (tier: EvidenceTier): string => {
  if (tier === 'RCT-backed') return 'RCT';
  if (tier === 'Meta-analysis') return 'Meta';
  if (tier === 'Clinical observation') return 'Clinical';
  return tier;
};

const pctColor = (pct: number) => {
  if (pct >= 80) return 'text-status-good';
  if (pct >= 60) return 'text-primary';
  if (pct >= 40) return 'text-status-warning';
  return 'text-status-critical';
};

interface ConfidenceBadgeProps {
  data: ConfidenceData;
  compact?: boolean;
}

const ConfidenceBadge = ({ data, compact = false }: ConfidenceBadgeProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const colors = tierColor[data.evidenceTier] || tierColor.Mixed;

  if (compact) {
    return (
      <span
        className={`relative inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full border cursor-default ${colors}`}
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <FlaskConical className="w-2.5 h-2.5" />
        <span className={pctColor(data.confidencePct)}>{data.confidencePct}%</span>
        <span className="opacity-70">·</span>
        <span>{tierLabel(data.evidenceTier)}</span>
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2.5 py-1.5 rounded-lg bg-card border border-border shadow-lg z-50 whitespace-nowrap animate-fade-in">
            <p className="text-[10px] text-foreground font-medium">Confidence: {data.confidencePct}%</p>
            <p className="text-[9px] text-muted-foreground">Evidence: {data.evidenceTier}</p>
            {data.riskAtTolerance && (
              <p className="text-[9px] text-status-warning mt-0.5">{data.riskAtTolerance}</p>
            )}
          </div>
        )}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${colors}`}>
        <FlaskConical className="w-2.5 h-2.5" />
        <span className={pctColor(data.confidencePct)}>{data.confidencePct}%</span>
        <span className="opacity-70">·</span>
        <span>{tierLabel(data.evidenceTier)}</span>
      </span>
      {data.riskAtTolerance && (
        <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-accent/10 text-status-warning border border-accent/20">
          <AlertTriangle className="w-2.5 h-2.5" />
          {data.riskAtTolerance}
        </span>
      )}
    </div>
  );
};

/** Summary block for overall risk at bottom of AI responses */
export const RiskSummaryBlock = ({ riskSummary, toleranceLevel }: { riskSummary: string; toleranceLevel?: string }) => {
  if (!riskSummary) return null;
  return (
    <div className="mt-3 p-2.5 rounded-lg bg-accent/5 border border-accent/20">
      <div className="flex items-center gap-1.5 mb-1">
        <AlertTriangle className="w-3.5 h-3.5 text-status-warning" />
        <span className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">
          Risk Assessment {toleranceLevel ? `(${toleranceLevel})` : ''}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">{riskSummary}</p>
    </div>
  );
};

export default ConfidenceBadge;
