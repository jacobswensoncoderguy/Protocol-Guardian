import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import ChatMarkdown from '@/components/ChatMarkdown';
import { Beaker, FlaskConical, Target, MessageCircle, Send, Loader2, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import { CompoundScores } from '@/data/compoundScores';
import { supabase } from '@/integrations/supabase/client';

interface CompoundScoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compoundName: string;
  scores: CompoundScores;
  deliveryMethod?: string;
  category?: string;
}

const SCORE_META: {
  key: keyof Pick<CompoundScores, 'bioavailability' | 'efficacy' | 'effectiveness'>;
  label: string;
  short: string;
  icon: typeof Beaker;
  description: string;
  lowTip: string;
}[] = [
  {
    key: 'bioavailability',
    label: 'Bioavailability',
    short: 'Bio',
    icon: Beaker,
    description: 'How well the compound is absorbed and utilized by the body given its delivery method (oral, sublingual, injectable, etc.). Higher scores mean more of the compound reaches systemic circulation.',
    lowTip: 'Consider switching delivery methods (e.g., injectable vs oral), taking with fats for lipophilic compounds, or using enhanced-absorption formulations.',
  },
  {
    key: 'efficacy',
    label: 'Efficacy',
    short: 'Eff',
    icon: FlaskConical,
    description: 'The likelihood this compound achieves statistically significant benefits based on published research. Reflects the strength and consistency of clinical evidence.',
    lowTip: 'Low efficacy may indicate limited or mixed research. Consider compounds with stronger RCT backing, or stack with synergistic agents to amplify effect.',
  },
  {
    key: 'effectiveness',
    label: 'Effectiveness',
    short: 'Ovr',
    icon: Target,
    description: 'A real-world outcome score combining bioavailability, efficacy, and practical factors like compliance ease, cost-effectiveness, and side-effect profile.',
    lowTip: 'Improve by optimizing timing, ensuring consistent compliance, addressing absorption barriers, or considering better-tolerated alternatives.',
  },
];

const TIER_EXPLANATIONS: Record<string, { label: string; description: string; color: string }> = {
  RCT: {
    label: 'Randomized Controlled Trial',
    description: 'Gold-standard evidence from double-blind, placebo-controlled human trials. Highest confidence.',
    color: 'text-status-good',
  },
  Meta: {
    label: 'Meta-Analysis',
    description: 'Systematic review aggregating multiple studies. Very strong evidence combining data across populations.',
    color: 'text-status-good',
  },
  Clinical: {
    label: 'Clinical Observation',
    description: 'Based on clinical practice, case series, or open-label studies. Moderate confidence with real-world backing.',
    color: 'text-primary',
  },
  Anecdotal: {
    label: 'Anecdotal Evidence',
    description: 'Primarily from user reports, forums, and practitioner experience. Limited formal research. Use with caution.',
    color: 'text-status-warning',
  },
  Theoretical: {
    label: 'Theoretical / Preclinical',
    description: 'Based on mechanism of action, in-vitro, or animal studies. Human evidence is scarce or absent.',
    color: 'text-muted-foreground',
  },
  Mixed: {
    label: 'Mixed Evidence',
    description: 'Studies show conflicting results. Some positive, some neutral or negative. Context-dependent effectiveness.',
    color: 'text-primary',
  },
};

const scoreColor = (v: number) =>
  v >= 80 ? 'text-status-good' : v >= 60 ? 'text-primary' : v >= 40 ? 'text-status-warning' : 'text-status-critical';

const scoreBg = (v: number) =>
  v >= 80 ? 'bg-status-good/10 border-status-good/20' : v >= 60 ? 'bg-primary/10 border-primary/20' : v >= 40 ? 'bg-status-warning/10 border-status-warning/20' : 'bg-destructive/10 border-destructive/20';

