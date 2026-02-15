import { Brain, RefreshCw, ShieldAlert, Beaker, BarChart3, DollarSign, Lightbulb } from 'lucide-react';
import { StackAnalysis } from '@/hooks/useProtocolAnalysis';
import { ToleranceLevel } from '@/hooks/useProtocolAnalysis';
import ToleranceSelector from '@/components/ToleranceSelector';
import MedicalDisclaimer from '@/components/MedicalDisclaimer';
import ProtocolChat from '@/components/ProtocolChat';
import { ChatMessage } from '@/hooks/useProtocolChat';

interface AIInsightsViewProps {
  analysis: StackAnalysis | null;
  loading: boolean;
  toleranceLevel: ToleranceLevel;
  onToleranceChange: (level: ToleranceLevel) => void;
  onRefresh: () => void;
  // Chat props
  chatMessages: ChatMessage[];
  isChatStreaming: boolean;
  onChatSend: (message: string) => void;
  onChatCancel: () => void;
  onChatClear: () => void;
  onApplyChange: (proposalId: string, changeIndex: number) => void;
  onRejectChange: (proposalId: string, changeIndex: number) => void;
  onApplyAll: (proposalId: string) => void;
}

const severityBadge = (severity: string) => {
  if (severity === 'danger') return 'bg-destructive/20 text-status-critical';
  if (severity === 'warning') return 'bg-accent/20 text-status-warning';
  return 'bg-primary/10 text-primary';
};

const verdictColor = (verdict: string) => {
  if (verdict === 'excellent') return 'text-status-good';
  if (verdict === 'good') return 'text-primary';
  if (verdict === 'fair') return 'text-status-warning';
  return 'text-status-critical';
};

const gradeColor = (grade: string) => {
  if (grade.startsWith('A')) return 'text-status-good';
  if (grade.startsWith('B')) return 'text-primary';
  if (grade.startsWith('C')) return 'text-status-warning';
  return 'text-status-critical';
};

