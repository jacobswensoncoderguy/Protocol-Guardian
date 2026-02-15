import { useState, useCallback, useRef, useEffect } from 'react';
import { Compound } from '@/data/compounds';
import { UserProtocol } from '@/hooks/useProtocols';
import { StackAnalysis, ToleranceLevel } from '@/hooks/useProtocolAnalysis';
import { supabase } from '@/integrations/supabase/client';
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
  conversationId: string | null,
  onConversationUpdate?: (convId: string, content: string) => void,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [proposals, setProposals] = useState<ChangeProposal[]>([]);
  const [loadedConvId, setLoadedConvId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load chat history when conversationId changes
  useEffect(() => {
    if (!conversationId || conversationId === loadedConvId) return;
    const loadHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('protocol_chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to load chat history:', error);
        return;
      }

      if (data && data.length > 0) {
        const loaded: ChatMessage[] = data.map(row => ({
          id: row.id,
          role: row.role as 'user' | 'assistant',
          content: row.content,
          proposal: row.proposal as unknown as ChangeProposal | undefined,
          timestamp: new Date(row.created_at).getTime(),
        }));
        setMessages(loaded);
        const loadedProposals = loaded.filter(m => m.proposal).map(m => m.proposal!);
        setProposals(loadedProposals);
      } else {
        setMessages([]);
        setProposals([]);
      }
      setLoadedConvId(conversationId);
    };
    loadHistory();
  }, [conversationId, loadedConvId]);

  // Clear messages when conversation changes
  useEffect(() => {
    if (conversationId !== loadedConvId) {
      setMessages([]);
      setProposals([]);
    }
  }, [conversationId]);

  const persistMessage = useCallback(async (msg: ChatMessage) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !conversationId) return;

    await supabase.from('protocol_chat_messages').insert({
      id: msg.id,
      user_id: user.id,
      role: msg.role,
      content: msg.content,
      proposal: msg.proposal ? (msg.proposal as any) : null,
      conversation_id: conversationId,
    });
  }, [conversationId]);

  const updatePersistedMessage = useCallback(async (msgId: string, updates: { content?: string; proposal?: ChangeProposal | null }) => {
    const updateData: Record<string, any> = {};
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.proposal !== undefined) updateData.proposal = updates.proposal as any;
    await supabase.from('protocol_chat_messages').update(updateData).eq('id', msgId);
  }, []);

  const sendMessage = useCallback(async (userInput: string) => {
    if (!conversationId) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    persistMessage(userMsg);
    onConversationUpdate?.(conversationId, userInput);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const apiMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    const compoundData = compounds.map(c => ({
      name: c.name, category: c.category, dosePerUse: c.dosePerUse,
      doseLabel: c.doseLabel, dosesPerDay: c.dosesPerDay, daysPerWeek: c.daysPerWeek,
      timingNote: c.timingNote, cyclingNote: c.cyclingNote,
      cycleOnDays: c.cycleOnDays, cycleOffDays: c.cycleOffDays, cycleStartDate: c.cycleStartDate,
      unitPrice: c.unitPrice, kitPrice: c.kitPrice,
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          compounds: compoundData, protocols: protocolData,
          toleranceLevel, analysisType: 'chat', messages: apiMessages, analysis,
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
            if (delta?.content) {
              assistantContent += delta.content;
              upsertAssistant(assistantContent);
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.function?.name === 'propose_changes') toolCallActive = true;
                if (tc.function?.arguments) toolCallBuffer += tc.function.arguments;
              }
            }
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
                setMessages(prev => {
                  const exists = prev.some(m => m.id === assistantId);
                  if (exists) return prev.map(m => m.id === assistantId ? { ...m, proposal } : m);
                  return [...prev, { id: assistantId, role: 'assistant' as const, content: '', proposal, timestamp: Date.now() }];
                });
                updatePersistedMessage(assistantId, { content: assistantContent, proposal });
              } catch (parseErr) { console.error('Failed to parse proposal:', parseErr); }
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
            if (content) { assistantContent += content; upsertAssistant(assistantContent); }
          } catch { /* ignore */ }
        }
      }

      persistMessage({ id: assistantId, role: 'assistant', content: assistantContent, timestamp: Date.now() });
      onConversationUpdate?.(conversationId, assistantContent);
    } catch (err: any) {
      if (err.name !== 'AbortError') { console.error('Chat stream error:', err); toast.error('Chat connection failed'); }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages, compounds, protocols, toleranceLevel, analysis, persistMessage, updatePersistedMessage, conversationId, onConversationUpdate]);

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
      const value = numericFields.includes(change.field) ? parseFloat(change.newValue) : change.newValue;
      updateCompound(compound.id, { [change.field]: value } as Partial<Compound>);
      toast.success(`Updated ${change.compoundName}: ${change.field} → ${change.newValue}`);
    }

    const updateProposalStatus = (p: ChangeProposal) => ({
      ...p,
      changes: p.changes.map((c, i) => i === changeIndex ? { ...c, status: 'accepted' as const } : c),
    });

    setProposals(prev => prev.map(p => p.id === proposalId ? updateProposalStatus(p) : p));
    setMessages(prev => prev.map(m => m.proposal?.id === proposalId ? { ...m, proposal: updateProposalStatus(m.proposal!) } : m));

    const msg = messages.find(m => m.proposal?.id === proposalId);
    if (msg) updatePersistedMessage(msg.id, { proposal: updateProposalStatus(msg.proposal!) });
  }, [proposals, compounds, updateCompound, deleteCompound, messages, updatePersistedMessage]);

  const rejectChange = useCallback((proposalId: string, changeIndex: number) => {
    const updateProposalStatus = (p: ChangeProposal) => ({
      ...p,
      changes: p.changes.map((c, i) => i === changeIndex ? { ...c, status: 'rejected' as const } : c),
    });
    setProposals(prev => prev.map(p => p.id === proposalId ? updateProposalStatus(p) : p));
    setMessages(prev => prev.map(m => m.proposal?.id === proposalId ? { ...m, proposal: updateProposalStatus(m.proposal!) } : m));
    const msg = messages.find(m => m.proposal?.id === proposalId);
    if (msg) updatePersistedMessage(msg.id, { proposal: updateProposalStatus(msg.proposal!) });
  }, [messages, updatePersistedMessage]);

  const applyAllPending = useCallback((proposalId: string) => {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return;
    proposal.changes.forEach((change, i) => { if (change.status === 'pending') applyChange(proposalId, i); });
  }, [proposals, applyChange]);

  const cancelStream = useCallback(() => { abortRef.current?.abort(); }, []);

  const clearChat = useCallback(async () => {
    setMessages([]);
    setProposals([]);
    if (!conversationId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('protocol_chat_messages').delete().eq('conversation_id', conversationId);
    }
  }, [conversationId]);

  return {
    messages, isStreaming, proposals,
    sendMessage, applyChange, rejectChange, applyAllPending, cancelStream, clearChat,
  };
}
