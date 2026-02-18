import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square, Trash2, Check, X, CheckCheck, Brain, ArrowRight, Mic, MicOff, Maximize2, Minimize2, PanelLeftOpen, PanelLeftClose, Copy, MessageCircle, Sparkles, TrendingUp, Shield, DollarSign, Clock, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import ChatMarkdown from '@/components/ChatMarkdown';
import { ChatMessage, ChangeProposal, ProposedChange, PendingConfirm } from '@/hooks/useProtocolChat';
import { useConversations } from '@/hooks/useConversations';
import ChatSidebar from '@/components/ChatSidebar';
import GeminiBadge from '@/components/GeminiBadge';
import { useIsMobile } from '@/hooks/use-mobile';
import ProtocolChangeConfirmSheet from '@/components/ProtocolChangeConfirmSheet';
import { Compound } from '@/data/compounds';

interface ProtocolChatProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (message: string) => void;
  onCancel: () => void;
  onClear: () => void;
  onApplyChange: (proposalId: string, changeIndex: number) => void;
  onRejectChange: (proposalId: string, changeIndex: number) => void;
  onApplyAll: (proposalId: string) => void;
  onUndoChange?: (proposalId: string, changeIndex: number) => void;
  onConfirmChange?: () => void;
  onCancelConfirm?: () => void;
  pendingConfirm?: PendingConfirm | null;
  proposals?: ChangeProposal[];
  compounds?: Compound[];
  conversationManager: ReturnType<typeof useConversations>;
  /** Pre-filled message from an inline reply — causes chat panel to open & auto-send */
  pendingMessage?: string | null;
  onPendingMessageClear?: () => void;
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
  onUndo,
  compounds,
}: {
  proposal: ChangeProposal;
  onApply: (index: number) => void;
  onReject: (index: number) => void;
  onApplyAll: () => void;
  onUndo?: (index: number) => void;
  compounds?: Compound[];
}) => {
  const hasPending = proposal.changes.some(c => c.status === 'pending');

  const normalize = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
  const findCompound = (name: string) =>
    compounds?.find(c => normalize(c.name) === normalize(name))
    ?? compounds?.find(c => normalize(c.name).includes(normalize(name)) || normalize(name).includes(normalize(c.name)));

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
        {proposal.changes.map((change, i) => {
          const matched = compounds ? findCompound(change.compoundName) : undefined;
          const compoundFound = compounds ? !!matched : undefined;
          return (
            <ChangeRow
              key={i}
              change={change}
              onApply={() => onApply(i)}
              onReject={() => onReject(i)}
              onUndo={onUndo ? () => onUndo(i) : undefined}
              compoundFound={compoundFound}
            />
          );
        })}
      </div>
    </div>
  );
};

const ChangeRow = ({
  change,
  onApply,
  onReject,
  onUndo,
  compoundFound,
}: {
  change: ProposedChange;
  onApply: () => void;
  onReject: () => void;
  onUndo?: () => void;
  compoundFound?: boolean;
}) => (
  <div className={`flex items-start gap-2 p-2 rounded-md border transition-all ${
    compoundFound === false ? 'border-destructive/40 bg-destructive/5' :
    change.status === 'accepted' ? 'border-status-good/30 bg-status-good/5' :
    change.status === 'rejected' ? 'border-destructive/30 bg-destructive/5 opacity-60' :
    change.status === 'undone' ? 'border-accent/30 bg-accent/5 opacity-70' :
    'border-border/50 bg-card'
  }`}>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${changeTypeColor(change.type)}`}>
          {changeTypeLabel(change.type)}
        </span>
        <span className="text-xs font-semibold text-foreground truncate">{change.compoundName}</span>
        {compoundFound === false && (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-destructive/15 text-status-critical flex items-center gap-0.5">
            ⚠ Not in stack
          </span>
        )}
      </div>
      {compoundFound === false && (
        <p className="text-[10px] text-status-critical mb-0.5 leading-snug">
          Compound not found in your stack — this change cannot be applied.
        </p>
      )}
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
        <button onClick={onApply} className="p-1.5 rounded-md bg-status-good/15 text-status-good hover:bg-status-good/25 transition-colors" title="Apply this change">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={onReject} className="p-1.5 rounded-md bg-destructive/15 text-status-critical hover:bg-destructive/25 transition-colors" title="Reject this change">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    ) : change.status === 'accepted' && onUndo ? (
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-status-good/15 text-status-good">
          accepted
        </span>
        <button onClick={onUndo} className="p-1.5 rounded-md bg-accent/15 text-status-warning hover:bg-accent/25 transition-colors" title="Undo this change">
          <Undo2 className="w-3.5 h-3.5" />
        </button>
      </div>
    ) : change.status === 'undone' ? (
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-accent/15 text-status-warning">
          undone
        </span>
        <button onClick={onApply} className="p-1.5 rounded-md bg-status-good/15 text-status-good hover:bg-status-good/25 transition-colors" title="Re-accept this change">
          <Check className="w-3.5 h-3.5" />
        </button>
      </div>
    ) : (
      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0 ${
        change.status === 'accepted' ? 'bg-status-good/15 text-status-good' :
        'bg-destructive/15 text-status-critical'
      }`}>
        {change.status}
      </span>
    )}
  </div>
);