const AIInsightsView = ({ analysis, loading, toleranceLevel, onToleranceChange, onRefresh, chatMessages, isChatStreaming, onChatSend, onChatCancel, onChatClear, onApplyChange, onRejectChange, onApplyAll }: AIInsightsViewProps) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">AI Protocol Intelligence</h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analyzing…' : 'Re-analyze'}
        </button>
      </div>

      {/* Tolerance selector */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Dosing Tolerance Level</p>
        <ToleranceSelector value={toleranceLevel} onChange={onToleranceChange} />
      </div>

      {loading && !analysis ? (
        <div className="bg-card rounded-lg border border-border/50 p-6">
          <div className="space-y-3">
            <div className="h-4 bg-secondary/50 rounded animate-pulse w-1/3" />
            <div className="h-3 bg-secondary/50 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-secondary/50 rounded animate-pulse w-2/3" />
            <div className="h-3 bg-secondary/50 rounded animate-pulse w-1/2" />
          </div>
          <p className="text-xs text-muted-foreground mt-4">Analyzing your stack across multiple pharmacological databases…</p>
        </div>
      ) : analysis ? (
        <>
          {/* Overall Grade */}
          <div className="bg-card rounded-lg border border-border/50 p-4">
            <div className="flex items-center gap-4">
              <div className={`text-4xl font-black font-mono ${gradeColor(analysis.overallGrade)}`}>
                {analysis.overallGrade}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Overall Stack Grade</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">{analysis.overallSummary}</p>
              </div>
            </div>
          </div>

          {/* Contraindications */}
          <Section
            icon={<ShieldAlert className="w-4 h-4" />}
            title="Contraindications & Interactions"
            count={analysis.contraindications.length}
          >
            {analysis.contraindications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No significant contraindications detected 🎉</p>
            ) : (
              <div className="space-y-2.5">
                {analysis.contraindications.map((c, i) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${severityBadge(c.severity)}`}>
                        {c.severity}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">{c.category}</span>
                    </div>
                    <p className="text-xs text-foreground/85 mb-1">{c.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground/70">Compounds:</span> {c.compounds.join(', ')}
                    </p>
                    <p className="text-[11px] text-primary mt-1">💡 {c.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Bioavailability */}
          <Section
            icon={<Beaker className="w-4 h-4" />}
            title="Bioavailability Optimization"
            count={analysis.bioavailabilityIssues.length}
          >
            {analysis.bioavailabilityIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">All compounds optimally delivered 🎯</p>
            ) : (
              <div className="space-y-2.5">
                {analysis.bioavailabilityIssues.map((b, i) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground">{b.compound}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{b.currentMethod}</span>
                    </div>
                    <p className="text-xs text-foreground/80 mb-1">{b.issue}</p>
                    <p className="text-[11px] text-primary">🔄 {b.suggestion} ({b.improvementEstimate})</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Protocol Grades */}
          {analysis.protocolGrades.length > 0 && (
            <Section
              icon={<BarChart3 className="w-4 h-4" />}
              title="Protocol Efficiency Grades"
              count={analysis.protocolGrades.length}
            >
              <div className="space-y-2.5">
                {analysis.protocolGrades.map((p, i) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-lg font-bold font-mono ${gradeColor(p.grade)}`}>{p.grade}</span>
                      <span className="text-xs font-semibold text-foreground">{p.protocolName}</span>
                    </div>
                    {p.synergies.length > 0 && (
                      <div className="mb-1">
                        <span className="text-[10px] text-status-good font-mono">SYNERGIES: </span>
                        <span className="text-[11px] text-foreground/70">{p.synergies.join(' • ')}</span>
                      </div>
                    )}
                    {p.redundancies.length > 0 && (
                      <div className="mb-1">
                        <span className="text-[10px] text-status-warning font-mono">REDUNDANCIES: </span>
                        <span className="text-[11px] text-foreground/70">{p.redundancies.join(' • ')}</span>
                      </div>
                    )}
                    {p.gaps.length > 0 && (
                      <div>
                        <span className="text-[10px] text-primary font-mono">GAPS: </span>
                        <span className="text-[11px] text-foreground/70">{p.gaps.join(' • ')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Cost Efficiency */}
          <Section
            icon={<DollarSign className="w-4 h-4" />}
            title="Cost-Efficiency Analysis"
            count={analysis.costEfficiency.length}
          >
            <div className="space-y-2">
              {analysis.costEfficiency.map((c, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-secondary/20">
                  <span className={`text-[10px] font-mono font-bold mt-0.5 ${verdictColor(c.verdict)}`}>
                    {c.verdict.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-foreground">{c.compound}</span>
                    <p className="text-[11px] text-muted-foreground">{c.reasoning}</p>
                    {c.alternative && c.alternative !== 'N/A' && (
                      <p className="text-[11px] text-primary mt-0.5">→ {c.alternative}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Top Recommendations */}
          <Section
            icon={<Lightbulb className="w-4 h-4" />}
            title="Top Recommendations"
            count={analysis.topRecommendations.length}
          >
            <div className="space-y-2">
              {analysis.topRecommendations.map((r, i) => (
                <div key={i} className="flex gap-2.5 items-start">
                  <span className="text-primary text-xs mt-0.5 font-bold">{i + 1}.</span>
                  <p className="text-xs text-foreground/85 leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          </Section>
        </>
      ) : (
        <div className="bg-card rounded-lg border border-border/50 p-6 text-center">
          <Brain className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Tap "Re-analyze" to run AI analysis on your stack.</p>
        </div>
      )}

      {/* Interactive Chat */}
      {analysis && (
        <ProtocolChat
          messages={chatMessages}
          isStreaming={isChatStreaming}
          onSend={onChatSend}
          onCancel={onChatCancel}
          onClear={onChatClear}
          onApplyChange={onApplyChange}
          onRejectChange={onRejectChange}
          onApplyAll={onApplyAll}
        />
      )}

      <MedicalDisclaimer />
    </div>
  );
};

const Section = ({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) => (
  <div className="bg-card rounded-lg border border-border/50 p-4">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-primary">{icon}</span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{count}</span>
    </div>
    {children}
  </div>
);

export default AIInsightsView;
