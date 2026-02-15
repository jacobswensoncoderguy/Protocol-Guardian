import { useState, useRef, useEffect } from 'react';
import { Loader2, Send, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { OnboardingResponse } from './GoalInterview';

interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GoalAIChatProps {
  structuredResponses: OnboardingResponse;
  onGoalsExtracted: (goals: ExtractedGoal[]) => void;
  onSkip: () => void;
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

const GoalAIChat = ({ structuredResponses, onGoalsExtracted, onSkip }: GoalAIChatProps) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [extractedGoals, setExtractedGoals] = useState<ExtractedGoal[] | null>(null);
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
        body: JSON.stringify({ messages: msgHistory, structuredResponses }),
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

            // Check for tool calls
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

      // Process tool call results
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

      // If no content was streamed but we got tool calls, add a summary message
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

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-3">
        <h2 className="text-lg font-bold text-foreground">Refine Your Goals</h2>
        <p className="text-xs text-muted-foreground">Chat with AI to turn your answers into specific, measurable targets</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3 max-h-[45vh] scrollbar-thin">
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
      </div>

      {/* Extracted goals preview */}
      {extractedGoals && (
        <div className="border border-primary/30 rounded-lg p-3 mb-3 bg-primary/5">
          <h3 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" /> AI-Generated Goals
          </h3>
          <div className="space-y-1.5">
            {extractedGoals.map((g, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-card/50 rounded px-2.5 py-1.5">
                <span className="text-foreground font-medium">{g.title}</span>
                {g.target_value && g.target_unit && (
                  <span className="text-primary font-mono">{g.target_value} {g.target_unit}</span>
                )}
              </div>
            ))}
          </div>
          <button onClick={() => onGoalsExtracted(extractedGoals)}
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

      <button onClick={onSkip} className="text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors">
        Skip — I'll set goals later
      </button>
    </div>
  );
};

export default GoalAIChat;
