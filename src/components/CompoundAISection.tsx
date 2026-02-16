import { Brain, Loader2, Lightbulb, RefreshCw } from 'lucide-react';
import GeminiBadge from '@/components/GeminiBadge';
import { CompoundAnalysis } from '@/hooks/useProtocolAnalysis';

interface CompoundAISectionProps {
  analysis: CompoundAnalysis | null;
  loading: boolean;
  onAnalyze: () => void;
}

const typeLabel = (type: string) => {
  if (type === 'synergy') return { text: 'Synergy', color: 'text-status-good bg-status-good/10' };
  if (type === 'conflict') return { text: 'Conflict', color: 'text-status-critical bg-destructive/10' };
  if (type === 'caution') return { text: 'Caution', color: 'text-status-warning bg-accent/10' };
  return { text: 'Neutral', color: 'text-muted-foreground bg-secondary' };
};

const CompoundAISection = ({ analysis, loading, onAnalyze }: CompoundAISectionProps) => {
  if (!analysis && !loading) {
    return (
      <button
        onClick={onAnalyze}
        className="w-full mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-left hover:bg-primary/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">Analyze Stack Interactions</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">AI-powered analysis of how this compound interacts with your stack</p>
      </button>
    );
  }

  if (loading) {
    return (
      <div className="mt-4 p-3 rounded-lg bg-secondary/30 border border-border/30 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
        <span className="text-xs text-muted-foreground">Analyzing interactions…</span>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Brain className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground/80">AI Stack Analysis</span>
      </div>

      {/* Interactions */}
      {analysis.interactions.length > 0 && (
        <div className="space-y-1.5">
          {analysis.interactions.map((int, i) => {
            const label = typeLabel(int.type);
            return (
              <div key={i} className="p-2 rounded-lg bg-secondary/30 border border-border/30">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${label.color}`}>{label.text}</span>
                  <span className="text-[11px] font-semibold text-foreground/80">↔ {int.withCompound}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{int.description}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Bioavailability */}
      <div className="p-2 rounded-lg bg-secondary/30 border border-border/30">
        <p className="text-[10px] text-muted-foreground">
          <span className="font-semibold text-foreground/70">Delivery:</span> {analysis.bioavailability.currentMethod} — {analysis.bioavailability.absorptionRate}
        </p>
        {analysis.bioavailability.alternatives.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {analysis.bioavailability.alternatives.map((alt, i) => (
              <p key={i} className="text-[10px] text-primary flex items-center gap-1">
                <RefreshCw className="w-3 h-3 flex-shrink-0" />
                {alt.method}: {alt.improvement} — {alt.description}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Suggestions */}
      {analysis.suggestions.length > 0 && (
        <div className="space-y-1">
          {analysis.suggestions.map((s, i) => (
            <p key={i} className="text-[10px] text-foreground/70 flex items-center gap-1.5">
              <Lightbulb className="w-3 h-3 text-primary flex-shrink-0" />
              {s}
            </p>
          ))}
        </div>
      )}
      <GeminiBadge />
    </div>
  );
};

export default CompoundAISection;
