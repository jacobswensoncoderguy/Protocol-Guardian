import { useState, useRef, useEffect } from 'react';
import { Send, Square, Trash2, Check, X, CheckCheck, Brain, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, ChangeProposal, ProposedChange } from '@/hooks/useProtocolChat';

interface ProtocolChatProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (message: string) => void;
  onCancel: () => void;
  onClear: () => void;
  onApplyChange: (proposalId: string, changeIndex: number) => void;
  onRejectChange: (proposalId: string, changeIndex: number) => void;
  onApplyAll: (proposalId: string) => void;
}

const changeTypeLabel = (type: string) => {
  switch (type) {
    case 'adjust_dose': return 'Dose';
    case 'adjust_frequency': return 'Frequency';
    case 'adjust_timing': return 'Timing';
    case 'adjust_cycling': return 'Cycling';
    case 'remove_compound': return 'Remove';
    case 'add_compound': return 'Add';
    default: return type;
  }
};

const changeTypeColor = (type: string) => {
  if (type === 'remove_compound') return 'text-status-critical bg-destructive/10';
  if (type === 'add_compound') return 'text-status-good bg-status-good/10';
  return 'text-primary bg-primary/10';
};

const ProposalCard = ({
  proposal,
  onApply,
  onReject,
  onApplyAll,
}: {
  proposal: ChangeProposal;
  onApply: (index: number) => void;
  onReject: (index: number) => void;
  onApplyAll: () => void;
}) => {
  const hasPending = proposal.changes.some(c => c.status === 'pending');

  return (
    <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">Proposed Changes</span>
        {hasPending && (
          <button
            onClick={onApplyAll}
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
          >
            <CheckCheck className="w-3 h-3" />
            Accept All
          </button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">{proposal.summary}</p>

      <div className="space-y-1.5">
        {proposal.changes.map((change, i) => (
          <ChangeRow
            key={i}
            change={change}
            onApply={() => onApply(i)}
            onReject={() => onReject(i)}
          />
        ))}
      </div>
    </div>
  );
};

const ChangeRow = ({
  change,
  onApply,
  onReject,
}: {
  change: ProposedChange;
  onApply: () => void;
  onReject: () => void;
}) => (
  <div className={`flex items-start gap-2 p-2 rounded-md border transition-all ${
    change.status === 'accepted' ? 'border-status-good/30 bg-status-good/5' :
    change.status === 'rejected' ? 'border-destructive/30 bg-destructive/5 opacity-60' :
    'border-border/50 bg-card'
  }`}>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${changeTypeColor(change.type)}`}>
          {changeTypeLabel(change.type)}
        </span>
        <span className="text-xs font-semibold text-foreground truncate">{change.compoundName}</span>
      </div>
      {change.oldValue && change.newValue && (
        <div className="flex items-center gap-1.5 text-[11px] mb-0.5">
          <span className="text-muted-foreground line-through">{change.oldValue}</span>
          <ArrowRight className="w-3 h-3 text-primary flex-shrink-0" />
          <span className="text-primary font-medium">{change.newValue}</span>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground leading-snug">{change.reasoning}</p>
    </div>

    {change.status === 'pending' ? (
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onApply}
          className="p-1.5 rounded-md bg-status-good/15 text-status-good hover:bg-status-good/25 transition-colors"
          title="Apply this change"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onReject}
          className="p-1.5 rounded-md bg-destructive/15 text-status-critical hover:bg-destructive/25 transition-colors"
          title="Reject this change"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    ) : (
      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0 ${
        change.status === 'accepted' ? 'bg-status-good/15 text-status-good' : 'bg-destructive/15 text-status-critical'
      }`}>
        {change.status}
      </span>
    )}
  </div>
);

const ProtocolChat = ({
  messages,
  isStreaming,
  onSend,
  onCancel,
  onClear,
  onApplyChange,
  onRejectChange,
  onApplyAll,
}: ProtocolChatProps) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  return (
    <div className="bg-card rounded-lg border border-border/50 flex flex-col overflow-hidden" style={{ height: messages.length > 0 ? '420px' : 'auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Protocol Advisor</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={onClear}
            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Clear conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Messages */}
      {messages.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ask questions about your analysis, request alternatives, or ask how to improve your stack grade. 
            When you agree on changes, they'll be applied directly to your protocol.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
            {[
              'How can I improve my grade to B+?',
              'What should I remove to reduce liver stress?',
              'Suggest cheaper alternatives for poor-value compounds',
              'Optimize my GH secretagogue timing',
            ].map(q => (
              <button
                key={q}
                onClick={() => { setInput(q); inputRef.current?.focus(); }}
                className="text-[10px] px-2.5 py-1.5 rounded-lg bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border/30"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] rounded-lg px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-primary/15 text-foreground'
                  : 'bg-secondary/50 text-foreground'
              }`}>
                {msg.content && (
                  <div className="text-xs leading-relaxed prose prose-invert prose-xs max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-semibold [&_strong]:text-foreground [&_a]:text-primary">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
                {msg.proposal && (
                  <ProposalCard
                    proposal={msg.proposal}
                    onApply={(i) => onApplyChange(msg.proposal!.id, i)}
                    onReject={(i) => onRejectChange(msg.proposal!.id, i)}
                    onApplyAll={() => onApplyAll(msg.proposal!.id)}
                  />
                )}
              </div>
            </div>
          ))}
          {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-secondary/50 rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/50 px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your protocol analysis..."
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-[120px] py-1.5"
            rows={1}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button
              onClick={onCancel}
              className="p-2 rounded-lg bg-destructive/15 text-status-critical hover:bg-destructive/25 transition-colors flex-shrink-0"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="p-2 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors flex-shrink-0 disabled:opacity-30"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProtocolChat;