const CompoundScoreDrawer = ({ open, onOpenChange, compoundName, scores, deliveryMethod, category }: CompoundScoreDrawerProps) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const hasLowScore = scores.bioavailability < 60 || scores.efficacy < 60 || scores.effectiveness < 60;
  const lowestScore = SCORE_META.reduce((min, s) => scores[s.key] < scores[min.key] ? s : min, SCORE_META[0]);

  const startChat = (prompt?: string) => {
    setChatOpen(true);
    if (prompt) {
      sendMessage(prompt);
    }
  };

  const sendMessage = async (text: string) => {
    const userMsg = { role: 'user' as const, content: text };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const systemPrompt = `You are a compound optimization advisor for "${compoundName}".
Current delivery method: ${deliveryMethod || 'Unknown'} (category: ${category || 'Unknown'}).
Current scores (ALREADY ADJUSTED for ${deliveryMethod || 'current'} delivery): Bioavailability ${scores.bioavailability}%, Efficacy ${scores.efficacy}%, Effectiveness ${scores.effectiveness}%.
Evidence tier: ${scores.evidenceTier}.

CRITICAL: The bioavailability score ALREADY reflects the user's current delivery method (${deliveryMethod}). Do NOT suggest switching to the delivery method they are already using. If they are injecting, the score already accounts for injectable bioavailability. Only suggest delivery method changes if switching to a DIFFERENT method would improve scores.

Provide concise, actionable advice to improve these scores. Focus on:
- Timing optimization (fasted vs fed, time of day, proximity to other compounds)
- Synergistic stacking (compounds that enhance absorption or effect)
- Dosing protocol adjustments (frequency, splitting doses)
- Formulation quality (liposomal, micronized, pharmaceutical grade)

Keep responses under 200 words. Use bullet points. Be specific to this compound.`;

      const { data, error } = await supabase.functions.invoke('compound-score-chat', {
        body: {
          messages: [
            { role: 'system', content: systemPrompt },
            ...updatedMessages,
          ],
        },
      });

      if (error) throw error;
      const reply = data?.reply || data?.choices?.[0]?.message?.content || 'Unable to get a response.';
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      console.error('Score chat error:', err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error connecting to advisor. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const tier = TIER_EXPLANATIONS[scores.evidenceTier] || TIER_EXPLANATIONS.Mixed;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-sm font-bold">{compoundName} — Score Breakdown</SheetTitle>
          <SheetDescription className="text-[10px] text-muted-foreground">
            Scores adjusted for <span className="text-primary font-semibold">{deliveryMethod || 'default'}</span> delivery
          </SheetDescription>
        </SheetHeader>

        {/* Score Cards */}
        <div className="space-y-3 mt-2">
          {SCORE_META.map(({ key, label, short, icon: Icon, description, lowTip }) => {
            const value = scores[key];
            const isLow = value < 60;
            return (
              <div key={key} className={`rounded-lg border p-3 ${scoreBg(value)}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${scoreColor(value)}`} />
                    <span className="text-xs font-semibold text-foreground">{label}</span>
                  </div>
                  <span className={`text-lg font-bold font-mono ${scoreColor(value)}`}>{value}%</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed mb-1.5">{description}</p>
                {isLow && (
                  <div className="flex items-start gap-1.5 p-2 rounded-md bg-card/60 border border-border/30">
                    <TrendingUp className="w-3 h-3 text-status-warning flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] font-semibold text-status-warning uppercase tracking-wider mb-0.5">How to improve</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{lowTip}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Evidence Tier */}
        <div className="mt-3 rounded-lg border border-border/40 bg-secondary/20 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Info className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Evidence Tier</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-bold font-mono ${tier.color}`}>{tier.label}</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">{tier.description}</p>
        </div>

        {/* AI Chat Section */}
        {!chatOpen ? (
          <div className="mt-4 space-y-2">
            {hasLowScore && (
              <button
                onClick={() => startChat(`How can I improve the ${lowestScore.label.toLowerCase()} score (${scores[lowestScore.key]}%) for ${compoundName}? Give me specific, actionable steps.`)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-status-warning/30 bg-status-warning/5 hover:bg-status-warning/10 transition-colors text-status-warning text-xs font-medium"
              >
                <TrendingUp className="w-4 h-4" />
                Improve {lowestScore.label} ({scores[lowestScore.key]}%)
              </button>
            )}
            <button
              onClick={() => startChat(`Analyze the overall score profile for ${compoundName} (Bio: ${scores.bioavailability}%, Eff: ${scores.efficacy}%, Ovr: ${scores.effectiveness}%, ${scores.evidenceTier}). What should I know and what can I optimize?`)}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-primary text-xs font-medium"
            >
              <MessageCircle className="w-4 h-4" />
              Discuss scores with AI advisor
            </button>
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
