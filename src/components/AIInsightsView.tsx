import { useState, useCallback } from 'react';
import { Brain, RefreshCw, ShieldAlert, Beaker, BarChart3, DollarSign, Lightbulb, ChevronDown, GitCompare, AlertTriangle, Zap, MessageSquare, Send, X, ThumbsDown, TrendingUp, Shield, Scale, Rocket } from 'lucide-react';
import { StackAnalysis, ToleranceComparison } from '@/hooks/useProtocolAnalysis';
import { ToleranceLevel } from '@/hooks/useProtocolAnalysis';
import ToleranceSelector from '@/components/ToleranceSelector';
import MedicalDisclaimer from '@/components/MedicalDisclaimer';
import ProtocolChat from '@/components/ProtocolChat';
import GeminiBadge from '@/components/GeminiBadge';
import { ChatMessage, ChangeProposal, PendingConfirm } from '@/hooks/useProtocolChat';
import { useConversations } from '@/hooks/useConversations';
import { Compound } from '@/data/compounds';

interface AIInsightsViewProps {
  analysis: StackAnalysis | null;
  loading: boolean;
  toleranceLevel: ToleranceLevel;
  onToleranceChange: (level: ToleranceLevel) => void;
  onRefresh: () => void;
  chatMessages: ChatMessage[];
  isChatStreaming: boolean;
  onChatSend: (message: string) => void;
  onChatCancel: () => void;
  onChatClear: () => void;
  onApplyChange: (proposalId: string, changeIndex: number) => void;
  onRejectChange: (proposalId: string, changeIndex: number) => void;
  onApplyAll: (proposalId: string) => void;
  onUndoChange?: (proposalId: string, changeIndex: number) => void;
  toleranceComparison: ToleranceComparison | null;
  compareLoading: boolean;
  onCompareAllLevels: () => void;
  conversationManager: ReturnType<typeof useConversations>;
  onConfirmChange?: () => void;
  onCancelConfirm?: () => void;
  pendingConfirm?: PendingConfirm | null;
  proposals?: ChangeProposal[];
  compounds?: Compound[];
  onChangeAccepted?: () => void;
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

const toleranceMeta: Record<string, { Icon: typeof Shield; label: string; color: string }> = {
  conservative: { Icon: Shield, label: 'Conservative', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  moderate: { Icon: Scale, label: 'Moderate', color: 'bg-primary/15 text-primary border-primary/30' },
  performance: { Icon: Rocket, label: 'Performance', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
};

const ToleranceBadge = ({ level }: { level: string }) => {
  const meta = toleranceMeta[level] || toleranceMeta.moderate;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${meta.color}`}>
      <meta.Icon className="w-3 h-3" />
      <span>{meta.label}</span>
    </span>
  );
};

const gradeColor = (grade: string) => {
  if (grade.startsWith('A')) return 'text-status-good';
  if (grade.startsWith('B')) return 'text-primary';
  if (grade.startsWith('C')) return 'text-status-warning';
  return 'text-status-critical';
};

const severityWeight = (severity: string) => {
  if (severity === 'danger') return 3;
  if (severity === 'warning') return 2;
  return 1;
};

const verdictWeight = (verdict: string) => {
  if (verdict === 'poor') return 4;
  if (verdict === 'fair') return 3;
  if (verdict === 'good') return 2;
  return 1;
};

const computeSectionScores = (analysis: StackAnalysis) => {
  const contraindicationScore = analysis.contraindications.reduce(
    (sum, c) => sum + severityWeight(c.severity), 0
  );
  const contraindicationCompounds = new Set(analysis.contraindications.flatMap(c => c.compounds)).size;

  const bioScore = analysis.bioavailabilityIssues.length * 2;
  const bioCompounds = analysis.bioavailabilityIssues.length;

  const protocolScore = analysis.protocolGrades.reduce((sum, p) => {
    const gLetter = p.grade.charAt(0);
    return sum + (gLetter === 'D' || gLetter === 'F' ? 4 : gLetter === 'C' ? 3 : gLetter === 'B' ? 1 : 0);
  }, 0);
  const protocolCount = analysis.protocolGrades.length;

  const costScore = analysis.costEfficiency.reduce(
    (sum, c) => sum + verdictWeight(c.verdict), 0
  );
  const costCompounds = analysis.costEfficiency.length;

  const recsScore = analysis.topRecommendations.length;

  return [
    { id: 'contraindications', score: contraindicationScore, count: contraindicationCompounds, label: `${contraindicationCompounds} compound${contraindicationCompounds !== 1 ? 's' : ''}` },
    { id: 'bioavailability', score: bioScore, count: bioCompounds, label: `${bioCompounds} compound${bioCompounds !== 1 ? 's' : ''}` },
    { id: 'protocols', score: protocolScore, count: protocolCount, label: `${protocolCount} protocol${protocolCount !== 1 ? 's' : ''}` },
    { id: 'cost', score: costScore, count: costCompounds, label: `${costCompounds} compound${costCompounds !== 1 ? 's' : ''}` },
    { id: 'recommendations', score: recsScore, count: analysis.topRecommendations.length, label: `${analysis.topRecommendations.length} item${analysis.topRecommendations.length !== 1 ? 's' : ''}` },
  ].sort((a, b) => b.score - a.score);
};

const impactBadge = (score: number) => {
  if (score >= 6) return { label: 'High Impact', color: 'bg-destructive/15 text-status-critical' };
  if (score >= 3) return { label: 'Medium', color: 'bg-accent/15 text-status-warning' };
  if (score > 0) return { label: 'Low', color: 'bg-primary/10 text-primary' };
  return { label: 'None', color: 'bg-secondary text-muted-foreground' };
};

// Impact percentage badge
const ImpactPercent = ({ value, label }: { value?: number; label?: string }) => {
  if (value === undefined && !label) return null;
  const display = value !== undefined ? `${value}%` : label;
  const color = value !== undefined
    ? value >= 70 ? 'text-status-critical bg-destructive/10' : value >= 40 ? 'text-status-warning bg-accent/10' : 'text-primary bg-primary/10'
    : 'text-muted-foreground bg-secondary';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded-full ${color}`}>
      <TrendingUp className="w-2.5 h-2.5" />
      {display}
    </span>
  );
};

// Dismiss button for findings
const DismissButton = ({ onDismiss }: { onDismiss: () => void }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onDismiss(); }}
    className="p-1 rounded-md text-muted-foreground/50 hover:text-status-warning hover:bg-accent/10 transition-colors"
    title="Dismiss this finding"
  >
    <ThumbsDown className="w-3 h-3" />
  </button>
);

