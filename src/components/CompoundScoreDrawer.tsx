import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import ChatMarkdown from '@/components/ChatMarkdown';
import { Beaker, FlaskConical, Target, MessageCircle, Send, Loader2, TrendingUp, AlertTriangle, Info, Sparkles, ArrowRight, User, TestTube2, Pill, Layers } from 'lucide-react';
import { CompoundScores } from '@/data/compoundScores';
import { supabase } from '@/integrations/supabase/client';

interface PersonalizedScores {
  bioavailability: number;
  efficacy: number;
  effectiveness: number;
  evidenceTier: string;
  dosageAssessment: string;
  dosageNote: string;
  bioNote: string;
  effNote: string;
  ovrNote: string;
  interactions: string;
}

interface PersonalizedContext {
  hasProfile: boolean;
  hasLabs: boolean;
  labCount: number;
  stackSize: number;
  deliveryMethod: string;
}

interface CompoundScoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compoundName: string;
  scores: CompoundScores;
  deliveryMethod?: string;
  category?: string;
  dosePerUse?: number;
  dosesPerDay?: number;
  daysPerWeek?: number;
  unitLabel?: string;
  doseLabel?: string;
}

const SCORE_KEYS = ['bioavailability', 'efficacy', 'effectiveness'] as const;

const SCORE_META: {
  key: typeof SCORE_KEYS[number];
  label: string;
  short: string;
  icon: typeof Beaker;
  noteKey: 'bioNote' | 'effNote' | 'ovrNote';
}[] = [
  { key: 'bioavailability', label: 'Bioavailability', short: 'Bio', icon: Beaker, noteKey: 'bioNote' },
  { key: 'efficacy', label: 'Efficacy', short: 'Eff', icon: FlaskConical, noteKey: 'effNote' },
  { key: 'effectiveness', label: 'Effectiveness', short: 'Ovr', icon: Target, noteKey: 'ovrNote' },
];

const TIER_EXPLANATIONS: Record<string, { label: string; color: string }> = {
  RCT: { label: 'Randomized Controlled Trial', color: 'text-status-good' },
  Meta: { label: 'Meta-Analysis', color: 'text-status-good' },
  Clinical: { label: 'Clinical Observation', color: 'text-primary' },
  Anecdotal: { label: 'Anecdotal Evidence', color: 'text-status-warning' },
  Theoretical: { label: 'Theoretical / Preclinical', color: 'text-muted-foreground' },
  Mixed: { label: 'Mixed Evidence', color: 'text-primary' },
};

const scoreColor = (v: number) =>
  v >= 80 ? 'text-status-good' : v >= 60 ? 'text-primary' : v >= 40 ? 'text-status-warning' : 'text-status-critical';

const scoreBg = (v: number) =>
  v >= 80 ? 'bg-status-good/10 border-status-good/20' : v >= 60 ? 'bg-primary/10 border-primary/20' : v >= 40 ? 'bg-status-warning/10 border-status-warning/20' : 'bg-destructive/10 border-destructive/20';

const dosageColor = (assessment: string) => {
  if (assessment === 'optimal') return 'text-status-good';
  if (assessment === 'subtherapeutic') return 'text-status-warning';
  if (assessment === 'supratherapeutic') return 'text-status-critical';
  return 'text-muted-foreground';
};

const dosageBg = (assessment: string) => {
  if (assessment === 'optimal') return 'bg-status-good/10 border-status-good/20';
  if (assessment === 'subtherapeutic') return 'bg-status-warning/10 border-status-warning/20';
  if (assessment === 'supratherapeutic') return 'bg-destructive/10 border-destructive/20';
  return 'bg-secondary/30 border-border/40';
};

