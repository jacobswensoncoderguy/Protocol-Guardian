import { useState, useCallback, useRef } from 'react';
import { Compound } from '@/data/compounds';
import { UserProtocol } from '@/hooks/useProtocols';
import { StackAnalysis, ToleranceLevel } from '@/hooks/useProtocolAnalysis';
import { toast } from 'sonner';

export interface ProposedChange {
  type: 'adjust_dose' | 'adjust_frequency' | 'adjust_timing' | 'adjust_cycling' | 'remove_compound' | 'add_compound';
  compoundName: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  reasoning: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface ChangeProposal {
  id: string;
  changes: ProposedChange[];
  summary: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposal?: ChangeProposal;
  timestamp: number;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-protocol`;

export function useProtocolChat(
  compounds: Compound[],
  protocols: UserProtocol[],
  analysis: StackAnalysis | null,
  toleranceLevel: ToleranceLevel,
  updateCompound: (id: string, updates: Partial<Compound>) => void,
  deleteCompound: (id: string) => Promise<void>,
  refetch: () => Promise<void>,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [proposals, setProposals] = useState<ChangeProposal[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (userInput: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // Build conversation history for the API (without proposals/metadata)
    const apiMessages = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Prepare compound data for context
    const compoundData = compounds.map(c => ({
      name: c.name,
      category: c.category,
      dosePerUse: c.dosePerUse,
      doseLabel: c.doseLabel,
      dosesPerDay: c.dosesPerDay,
      daysPerWeek: c.daysPerWeek,
      timingNote: c.timingNote,
      cyclingNote: c.cyclingNote,
      unitPrice: c.unitPrice,
      kitPrice: c.kitPrice,
    }));

    const protocolData = protocols.map(p => ({
      ...p,
      compoundNames: p.compoundIds.map(id => compounds.find(c => c.id === id)?.name).filter(Boolean),
    }));

    let assistantContent = '';
    let toolCallBuffer = '';
    let toolCallActive = false;
    const assistantId = crypto.randomUUID();

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          compounds: compoundData,
          protocols: protocolData,
          toleranceLevel,
          analysisType: 'chat',
          messages: apiMessages,
          analysis,
        }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({ error: 'Chat failed' }));
        toast.error(errData.error || 'Chat failed');
        setIsStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      const upsertAssistant = (content: string) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.id === assistantId) {
            return prev.map(m => m.id === assistantId ? { ...m, content } : m);
          }
          return [...prev, { id: assistantId, role: 'assistant', content, timestamp: Date.now() }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;

            // Handle regular text content
            if (delta?.content) {
              assistantContent += delta.content;
              upsertAssistant(assistantContent);
            }

            // Handle tool calls (propose_changes)
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.function?.name === 'propose_changes') {
                  toolCallActive = true;
                }
                if (tc.function?.arguments) {
                  toolCallBuffer += tc.function.arguments;
                }
              }
            }

            // Check finish reason
            const finishReason = parsed.choices?.[0]?.finish_reason;
            if (finishReason === 'tool_calls' && toolCallActive && toolCallBuffer) {
              try {
                const proposalData = JSON.parse(toolCallBuffer);
                const proposal: ChangeProposal = {
                  id: crypto.randomUUID(),
                  changes: proposalData.changes.map((c: any) => ({ ...c, status: 'pending' as const })),
                  summary: proposalData.summary,
                };
                setProposals(prev => [...prev, proposal]);
                // Ensure assistant message exists, then attach proposal
                setMessages(prev => {
                  const exists = prev.some(m => m.id === assistantId);
                  if (exists) {
                    return prev.map(m => m.id === assistantId ? { ...m, proposal } : m);
                  }
                  // Create assistant message with proposal if none exists yet
                  return [...prev, { id: assistantId, role: 'assistant' as const, content: '', proposal, timestamp: Date.now() }];
                });
              } catch (parseErr) {
                console.error('Failed to parse proposal:', parseErr);
              }
              toolCallBuffer = '';
              toolCallActive = false;
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              upsertAssistant(assistantContent);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Chat stream error:', err);
        toast.error('Chat connection failed');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages, compounds, protocols, toleranceLevel, analysis]);

  const applyChange = useCallback((proposalId: string, changeIndex: number) => {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return;

    const change = proposal.changes[changeIndex];
    if (!change || change.status !== 'pending') return;

    const compound = compounds.find(c => c.name === change.compoundName);

    if (change.type === 'remove_compound' && compound) {
      deleteCompound(compound.id);
      toast.success(`Removed ${change.compoundName}`);
    } else if (compound && change.field && change.newValue !== undefined) {
      const numericFields = ['dosePerUse', 'dosesPerDay', 'daysPerWeek', 'cycleOnDays', 'cycleOffDays'];
      const value = numericFields.includes(change.field)
        ? parseFloat(change.newValue)
        : change.newValue;
      updateCompound(compound.id, { [change.field]: value } as Partial<Compound>);
      toast.success(`Updated ${change.compoundName}: ${change.field} → ${change.newValue}`);
    }

    // Mark change as accepted
    setProposals(prev => prev.map(p =>
      p.id === proposalId
        ? {
          ...p,
          changes: p.changes.map((c, i) =>
            i === changeIndex ? { ...c, status: 'accepted' as const } : c
          ),
        }
        : p
    ));
    // Also update in messages
    setMessages(prev => prev.map(m =>
      m.proposal?.id === proposalId
        ? {
          ...m,
          proposal: {
            ...m.proposal,
            changes: m.proposal.changes.map((c, i) =>
              i === changeIndex ? { ...c, status: 'accepted' as const } : c
            ),
          },
        }
        : m
    ));
  }, [proposals, compounds, updateCompound, deleteCompound]);

  const rejectChange = useCallback((proposalId: string, changeIndex: number) => {
    setProposals(prev => prev.map(p =>
      p.id === proposalId
        ? {
          ...p,
          changes: p.changes.map((c, i) =>
            i === changeIndex ? { ...c, status: 'rejected' as const } : c
          ),
        }
        : p
    ));
    setMessages(prev => prev.map(m =>
      m.proposal?.id === proposalId
        ? {
          ...m,
          proposal: {
            ...m.proposal,
            changes: m.proposal.changes.map((c, i) =>
              i === changeIndex ? { ...c, status: 'rejected' as const } : c
            ),
          },
        }
        : m
    ));
  }, []);

  const applyAllPending = useCallback((proposalId: string) => {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return;
    proposal.changes.forEach((change, i) => {
      if (change.status === 'pending') applyChange(proposalId, i);
    });
  }, [proposals, applyChange]);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setProposals([]);
  }, []);

  return {
    messages,
    isStreaming,
    proposals,
    sendMessage,
    applyChange,
    rejectChange,
    applyAllPending,
    cancelStream,
    clearChat,
  };
}