// Inline reply component with proper text selection & copy-paste
const InlineReply = ({ context, onSend }: { context: string; onSend: (message: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reply, setReply] = useState('');

  const handleSend = (e?: React.MouseEvent | React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!reply.trim()) return;
    onSend(`Regarding: "${context.slice(0, 120)}${context.length > 120 ? '…' : ''}"\n\n${reply}`);
    setReply('');
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors mt-1.5 group"
      >
        <MessageSquare className="w-3 h-3 group-hover:text-primary" />
        <span>Reply</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSend} className="mt-2 flex items-center gap-1.5 animate-fade-in" onClick={(e) => e.stopPropagation()}>
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        placeholder="Correct or ask about this…"
        rows={2}
        className="flex-1 text-xs bg-secondary/50 border border-border/50 rounded-md px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none select-text"
        style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
        autoFocus
      />
      <button type="submit" disabled={!reply.trim()} className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-30 transition-colors">
        <Send className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={(e) => { e.stopPropagation(); setIsOpen(false); setReply(''); }} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </form>
  );
};

const CollapsibleSection = ({
  icon,
  title,
  count,
  countLabel,
  score,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  countLabel: string;
  score: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const impact = impactBadge(score);

  return (
    <div className="bg-card rounded-lg border border-border/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <span className="text-primary">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
          {countLabel}
        </span>
        {score > 0 && (
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${impact.color}`}>
            {impact.label}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 animate-fade-in select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
          {children}
        </div>
      )}
    </div>
  );
};

const ToleranceComparisonCard = ({
  comparison,
  loading,
  onCompare,
  currentLevel,
}: {
  comparison: ToleranceComparison | null;
  loading: boolean;
  onCompare: () => void;
  currentLevel: string;
}) => {
  const levels = ['conservative', 'moderate', 'aggressive', 'performance'] as const;

  return (
    <div className="bg-card rounded-lg border border-border/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Grade Comparison</h3>
        </div>
        <button
          onClick={onCompare}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Comparing…' : comparison ? 'Refresh' : 'Compare All'}
        </button>
      </div>

      {loading && !comparison ? (
        <div className="grid grid-cols-2 gap-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="p-3 rounded-lg bg-secondary/30 animate-pulse">
              <div className="h-6 bg-secondary/50 rounded w-8 mb-2" />
              <div className="h-3 bg-secondary/50 rounded w-full" />
            </div>
          ))}
        </div>
      ) : comparison ? (
        <div className="grid grid-cols-2 gap-2">
          {levels.map(level => {
            const data = comparison[level];
            const meta = toleranceMeta[level];
            const isActive = level === currentLevel;

            return (
              <div
                key={level}
                className={`p-3 rounded-lg border transition-all select-text ${
                  isActive
                    ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border/30 bg-secondary/20'
                }`}
                style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <meta.Icon className="w-3 h-3" /> {meta.label}
                  </span>
                  {isActive && (
                    <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-primary/15 text-primary">ACTIVE</span>
                  )}
                </div>
                <div className={`text-2xl font-black font-mono mb-1.5 ${gradeColor(data.grade)}`}>
                  {data.grade}
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug mb-2">{data.summary}</p>
                <div className="space-y-1">
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-status-warning flex-shrink-0 mt-0.5" />
                    <p className="text-[9px] text-muted-foreground leading-snug">{data.topRisk}</p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Zap className="w-3 h-3 text-status-good flex-shrink-0 mt-0.5" />
                    <p className="text-[9px] text-muted-foreground leading-snug">{data.topStrength}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-3">
          Compare how your stack grades across all tolerance levels in one view.
        </p>
      )}
    </div>
  );
};

const AIInsightsView = ({ analysis, loading, toleranceLevel, onToleranceChange, onRefresh, chatMessages, isChatStreaming, onChatSend, onChatCancel, onChatClear, onApplyChange, onRejectChange, onApplyAll, onUndoChange, toleranceComparison, compareLoading, onCompareAllLevels, conversationManager, onConfirmChange, onCancelConfirm, pendingConfirm, proposals, compounds }: AIInsightsViewProps) => {
  const sectionScores = analysis ? computeSectionScores(analysis) : [];
  const [dismissedFindings, setDismissedFindings] = useState<Set<string>>(new Set());
  // Pending message from inline reply — opened in ProtocolChat panel
  const [pendingChatMessage, setPendingChatMessage] = useState<string | null>(null);

  // Inline reply: ensure a conversation exists, then open the chat panel with the message pre-loaded.
  // We don't call onChatSend here because conversationId state won't have propagated yet.
  const handleInlineReply = useCallback(async (message: string) => {
    if (!conversationManager.activeConversationId) {
      const conv = await conversationManager.createConversation('Protocol Discussion');
      if (!conv) return;
    }
    setPendingChatMessage(message);
  }, [conversationManager]);

  const dismiss = (key: string) => {
    setDismissedFindings(prev => new Set(prev).add(key));
  };

  const isDismissed = (key: string) => dismissedFindings.has(key);

  const renderSection = (sectionId: string) => {
    if (!analysis) return null;
    const sectionData = sectionScores.find(s => s.id === sectionId);
    if (!sectionData) return null;

    switch (sectionId) {
      case 'contraindications':
        return (
          <CollapsibleSection
            key={sectionId}
            icon={<ShieldAlert className="w-4 h-4" />}
            title="Contraindications & Interactions"
            count={analysis.contraindications.length}
            countLabel={sectionData.label}
            score={sectionData.score}
          >
            {analysis.contraindications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No significant contraindications detected</p>
            ) : (
              <div className="space-y-2.5">
                {analysis.contraindications.map((c, i) => {
                  const key = `contra-${i}`;
                  if (isDismissed(key)) return null;
                  return (
                    <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/30 select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${severityBadge(c.severity)}`}>
                          {c.severity}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">{c.category}</span>
                        <ImpactPercent value={(c as any).impactPercent} label={(c as any).impactLabel} />
                        <div className="ml-auto"><DismissButton onDismiss={() => dismiss(key)} /></div>
                      </div>
                      <p className="text-xs text-foreground/85 mb-1">{c.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground/70">Compounds:</span> {c.compounds.join(', ')}
                      </p>
                      <p className="text-[11px] text-primary mt-1">
                        <Lightbulb className="w-3 h-3 inline mr-1 -mt-0.5" />
                        {c.recommendation}
                      </p>
                      <InlineReply context={c.description} onSend={handleInlineReply} />
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleSection>
        );
      case 'bioavailability':
        return (
          <CollapsibleSection
            key={sectionId}
            icon={<Beaker className="w-4 h-4" />}
            title="Bioavailability Optimization"
            count={analysis.bioavailabilityIssues.length}
            countLabel={sectionData.label}
            score={sectionData.score}
          >
            {analysis.bioavailabilityIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">All compounds optimally delivered</p>
            ) : (
              <div className="space-y-2.5">
                {analysis.bioavailabilityIssues.map((b, i) => {
                  const key = `bio-${i}`;
                  if (isDismissed(key)) return null;
                  return (
                    <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/30 select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-foreground">{b.compound}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-muted-foreground">{b.currentMethod}</span>
                          <DismissButton onDismiss={() => dismiss(key)} />
                        </div>
                      </div>
                      <p className="text-xs text-foreground/80 mb-1">{b.issue}</p>
                      <p className="text-[11px] text-primary">
                        <RefreshCw className="w-3 h-3 inline mr-1 -mt-0.5" />
                        {b.suggestion} ({b.improvementEstimate})
                      </p>
                      <InlineReply context={`${b.compound}: ${b.issue}`} onSend={handleInlineReply} />
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleSection>
        );
      case 'protocols':
        if (analysis.protocolGrades.length === 0) return null;
        return (
          <CollapsibleSection
            key={sectionId}
            icon={<BarChart3 className="w-4 h-4" />}
            title="Protocol Efficiency Grades"
            count={analysis.protocolGrades.length}
            countLabel={sectionData.label}
            score={sectionData.score}
          >
            <div className="space-y-2.5">
              {analysis.protocolGrades.map((p, i) => (
                <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/30 select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
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
                  <InlineReply context={`${p.protocolName} protocol graded ${p.grade}`} onSend={handleInlineReply} />
                </div>
              ))}
            </div>
          </CollapsibleSection>
        );
      case 'cost':
        return (
          <CollapsibleSection
            key={sectionId}
            icon={<DollarSign className="w-4 h-4" />}
            title="Cost-Efficiency Analysis"
            count={analysis.costEfficiency.length}
            countLabel={sectionData.label}
            score={sectionData.score}
          >
            <div className="space-y-2">
              {analysis.costEfficiency.map((c, i) => {
                const key = `cost-${i}`;
                if (isDismissed(key)) return null;
                return (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-secondary/20 select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                    <span className={`text-[10px] font-mono font-bold mt-0.5 ${verdictColor(c.verdict)}`}>
                      {c.verdict.toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{c.compound}</span>
                        <DismissButton onDismiss={() => dismiss(key)} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{c.reasoning}</p>
                      {c.alternative && c.alternative !== 'N/A' && (
                        <p className="text-[11px] text-primary mt-0.5">→ {c.alternative}</p>
                      )}
                      <InlineReply context={`${c.compound} cost: ${c.reasoning}`} onSend={handleInlineReply} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        );
      case 'recommendations':
        return (
          <CollapsibleSection
            key={sectionId}
            icon={<Lightbulb className="w-4 h-4" />}
            title="Top Recommendations"
            count={analysis.topRecommendations.length}
            countLabel={sectionData.label}
            score={sectionData.score}
          >
            <div className="space-y-2">
              {analysis.topRecommendations.map((r, i) => {
                const key = `rec-${i}`;
                if (isDismissed(key)) return null;
                return (
                  <div key={i} className="select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                    <div className="flex gap-2.5 items-start">
                      <span className="text-primary text-xs mt-0.5 font-bold">{i + 1}.</span>
                      <p className="text-xs text-foreground/85 leading-relaxed flex-1">{r}</p>
                      <DismissButton onDismiss={() => dismiss(key)} />
                    </div>
                    <div className="pl-5">
                      <InlineReply context={r} onSend={handleInlineReply} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Interactive Chat - always at top */}
      <ProtocolChat
        messages={chatMessages}
        isStreaming={isChatStreaming}
        onSend={onChatSend}
        onCancel={onChatCancel}
        onClear={onChatClear}
        onApplyChange={onApplyChange}
        onRejectChange={onRejectChange}
        onApplyAll={onApplyAll}
        onUndoChange={onUndoChange}
        onConfirmChange={onConfirmChange}
        onCancelConfirm={onCancelConfirm}
        pendingConfirm={pendingConfirm}
        proposals={proposals}
        compounds={compounds}
        conversationManager={conversationManager}
        pendingMessage={pendingChatMessage}
        onPendingMessageClear={() => setPendingChatMessage(null)}
      />

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

      {/* Tolerance selector — same as Compounds tab */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Dosing Tolerance Level</p>
        <ToleranceSelector
          value={toleranceLevel}
          onChange={onToleranceChange}
        />
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
          <div className="bg-card rounded-lg border border-border/50 p-4 select-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
            <div className="flex items-center gap-4">
              <div className={`text-4xl font-black font-mono ${gradeColor(analysis.overallGrade)}`}>
                {analysis.overallGrade}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-foreground">Overall Stack Grade</p>
                  <ToleranceBadge level={toleranceLevel} />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{analysis.overallSummary}</p>
              </div>
            </div>
          </div>

          {/* Tolerance Comparison */}
          <ToleranceComparisonCard
            comparison={toleranceComparison}
            loading={compareLoading}
            onCompare={onCompareAllLevels}
            currentLevel={toleranceLevel}
          />

          {/* Sections ranked by discrepancy score */}
          {sectionScores.map(s => renderSection(s.id))}

          {/* Dismissed count */}
          {dismissedFindings.size > 0 && (
            <button
              onClick={() => setDismissedFindings(new Set())}
              className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground py-2 transition-colors"
            >
              {dismissedFindings.size} finding{dismissedFindings.size !== 1 ? 's' : ''} dismissed — tap to restore
            </button>
          )}
        </>
      ) : (
        <div className="bg-card rounded-lg border border-border/50 p-6 text-center">
          <Brain className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Tap "Re-analyze" to run AI analysis on your stack.</p>
        </div>
      )}

      <GeminiBadge />
      <MedicalDisclaimer />
    </div>
  );
};

export default AIInsightsView;
