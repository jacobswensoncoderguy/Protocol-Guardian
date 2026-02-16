import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Send, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import GeminiBadge from '@/components/GeminiBadge';
import { UserGoal } from '@/hooks/useGoals';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GoalCardChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: UserGoal;
  onUpdateGoal?: (goalId: string, updates: Partial<UserGoal>) => Promise<void>;
}

const GoalCardChat = ({ open, onOpenChange, goal, onUpdateGoal }: GoalCardChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (open && !startedRef.current && messages.length === 0) {
      startedRef.current = true;
      const intro = `I want to fine-tune my "${goal.title}" goal. Current details: type=${goal.goal_type}, baseline=${goal.baseline_value ?? 'not set'}, target=${goal.target_value ?? 'not set'} ${goal.target_unit ?? ''}, current=${goal.current_value ?? 'not set'}. Help me refine this into a better, more measurable goal.`;
      const userMsg: ChatMessage = { role: 'user', content: intro };
      setMessages([userMsg]);
      sendToAI([userMsg]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      setMessages([]);
      setInput('');
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendToAI = useCallback(async (msgHistory: ChatMessage[]) => {
    setIsStreaming(true);
    let assistantContent = '';
    let toolCallArgs = '';
    let inToolCall = false;

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/goal-refine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: msgHistory, goal }),
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

      // Handle tool call for goal updates
      if (inToolCall && toolCallArgs && onUpdateGoal && goal.id) {
        try {
          const parsed = JSON.parse(toolCallArgs);
          if (parsed.updates) {
            await onUpdateGoal(goal.id, parsed.updates);
            if (!assistantContent) {
              setMessages(prev => [...prev, { role: 'assistant', content: "I've updated your goal with the refined targets! ✅" }]);
            }
          }
        } catch (e) {
          console.error('Failed to parse tool call:', e);
        }
      }
    } catch (e: any) {
      console.error('Goal chat error:', e);
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${e.message}` }]);
    } finally {
      setIsStreaming(false);
    }
  }, [goal, onUpdateGoal]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    sendToAI(newHistory);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            Fine-tune: {goal.title}
          </DialogTitle>
        </DialogHeader>

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
          <div className="h-2" />
        </div>

        <div className="px-4 py-3 border-t border-border/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask about refining this goal..."
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
          <div className="mt-2">
            <GeminiBadge />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GoalCardChat;
