import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Send, Target, Sparkles, CheckCircle, ChevronDown, ChevronUp, ArrowUpRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Compound } from '@/data/compounds';
import { UserProtocol, UserGoalSummary } from '@/hooks/useProtocols';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GoalUpdate {
  action: 'create' | 'update';
  goal_id?: string;
  goal_type: string;
  title: string;
  description?: string;
  body_area?: string;
  target_value?: number;
  target_unit?: string;
  priority: number;
}

interface ProtocolSuggestion {
  type: 'add_compound' | 'adjust_dose' | 'adjust_timing' | 'new_protocol';
  protocol_name?: string;
  compound_name?: string;
  suggestion: string;
  reasoning: string;
}

interface AIProposal {
  goal_updates: GoalUpdate[];
  protocol_suggestions: ProtocolSuggestion[];
}

interface GoalExpansionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: UserGoalSummary[];
  protocols: UserProtocol[];
  compounds: Compound[];
  onCreateGoal?: (goal: Omit<GoalUpdate, 'action'>) => Promise<void>;
}

const GoalExpansionDialog = ({ open, onOpenChange, goals, protocols, compounds, onCreateGoal }: GoalExpansionDialogProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [proposal, setProposal] = useState<AIProposal | null>(null);
  const [showProposal, setShowProposal] = useState(true);
  const [appliedGoals, setAppliedGoals] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (open && !startedRef.current && messages.length === 0) {
      startedRef.current = true;
      const intro = goals.length > 0
        ? `I have ${goals.length} active goal${goals.length > 1 ? 's' : ''} and ${compounds.length} compounds. Help me refine my goals and identify improvements to my protocol.`
        : `I'm running ${compounds.length} compounds across ${protocols.length} protocol${protocols.length !== 1 ? 's' : ''}. Help me define measurable goals and optimize my stack.`;
      const userMsg: ChatMessage = { role: 'user', content: intro };
      setMessages([userMsg]);
      sendToAI([userMsg]);
    }
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      setMessages([]);
      setProposal(null);
      setAppliedGoals(new Set());
      setInput('');
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, proposal]);

  const sendToAI = useCallback(async (msgHistory: ChatMessage[]) => {
    setIsStreaming(true);
    let assistantContent = '';
    let toolCallArgs = '';
    let inToolCall = false;

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/goal-expand`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: msgHistory,
          context: { goals, protocols, compounds: compounds.map(c => ({ name: c.name, category: c.category, dosePerUse: c.dosePerUse, doseLabel: c.doseLabel, daysPerWeek: c.daysPerWeek, timingNote: c.timingNote })) },
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed (${resp.status})`);
      }
      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;

          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta;

            if (delta?.tool_calls) {
              inToolCall = true;
              const tc = delta.tool_calls[0];
              if (tc?.function?.arguments) toolCallArgs += tc.function.arguments;
              continue;
            }

            const content = delta?.content;
            if (content && !inToolCall) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch { /* partial json */ }
        }
      }

      if (inToolCall && toolCallArgs) {
        try {
          const parsed = JSON.parse(toolCallArgs);
          setProposal(parsed);
          setShowProposal(true);
          if (!assistantContent) {
            setMessages(prev => [...prev, { role: 'assistant', content: "I've put together some specific suggestions based on our conversation. Review them below! 👇" }]);
          }
        } catch (e) {
          console.error('Failed to parse tool call:', e);
        }
      }
    } catch (e: any) {
      console.error('Goal expand error:', e);
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${e.message}. Please try again.` }]);
    } finally {
      setIsStreaming(false);
    }
  }, [goals, protocols, compounds]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setProposal(null);
    sendToAI(newHistory);
  };

  const handleApplyGoal = async (goalUpdate: GoalUpdate, index: number) => {
    if (!onCreateGoal || appliedGoals.has(index)) return;
    await onCreateGoal(goalUpdate);
    setAppliedGoals(prev => new Set(prev).add(index));
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'add_compound': return 'Add Compound';
      case 'adjust_dose': return 'Adjust Dose';
      case 'adjust_timing': return 'Adjust Timing';
      case 'new_protocol': return 'New Protocol';
      default: return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            Goal Expansion & Protocol Optimizer
          </DialogTitle>
        </DialogHeader>

        {/* Chat messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 space-y-3 min-h-0 scrollbar-thin">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border/50 text-foreground'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-card border border-border/50 rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            </div>
          )}

          {/* AI Proposal Card */}
          {proposal && (
            <div className="border border-primary/30 rounded-lg bg-primary/5 overflow-hidden mb-2">
              <button
                onClick={() => setShowProposal(!showProposal)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-primary"
              >
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  AI Suggestions ({(proposal.goal_updates?.length || 0) + (proposal.protocol_suggestions?.length || 0)})
                </span>
                {showProposal ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showProposal && (
                <div className="px-3 pb-3 space-y-3">
                  {/* Goal updates */}
                  {proposal.goal_updates?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        <Target className="w-3 h-3 inline mr-1" />Goal Suggestions
                      </p>
                      <div className="space-y-1.5">
                        {proposal.goal_updates.map((g, i) => (
                          <div key={i} className="flex items-center justify-between bg-card/60 rounded-lg px-2.5 py-2 border border-border/30">
                            <div className="min-w-0 flex-1 mr-2">
                              <span className="text-xs font-medium text-foreground block">{g.title}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {g.goal_type.replace(/_/g, ' ')}
                                {g.target_value && g.target_unit ? ` · ${g.target_value} ${g.target_unit}` : ''}
                              </span>
                              {g.description && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{g.description}</p>}
                            </div>
                            {onCreateGoal && g.action === 'create' && (
                              <button
                                onClick={() => handleApplyGoal(g, i)}
                                disabled={appliedGoals.has(i)}
                                className={`text-[10px] font-medium px-2 py-1 rounded transition-all flex-shrink-0 ${
                                  appliedGoals.has(i)
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-primary/15 text-primary hover:bg-primary/25'
                                }`}
                              >
                                {appliedGoals.has(i) ? '✓ Added' : '+ Add'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Protocol suggestions */}
                  {proposal.protocol_suggestions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        <ArrowUpRight className="w-3 h-3 inline mr-1" />Protocol Improvements
                      </p>
                      <div className="space-y-1.5">
                        {proposal.protocol_suggestions.map((s, i) => (
                          <div key={i} className="bg-card/60 rounded-lg px-2.5 py-2 border border-border/30">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] font-medium text-primary">{typeLabel(s.type)}</span>
                              {s.protocol_name && <span className="text-[10px] text-muted-foreground">· {s.protocol_name}</span>}
                            </div>
                            <p className="text-xs text-foreground">{s.suggestion}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{s.reasoning}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {/* bottom spacer */}
          <div className="h-2" />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask about your goals or request suggestions..."
              disabled={isStreaming}
              className="flex-1 px-3 py-2 rounded-lg border border-border/50 bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isStreaming || !input.trim()}
              className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GoalExpansionDialog;
