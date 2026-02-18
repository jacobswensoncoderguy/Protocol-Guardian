import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ChatProject {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface ChatConversation {
  id: string;
  project_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message_preview?: string;
}

export function useConversations(userId: string | undefined) {
  const [projects, setProjects] = useState<ChatProject[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ conversationId: string; messageId: string; content: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Load projects and conversations
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);
      const [projRes, convRes] = await Promise.all([
        supabase.from('chat_projects').select('*').order('created_at', { ascending: false }),
        supabase.from('chat_conversations').select('*').order('updated_at', { ascending: false }),
      ]);

      if (projRes.data) setProjects(projRes.data as unknown as ChatProject[]);
      if (convRes.data) {
        const convs = convRes.data as unknown as ChatConversation[];
        const convIds = convs.map(c => c.id);

        // Single bulk query for all messages across all conversations
        const { data: allMessages } = convIds.length > 0
          ? await supabase
              .from('protocol_chat_messages')
              .select('conversation_id, content, role, created_at')
              .in('conversation_id', convIds)
              .order('created_at', { ascending: false })
          : { data: [] };

        // Build lookup maps from the single result set
        const countMap = new Map<string, number>();
        const previewMap = new Map<string, string>();

        for (const msg of allMessages ?? []) {
          const cid = msg.conversation_id ?? '';
          if (!cid) continue;
          countMap.set(cid, (countMap.get(cid) ?? 0) + 1);
          // First occurrence per conversation_id is the latest (ordered desc)
          if (!previewMap.has(cid)) {
            previewMap.set(cid, msg.content?.slice(0, 80) ?? '');
          }
        }

        const enriched = convs.map(c => ({
          ...c,
          message_count: countMap.get(c.id) ?? 0,
          last_message_preview: previewMap.get(c.id) ?? '',
        }));
        setConversations(enriched);

        // Auto-select most recent if none active
        if (!activeConversationId && enriched.length > 0) {
          setActiveConversationId(enriched[0].id);
        }
      }
      setLoading(false);
    };
    load();
  }, [userId]);

  const createProject = useCallback(async (name: string, description?: string, color?: string) => {
    if (!userId) return null;
    const { data, error } = await supabase.from('chat_projects').insert({
      user_id: userId,
      name,
      description: description || null,
      color: color || '#6366f1',
    }).select().single();

    if (error) { toast.error('Failed to create project'); return null; }
    const proj = data as unknown as ChatProject;
    setProjects(prev => [proj, ...prev]);
    toast.success(`Project "${name}" created`);
    return proj;
  }, [userId]);

  const deleteProject = useCallback(async (id: string) => {
    await supabase.from('chat_projects').delete().eq('id', id);
    setProjects(prev => prev.filter(p => p.id !== id));
    // Unlink conversations from deleted project
    setConversations(prev => prev.map(c => c.project_id === id ? { ...c, project_id: null } : c));
  }, []);

  const createConversation = useCallback(async (title?: string, projectId?: string) => {
    if (!userId) return null;
    const { data, error } = await supabase.from('chat_conversations').insert({
      user_id: userId,
      title: title || 'New Chat',
      project_id: projectId || null,
    }).select().single();

    if (error) { toast.error('Failed to create conversation'); return null; }
    const conv = { ...(data as unknown as ChatConversation), message_count: 0, last_message_preview: '' };
    setConversations(prev => [conv, ...prev]);
    setActiveConversationId(conv.id);
    return conv;
  }, [userId]);

  const deleteConversation = useCallback(async (id: string) => {
    await supabase.from('chat_conversations').delete().eq('id', id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
  }, [activeConversationId]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    await supabase.from('chat_conversations').update({ title }).eq('id', id);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
  }, []);

  const moveConversation = useCallback(async (convId: string, projectId: string | null) => {
    await supabase.from('chat_conversations').update({ project_id: projectId }).eq('id', convId);
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, project_id: projectId } : c));
  }, []);

  // Search across all messages
  const searchMessages = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim() || !userId) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from('protocol_chat_messages')
      .select('id, content, role, conversation_id')
      .eq('user_id', userId)
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setSearchResults(data.map(d => ({
        conversationId: d.conversation_id || '',
        messageId: d.id,
        content: d.content,
        role: d.role,
      })));
    }
  }, [userId]);

  const refreshConversation = useCallback((convId: string, lastContent: string) => {
    setConversations(prev => prev.map(c =>
      c.id === convId
        ? { ...c, message_count: (c.message_count || 0) + 1, last_message_preview: lastContent.slice(0, 80), updated_at: new Date().toISOString() }
        : c
    ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
  }, []);

  return {
    projects, conversations, activeConversationId, loading,
    searchQuery, searchResults,
    setActiveConversationId,
    createProject, deleteProject,
    createConversation, deleteConversation, renameConversation, moveConversation,
    searchMessages, refreshConversation,
  };
}