const CompoundScoreDrawer = ({ open, onOpenChange, compoundName, scores, deliveryMethod, category, dosePerUse, dosesPerDay, daysPerWeek, unitLabel, doseLabel }: CompoundScoreDrawerProps) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const [personalized, setPersonalized] = useState<PersonalizedScores | null>(null);
  const [pContext, setPContext] = useState<PersonalizedContext | null>(null);
  const [pLoading, setPLoading] = useState(false);
  const [pError, setPError] = useState<string | null>(null);

  // Fetch personalized scores when drawer opens
  useEffect(() => {
    if (!open) return;
    // Reset on each open
    setPersonalized(null);
    setPContext(null);
    setPError(null);
    setPLoading(true);

    const fetchPersonalized = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('personalized-scores', {
          body: {
            compoundName,
            category,
            dosePerUse: dosePerUse || 0,
            dosesPerDay: dosesPerDay || 1,
            daysPerWeek: daysPerWeek || 7,
            unitLabel: unitLabel || '',
            doseLabel: doseLabel || '',
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setPersonalized(data.personalized);
        setPContext(data.context);
      } catch (err: any) {
        console.error('Personalized scores error:', err);
        setPError(err.message || 'Failed to compute personalized scores');
      } finally {
        setPLoading(false);
      }
    };

    fetchPersonalized();
  }, [open, compoundName]);

  const activeScores = personalized ? {
    bioavailability: personalized.bioavailability,
    efficacy: personalized.efficacy,
    effectiveness: personalized.effectiveness,
  } : scores;

  const hasLowScore = activeScores.bioavailability < 60 || activeScores.efficacy < 60 || activeScores.effectiveness < 60;
  const lowestScore = SCORE_META.reduce((min, s) => (activeScores[s.key] ?? 100) < (activeScores[min.key] ?? 100) ? s : min, SCORE_META[0]);

  const startChat = (prompt?: string) => {
    setChatOpen(true);
    if (prompt) sendMessage(prompt);
  };

  const sendMessage = async (text: string) => {
    const userMsg = { role: 'user' as const, content: text };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const pScores = personalized;
      const systemPrompt = `You are a compound optimization advisor for "${compoundName}".
Current delivery method: ${deliveryMethod || 'Unknown'} (category: ${category || 'Unknown'}).
${pScores ? `PERSONALIZED scores (based on user's biology, dosage, labs, and stack):
Bioavailability ${pScores.bioavailability}%, Efficacy ${pScores.efficacy}%, Effectiveness ${pScores.effectiveness}%.
Evidence tier: ${pScores.evidenceTier}.
Dosage assessment: ${pScores.dosageAssessment} — ${pScores.dosageNote}
Stack interactions: ${pScores.interactions}` :
`Static baseline scores: Bioavailability ${scores.bioavailability}%, Efficacy ${scores.efficacy}%, Effectiveness ${scores.effectiveness}%.
Evidence tier: ${scores.evidenceTier}.`}

CRITICAL: The bioavailability score ALREADY reflects the user's current delivery method (${deliveryMethod}). Do NOT suggest switching to a method they are already using.

Provide concise, actionable advice. Keep responses under 200 words. Use bullet points. Be specific.`;

      const { data, error } = await supabase.functions.invoke('compound-score-chat', {
        body: {
          messages: [
            { role: 'system', content: systemPrompt },
            ...updatedMessages,
          ],
        },
      });

      if (error) throw error;
      const reply = data?.reply || 'Unable to get a response.';
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      console.error('Score chat error:', err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error connecting to advisor. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const evidenceTier = personalized?.evidenceTier || scores.evidenceTier;
  const tier = TIER_EXPLANATIONS[evidenceTier] || TIER_EXPLANATIONS.Mixed;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-sm font-bold">{compoundName} — Score Breakdown</SheetTitle>
          <SheetDescription className="text-[10px] text-muted-foreground">
            {pLoading ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                Computing personalized scores…
              </span>
            ) : personalized ? (
              <span className="inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-primary font-semibold">Personalized</span> for your biology, dosage & labs
              </span>
            ) : (
              <span>Scores adjusted for <span className="text-primary font-semibold">{deliveryMethod || 'default'}</span> delivery</span>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Context indicators */}
        {personalized && pContext && (
          <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
            {pContext.hasProfile && (
              <span className="inline-flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary">
                <User className="w-2.5 h-2.5" /> Biology
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary">
              <Pill className="w-2.5 h-2.5" /> Dosage
            </span>
            {pContext.hasLabs && (
              <span className="inline-flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded-full border border-status-good/20 bg-status-good/5 text-status-good">
                <TestTube2 className="w-2.5 h-2.5" /> {pContext.labCount} biomarkers
              </span>
            )}
            {pContext.stackSize > 0 && (
              <span className="inline-flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary">
                <Layers className="w-2.5 h-2.5" /> {pContext.stackSize} in stack
              </span>
            )}
          </div>
        )}

        {/* Score Cards */}
        <div className="space-y-3 mt-2">
          {SCORE_META.map(({ key, label, icon: Icon, noteKey }) => {
            const baseValue = scores[key];
            const personalValue = personalized?.[key];
            const displayValue = personalValue ?? baseValue;
            const delta = personalValue != null ? personalValue - baseValue : null;
            const note = personalized?.[noteKey];

            return (
              <div key={key} className={`rounded-lg border p-3 ${scoreBg(displayValue)}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${scoreColor(displayValue)}`} />
                    <span className="text-xs font-semibold text-foreground">{label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {delta !== null && delta !== 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-mono">
                        <span className="text-muted-foreground line-through">{baseValue}%</span>
                        <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                      </span>
                    )}
                    <span className={`text-lg font-bold font-mono ${scoreColor(displayValue)}`}>
                      {pLoading ? '—' : `${displayValue}%`}
                    </span>
                  </div>
                </div>
                {pLoading ? (
                  <div className="h-3 w-3/4 bg-secondary/40 rounded animate-pulse" />
                ) : note ? (
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{note}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Dosage Assessment */}
        {personalized && (
          <div className={`mt-3 rounded-lg border p-3 ${dosageBg(personalized.dosageAssessment)}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Pill className="w-3 h-3" />
              <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Dosage Assessment</span>
            </div>
            <span className={`text-sm font-bold font-mono capitalize ${dosageColor(personalized.dosageAssessment)}`}>
              {personalized.dosageAssessment}
            </span>
            <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{personalized.dosageNote}</p>
          </div>
        )}

        {/* Stack Interactions */}
        {personalized?.interactions && (
          <div className="mt-3 rounded-lg border border-border/40 bg-secondary/20 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Layers className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Stack Interactions</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{personalized.interactions}</p>
          </div>
        )}

        {/* Evidence Tier */}
        <div className="mt-3 rounded-lg border border-border/40 bg-secondary/20 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Info className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Evidence Tier</span>
          </div>
          <span className={`text-sm font-bold font-mono ${tier.color}`}>{tier.label}</span>
        </div>

        {/* Error state */}
        {pError && !pLoading && (
          <div className="mt-3 rounded-lg border border-status-warning/30 bg-status-warning/5 p-3">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-status-warning" />
              <span className="text-[10px] text-status-warning">Showing static baselines — {pError}</span>
            </div>
          </div>
        )}

        {/* AI Chat Section */}
        {!chatOpen ? (
          <div className="mt-4 space-y-2">
            {hasLowScore && !pLoading && (
              <button
                onClick={() => startChat(`How can I improve the ${lowestScore.label.toLowerCase()} score (${activeScores[lowestScore.key]}%) for ${compoundName}? Give me specific, actionable steps considering my current protocol and biology.`)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-status-warning/30 bg-status-warning/5 hover:bg-status-warning/10 transition-colors text-status-warning text-xs font-medium"
              >
                <TrendingUp className="w-4 h-4" />
                Improve {lowestScore.label} ({activeScores[lowestScore.key]}%)
              </button>
            )}
            {!pLoading && (
              <button
                onClick={() => startChat(`Analyze the overall score profile for ${compoundName} (Bio: ${activeScores.bioavailability}%, Eff: ${activeScores.efficacy}%, Ovr: ${activeScores.effectiveness}%). ${personalized ? `Dosage is ${personalized.dosageAssessment}. ` : ''}What should I know and what can I optimize?`)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-primary text-xs font-medium"
              >
                <MessageCircle className="w-4 h-4" />
                Discuss scores with AI advisor
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-1.5 mb-2">
              <MessageCircle className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-foreground">Score Advisor</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 rounded-lg border border-border/30 bg-card/40 p-2">
              {chatMessages.length === 0 && !chatLoading && (
                <p className="text-[10px] text-muted-foreground text-center py-3">Ask anything about this compound's scores...</p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`text-[11px] leading-relaxed p-2 rounded-md ${
                  msg.role === 'user' ? 'bg-primary/10 text-foreground ml-4' : 'bg-secondary/50 text-foreground mr-4'
                }`}>
                  {msg.role === 'assistant' ? <ChatMarkdown content={msg.content} /> : msg.content}
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-1.5 p-2">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span className="text-[10px] text-muted-foreground">Analyzing...</span>
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && chatInput.trim() && sendMessage(chatInput.trim())}
                placeholder="Ask about improving scores..."
                className="flex-1 text-xs px-2.5 py-2 rounded-md border border-border/40 bg-secondary/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={() => chatInput.trim() && sendMessage(chatInput.trim())}
                disabled={!chatInput.trim() || chatLoading}
                className="px-2.5 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CompoundScoreDrawer;
