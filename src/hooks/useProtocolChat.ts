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
  status: 'pending' | 'accepted' | 'rejected' | 'undone';
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

export interface PendingConfirm {
  proposalId: string;
  changeIndex: number;
}

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
  onAutoTitle?: (convId: string, title: string) => void,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [proposals, setProposals] = useState<ChangeProposal[]>([]);
  const [loadedConvId, setLoadedConvId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Refs to avoid stale closures in confirmChange / undoChange
  const proposalsRef = useRef<ChangeProposal[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  proposalsRef.current = proposals;
  messagesRef.current = messages;

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

      // Auto-title: if this is the first exchange (only user + assistant), generate a title
      if (messages.length === 0 && assistantContent && onAutoTitle) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const titleToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const titleResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-title`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${titleToken}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ userMessage: userInput, assistantMessage: assistantContent }),
          });
          if (titleResp.ok) {
            const { title } = await titleResp.json();
            if (title) onAutoTitle(conversationId, title);
          }
        } catch (e) { console.error('Auto-title failed:', e); }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') { console.error('Chat stream error:', err); toast.error('Chat connection failed'); }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages, compounds, protocols, toleranceLevel, analysis, persistMessage, updatePersistedMessage, conversationId, onConversationUpdate]);

  // Step 1: Request confirmation before applying — sets pendingConfirm
  const applyChange = useCallback((proposalId: string, changeIndex: number) => {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return;
    const change = proposal.changes[changeIndex];
    if (!change || change.status !== 'pending') return;
    // Show confirm sheet instead of applying immediately
    setPendingConfirm({ proposalId, changeIndex });
  }, [proposals]);

  // Step 2: Confirmed — actually write the change and cascade
  const confirmChange = useCallback(async () => {
    if (!pendingConfirm) return;
    const { proposalId, changeIndex } = pendingConfirm;
    setPendingConfirm(null);

    // Use refs to avoid stale closure issues
    const proposal = proposalsRef.current.find(p => p.id === proposalId);
    if (!proposal) return;
    const change = proposal.changes[changeIndex];
    if (!change) return;
    const compound = compounds.find(c => c.name === change.compoundName);

    if (change.type === 'remove_compound' && compound) {
      await deleteCompound(compound.id);
      // Log protocol change
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('protocol_changes').insert({
          user_id: user.id,
          change_type: 'remove_compound',
          compound_id: compound.id,
          description: `Removed ${change.compoundName} (AI recommendation)`,
          previous_value: change.oldValue,
          new_value: null,
        });
      }
      toast.success(`Removed ${change.compoundName}`);
    } else if (compound && change.field && change.newValue !== undefined) {
      const numericFields = ['dosePerUse', 'dosesPerDay', 'daysPerWeek', 'cycleOnDays', 'cycleOffDays'];
      const value = numericFields.includes(change.field) ? parseFloat(change.newValue) : change.newValue;
      updateCompound(compound.id, { [change.field]: value } as Partial<Compound>);
      // Log protocol change
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('protocol_changes').insert({
          user_id: user.id,
          change_type: change.type,
          compound_id: compound.id,
          description: `${change.compoundName}: ${change.field} updated (AI recommendation)`,
          previous_value: change.oldValue,
          new_value: change.newValue,
        });
      }
      toast.success(`Updated ${change.compoundName}: ${change.field} → ${change.newValue}`);
    }

    const updateProposalStatus = (p: ChangeProposal) => ({
      ...p,
      changes: p.changes.map((c, i) => i === changeIndex ? { ...c, status: 'accepted' as const } : c),
    });

    setProposals(prev => prev.map(p => p.id === proposalId ? updateProposalStatus(p) : p));
    setMessages(prev => prev.map(m => m.proposal?.id === proposalId ? { ...m, proposal: updateProposalStatus(m.proposal!) } : m));

    // Use ref to find message with fresh data
    const msg = messagesRef.current.find(m => m.proposal?.id === proposalId);
    if (msg) updatePersistedMessage(msg.id, { proposal: updateProposalStatus(msg.proposal!) });

    // Cascade: refetch compounds so all views (schedule, dashboard, costs) update
    await refetch();
  }, [pendingConfirm, compounds, updateCompound, deleteCompound, updatePersistedMessage, refetch]);

  const undoChange = useCallback(async (proposalId: string, changeIndex: number) => {
    const proposal = proposalsRef.current.find(p => p.id === proposalId);
    if (!proposal) return;
    const change = proposal.changes[changeIndex];
    if (!change || change.status !== 'accepted') return;
    const compound = compounds.find(c => c.name === change.compoundName);

    // Revert: set field back to old value
    if (compound && change.field && change.oldValue !== undefined) {
      const numericFields = ['dosePerUse', 'dosesPerDay', 'daysPerWeek', 'cycleOnDays', 'cycleOffDays'];
      const value = numericFields.includes(change.field) ? parseFloat(change.oldValue) : change.oldValue;
      updateCompound(compound.id, { [change.field]: value } as Partial<Compound>);
      toast.success(`Reverted ${change.compoundName}: ${change.field} → ${change.oldValue}`);
    }

    const updateProposalStatus = (p: ChangeProposal) => ({
      ...p,
      changes: p.changes.map((c, i) => i === changeIndex ? { ...c, status: 'undone' as const } : c),
    });

    setProposals(prev => prev.map(p => p.id === proposalId ? updateProposalStatus(p) : p));
    setMessages(prev => prev.map(m => m.proposal?.id === proposalId ? { ...m, proposal: updateProposalStatus(m.proposal!) } : m));

    const msg = messagesRef.current.find(m => m.proposal?.id === proposalId);
    if (msg) updatePersistedMessage(msg.id, { proposal: updateProposalStatus(msg.proposal!) });

    await refetch();
  }, [compounds, updateCompound, updatePersistedMessage, refetch]);

  const rejectChange = useCallback((proposalId: string, changeIndex: number) => {
    const updateProposalStatus = (p: ChangeProposal) => ({
      ...p,
      changes: p.changes.map((c, i) => i === changeIndex ? { ...c, status: 'rejected' as const } : c),
    });
    setProposals(prev => prev.map(p => p.id === proposalId ? updateProposalStatus(p) : p));
    setMessages(prev => prev.map(m => m.proposal?.id === proposalId ? { ...m, proposal: updateProposalStatus(m.proposal!) } : m));
    const msg = messagesRef.current.find(m => m.proposal?.id === proposalId);
    if (msg) updatePersistedMessage(msg.id, { proposal: updateProposalStatus(msg.proposal!) });
  }, [updatePersistedMessage]);

  // "Accept All" applies all pending changes directly (no confirm sheet per item)
  const applyAllPending = useCallback(async (proposalId: string) => {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return;
    for (let i = 0; i < proposal.changes.length; i++) {
      if (proposal.changes[i].status === 'pending') {
        // Apply directly without confirm sheet
        await (async () => {
          const change = proposal.changes[i];
          const compound = compounds.find(c => c.name === change.compoundName);
          if (change.type === 'remove_compound' && compound) {
            await deleteCompound(compound.id);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) await supabase.from('protocol_changes').insert({ user_id: user.id, change_type: 'remove_compound', compound_id: compound.id, description: `Removed ${change.compoundName} (AI Accept All)`, previous_value: change.oldValue });
            toast.success(`Removed ${change.compoundName}`);
          } else if (compound && change.field && change.newValue !== undefined) {
            const numericFields = ['dosePerUse', 'dosesPerDay', 'daysPerWeek', 'cycleOnDays', 'cycleOffDays'];
            const value = numericFields.includes(change.field) ? parseFloat(change.newValue) : change.newValue;
            updateCompound(compound.id, { [change.field]: value } as Partial<Compound>);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) await supabase.from('protocol_changes').insert({ user_id: user.id, change_type: change.type, compound_id: compound.id, description: `${change.compoundName}: ${change.field} updated (AI Accept All)`, previous_value: change.oldValue, new_value: change.newValue });
            toast.success(`Updated ${change.compoundName}`);
          }
        })();
        const updateProposalStatus = (p: ChangeProposal) => ({
          ...p,
          changes: p.changes.map((c, ci) => ci === i ? { ...c, status: 'accepted' as const } : c),
        });
        setProposals(prev => prev.map(p => p.id === proposalId ? updateProposalStatus(p) : p));
        setMessages(prev => prev.map(m => m.proposal?.id === proposalId ? { ...m, proposal: updateProposalStatus(m.proposal!) } : m));
        const msg = messages.find(m => m.proposal?.id === proposalId);
        if (msg) updatePersistedMessage(msg.id, { proposal: updateProposalStatus(msg.proposal!) });
      }
    }
    setPendingConfirm(null);
    await refetch();
  }, [proposals, compounds, updateCompound, deleteCompound, messages, updatePersistedMessage, refetch]);

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
    pendingConfirm, setPendingConfirm,
    sendMessage, applyChange, confirmChange, rejectChange, applyAllPending, cancelStream, clearChat, undoChange,
  };
}