const ProtocolChat = ({
  messages, isStreaming, onSend, onCancel, onClear,
  onApplyChange, onRejectChange, onApplyAll, onUndoChange,
  onConfirmChange, onCancelConfirm, pendingConfirm, proposals = [], compounds = [],
  conversationManager,
  pendingMessage, onPendingMessageClear,
}: ProtocolChatProps) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const isMobile = useIsMobile();

  // When a pending message arrives (from inline reply), expand chat and auto-send
  useEffect(() => {
    if (!pendingMessage) return;
    setIsExpanded(true);
    // Small delay to let the expansion + conversation state settle before sending
    const timer = setTimeout(() => {
      onSend(pendingMessage);
      onPendingMessageClear?.();
    }, 300);
    return () => clearTimeout(timer);
  }, [pendingMessage]);

  const {
    projects, conversations, activeConversationId,
    searchQuery, searchResults,
    setActiveConversationId,
    createProject, deleteProject,
    createConversation, deleteConversation, renameConversation, moveConversation,
    searchMessages,
  } = conversationManager;

  // Auto-collapse sidebar on mobile when a conversation is selected
  useEffect(() => {
    if (isMobile && activeConversationId) {
      setShowSidebar(false);
    }
  }, [activeConversationId, isMobile]);

  // Show sidebar by default on desktop
  useEffect(() => {
    if (!isMobile) {
      setShowSidebar(true);
    }
  }, [isMobile]);

  const hasSpeechRecognition = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setInput(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  const lastMsgCountRef = useRef(messages.length);
  const streamingScrollRef = useRef(false);

  // Track previous streaming state to detect when streaming ends
  const wasStreamingRef = useRef(false);

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;

    // New message added — scroll to the start of the new message
    if (messages.length > lastMsgCountRef.current) {
      lastMsgCountRef.current = messages.length;
      streamingScrollRef.current = false;
      // Find the last message element and scroll to its top
      requestAnimationFrame(() => {
        const msgElements = el.querySelectorAll('[data-msg]');
        const lastEl = msgElements[msgElements.length - 1];
        if (lastEl) {
          lastEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    } else if (isStreaming) {
      // During streaming, gently follow the bottom so user can read as it streams
      // Only auto-scroll if user is already near the bottom
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (isNearBottom || !streamingScrollRef.current) {
        streamingScrollRef.current = true;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }

    // When streaming ends, scroll to the start of the last assistant message
    if (wasStreamingRef.current && !isStreaming && messages.length > 0) {
      requestAnimationFrame(() => {
        const msgElements = el.querySelectorAll('[data-msg]');
        const lastEl = msgElements[msgElements.length - 1];
        if (lastEl) {
          lastEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
    wasStreamingRef.current = isStreaming;
  }, [messages, isStreaming]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    // Auto-create conversation if none active
    if (!activeConversationId) {
      const conv = await createConversation(trimmed.slice(0, 40));
      if (!conv) return;
    }
    onSend(trimmed);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const handleNewConversation = async (projectId?: string) => {
    await createConversation('New Chat', projectId);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    if (isMobile) setShowSidebar(false);
  };

  const activeConv = conversations.find(c => c.id === activeConversationId);

  // Minimized state
  if (!isExpanded) {
    const lastMsg = messages[messages.length - 1];
    const preview = lastMsg
      ? (lastMsg.role === 'user' ? 'You: ' : 'AI: ') + (lastMsg.content || '').slice(0, 80) + ((lastMsg.content || '').length > 80 ? '…' : '')
      : 'Ask about your protocol analysis…';

    return (
      <div className="bg-card rounded-lg border border-border/50 px-3 py-2.5 cursor-pointer hover:border-primary/30 transition-colors group" onClick={() => setIsExpanded(true)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-foreground">Protocol Advisor</span>
              {conversations.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/10 text-primary ml-1.5">
                  {conversations.length} chats
                </span>
              )}
              <p className="text-[10px] text-muted-foreground truncate leading-relaxed">{preview}</p>
            </div>
          </div>
          <Maximize2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
        </div>
      </div>
    );
  }

  // Expanded full-screen state
  return (
    <>
    <div className="fixed inset-0 z-50 bg-background flex animate-scale-in">
      {/* Sidebar - absolute overlay on mobile, inline on desktop */}
      {showSidebar && (
        <div className={`${isMobile ? 'absolute inset-0 z-10 bg-background' : 'w-64 flex-shrink-0'}`}>
          <ChatSidebar
            projects={projects}
            conversations={conversations}
            activeConversationId={activeConversationId}
            searchQuery={searchQuery}
            searchResults={searchResults}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onDeleteConversation={deleteConversation}
            onRenameConversation={renameConversation}
            onCreateProject={(name) => createProject(name)}
            onDeleteProject={deleteProject}
            onMoveConversation={moveConversation}
            onSearch={searchMessages}
            onSearchResultClick={(convId) => handleSelectConversation(convId)}
            onClose={isMobile ? () => setShowSidebar(false) : undefined}
          />
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border/50">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
            >
              {showSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            <Brain className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">
              {activeConv?.title || 'Protocol Advisor'}
            </span>
            {isListening && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-destructive/15 text-status-critical animate-pulse">
                ● Recording
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button onClick={onClear} className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Clear conversation">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setIsExpanded(false)} className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Minimize">
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        {!activeConversationId ? (
          <div className="flex-1 flex items-center justify-center px-4 sm:px-6">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">Protocol Advisor</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                Your AI-powered protocol assistant. Get personalized advice on your stack.
              </p>
              <button
                onClick={() => handleNewConversation()}
                className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                Start a Conversation
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
            <div className="text-center max-w-sm">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">How can I help?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Ask about your analysis, request alternatives, or improve your stack grade.
              </p>
              <div className="flex flex-col gap-2 w-full max-w-xs mx-auto">
                {[
                  { Icon: TrendingUp, q: 'How can I improve my grade to B+?' },
                  { Icon: Shield, q: 'What should I remove to reduce liver stress?' },
                  { Icon: DollarSign, q: 'Suggest cheaper alternatives for poor-value compounds' },
                  { Icon: Clock, q: 'Optimize my GH secretagogue timing' },
                ].map(({ Icon, q }) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="flex items-center gap-2.5 text-left text-xs px-3.5 py-2.5 rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border/30"
                  >
                    <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 scrollbar-thin">
            {messages.map(msg => (
              <div key={msg.id} data-msg={msg.id} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mb-1">
                    <Brain className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3.5 py-2.5 relative group ${
                  msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-secondary/60 text-foreground rounded-bl-sm border border-border/30'
                }`}>
                  {msg.content && (
                    <ChatMarkdown content={msg.content} />
                  )}
                  {msg.proposal && (
                    <ProposalCard
                      proposal={msg.proposal}
                      onApply={(i) => onApplyChange(msg.proposal!.id, i)}
                      onReject={(i) => onRejectChange(msg.proposal!.id, i)}
                      onApplyAll={() => onApplyAll(msg.proposal!.id)}
                      onUndo={onUndoChange ? (i) => onUndoChange(msg.proposal!.id, i) : undefined}
                      compounds={compounds}
                    />
                  )}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(msg.content || '');
                      toast.success('Copied to clipboard');
                    }}
                    className="absolute -bottom-1 right-1 p-1 rounded hover:bg-secondary/80 text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Copy message"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex items-end gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mb-1 animate-pulse">
                  <Brain className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-secondary/60 rounded-2xl rounded-bl-sm px-4 py-3 border border-border/30">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-[10px] text-muted-foreground ml-1.5 font-medium">Thinking…</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input - always visible when conversation is active */}
        {activeConversationId && (
          <div className="border-t border-border/50 px-3 sm:px-4 py-2.5 pb-[env(safe-area-inset-bottom,8px)] bg-background">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your protocol…"
                className="flex-1 bg-secondary/30 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none focus:border-primary/40 max-h-[120px] px-3 py-2.5 select-text"
                rows={1}
                disabled={isStreaming}
                spellCheck
                autoCorrect="on"
                autoCapitalize="sentences"
              />
              {hasSpeechRecognition && (
                <button
                  onClick={toggleListening}
                  className={`p-2.5 rounded-lg transition-colors flex-shrink-0 ${
                    isListening ? 'bg-destructive/15 text-status-critical mic-recording' : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                  title={isListening ? 'Stop listening' : 'Voice input'}
                  disabled={isStreaming}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
              {isStreaming ? (
                <button onClick={onCancel} className="p-2.5 rounded-lg bg-destructive/15 text-status-critical hover:bg-destructive/25 transition-colors flex-shrink-0">
                  <Square className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={!input.trim()} className="p-2.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors flex-shrink-0 disabled:opacity-30">
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
            <GeminiBadge />
          </div>
        )}
      </div>
    </div>

    {pendingConfirm && onConfirmChange && onCancelConfirm && (() => {
      const proposal = proposals.find(p => p.id === pendingConfirm.proposalId);
      const change = proposal?.changes[pendingConfirm.changeIndex] ?? null;
      // Fuzzy match: strip category suffix like " (peptide)" before comparing
      const normalize = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
      const compound = change
        ? (compounds.find(c => normalize(c.name) === normalize(change.compoundName))
          ?? compounds.find(c => normalize(c.name).includes(normalize(change.compoundName)) || normalize(change.compoundName).includes(normalize(c.name)))
          ?? null)
        : null;
      return (
        <ProtocolChangeConfirmSheet
          open={true}
          change={change}
          compound={compound}
          onConfirm={onConfirmChange}
          onCancel={onCancelConfirm}
        />
      );
    })()}
    </>
  );
};

export default ProtocolChat;
