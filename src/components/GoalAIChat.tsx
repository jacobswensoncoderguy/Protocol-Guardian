import { useState, useRef, useEffect } from 'react';
import { Loader2, Send, CheckCircle, Copy, Check, ThumbsUp, HelpCircle, X as XIcon, ChevronUp, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import GeminiBadge from '@/components/GeminiBadge';
import { OnboardingResponse } from './GoalInterview';
import { toast } from 'sonner';

interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GoalAIChatProps {
  structuredResponses: OnboardingResponse;
  onGoalsExtracted: (goals: ExtractedGoal[]) => void;
  onSkip: () => void;
  gender?: string | null;
}

export interface ExtractedGoal {
  goal_type: string;
  title: string;
  description?: string;
  body_area?: string;
  target_value?: number;
  target_unit?: string;
  priority: number;
}

type InterestLevel = 'interested' | 'need_info' | 'not_interested';

interface GoalInterest {
  goalIndex: number;
  interest: InterestLevel;
  priority: number; // 1-5
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-secondary/50 text-muted-foreground/50 hover:text-muted-foreground transition-colors" title="Copy message">
      {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
    </button>
  );
};

const InterestToggle = ({ value, onChange }: { value?: InterestLevel; onChange: (v: InterestLevel) => void }) => {
  const options: { id: InterestLevel; label: string; icon: typeof ThumbsUp }[] = [
    { id: 'interested', label: 'Interested', icon: ThumbsUp },
    { id: 'need_info', label: 'Need more info', icon: HelpCircle },
    { id: 'not_interested', label: 'Not for me', icon: XIcon },
  ];
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(o => {
        const Icon = o.icon;
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${
              active
                ? o.id === 'interested' ? 'bg-primary/15 border-primary/40 text-primary'
                : o.id === 'need_info' ? 'bg-amber-500/15 border-amber-500/40 text-amber-600'
                : 'bg-destructive/10 border-destructive/30 text-destructive'
                : 'bg-card border-border/50 text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            <Icon className="w-3 h-3" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

const PrioritySelector = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex items-center gap-1">
    <span className="text-[9px] text-muted-foreground mr-1">Priority:</span>
    <button onClick={() => onChange(Math.max(1, value - 1))} className="p-0.5 rounded hover:bg-secondary text-muted-foreground"><ChevronDown className="w-3 h-3" /></button>
    <span className="text-[10px] font-mono font-bold text-primary w-3 text-center">{value}</span>
    <button onClick={() => onChange(Math.min(5, value + 1))} className="p-0.5 rounded hover:bg-secondary text-muted-foreground"><ChevronUp className="w-3 h-3" /></button>
  </div>
);

const GoalAIChat = ({ structuredResponses, onGoalsExtracted, onSkip, gender }: GoalAIChatProps) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [extractedGoals, setExtractedGoals] = useState<ExtractedGoal[] | null>(null);
  const [goalInterests, setGoalInterests] = useState<Map<number, GoalInterest>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      sendToAI([{ role: 'user', content: 'Hi! I just filled out my goals questionnaire. Can you help me refine them into specific, measurable targets?' }]);
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendToAI = async (msgHistory: AIChatMessage[]) => {
    setIsStreaming(true);
    let assistantContent = '';

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/goal-interview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: msgHistory, structuredResponses, gender }),
      });

      if (!resp.ok || !resp.body) throw new Error('Stream failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let toolCallArgs = '';
      let inToolCall = false;

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
              if (tc?.function?.arguments) {
                toolCallArgs += tc.function.arguments;
              }
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
          } catch { /* partial */ }
        }
      }

      if (inToolCall && toolCallArgs) {
        try {
          const parsed = JSON.parse(toolCallArgs);
          if (parsed.goals) {
            setExtractedGoals(parsed.goals);
          }
        } catch (e) {
          console.error('Failed to parse tool call:', e);
        }
      }

      if (!assistantContent && extractedGoals) {
        setMessages(prev => [...prev, { role: 'assistant', content: "I've defined your goals based on our conversation. Review them below!" }]);
      }
    } catch (e) {
      console.error('AI chat error:', e);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble connecting. You can skip this step and set goals manually later.' }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    const userMsg: AIChatMessage = { role: 'user', content: input.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    sendToAI(newHistory);
  };

  const setInterest = (index: number, interest: InterestLevel) => {
    setGoalInterests(prev => {
      const next = new Map(prev);
      const existing = next.get(index);
      next.set(index, { goalIndex: index, interest, priority: existing?.priority ?? 3 });
      return next;
    });
  };

  const setPriority = (index: number, priority: number) => {
    setGoalInterests(prev => {
      const next = new Map(prev);
      const existing = next.get(index);
      next.set(index, { goalIndex: index, interest: existing?.interest ?? 'interested', priority });
      return next;
    });
  };

  const handleAcceptGoals = () => {
    if (!extractedGoals) return;
    const refined = extractedGoals
      .map((g, i) => {
        const interest = goalInterests.get(i);
        if (interest?.interest === 'not_interested') return null;
        return { ...g, priority: interest?.priority ?? g.priority };
      })
      .filter(Boolean) as ExtractedGoal[];
    onGoalsExtracted(refined);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-3">
        <h2 className="text-lg font-bold text-foreground">Refine Your Goals</h2>
        <p className="text-xs text-muted-foreground">Chat with AI to turn your answers into specific, measurable targets</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3 max-h-[45vh] scrollbar-thin">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm relative group ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border/50 text-foreground'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : msg.content}
              <div className="absolute -bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyButton text={msg.content} />
              </div>
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
      </div>

      {/* Extracted goals preview with interest toggles */}
      {extractedGoals && (
        <div className="border border-primary/30 rounded-lg p-3 mb-3 bg-primary/5">
          <h3 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" /> AI-Generated Goals
          </h3>
          <div className="space-y-2.5">
            {extractedGoals.map((g, i) => {
              const interest = goalInterests.get(i);
              const isRejected = interest?.interest === 'not_interested';
              return (
                <div key={i} className={`bg-card/50 rounded-lg px-2.5 py-2 space-y-1.5 border transition-all ${isRejected ? 'opacity-40 border-border/30' : 'border-border/50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground font-medium">{g.title}</span>
                    {g.target_value && g.target_unit && (
                      <span className="text-primary font-mono text-[10px]">{g.target_value} {g.target_unit}</span>
                    )}
                  </div>
                  <InterestToggle value={interest?.interest} onChange={(v) => setInterest(i, v)} />
                  {interest?.interest === 'interested' && (
                    <PrioritySelector value={interest.priority} onChange={(v) => setPriority(i, v)} />
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={handleAcceptGoals}
            className="w-full mt-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all">
            Accept Goals & Continue
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Tell the AI more about your goals..."
          disabled={isStreaming}
          className="flex-1 px-3 py-2 rounded-lg border border-border/50 bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 disabled:opacity-50"
        />
        <button onClick={handleSend} disabled={isStreaming || !input.trim()}
          className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 transition-all">
          <Send className="w-4 h-4" />
        </button>
      </div>

      <GeminiBadge />

      <button onClick={onSkip} className="text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors">
        Skip — I'll set goals later
      </button>
    </div>
  );
};

export default GoalAIChat;
