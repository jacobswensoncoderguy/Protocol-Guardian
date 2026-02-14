import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserProtocol {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  description: string | null;
  notes: string | null;
  compoundIds: string[]; // user_compound IDs
}

interface DbProtocol {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  description: string | null;
  notes: string | null;
}

interface DbCompoundProtocol {
  id: string;
  user_protocol_id: string;
  user_compound_id: string;
}

export const SUGGESTED_PROTOCOLS = [
  { name: 'Heart Health Protocol', icon: '❤️', description: 'Cardiovascular protection and blood pressure support' },
  { name: 'Liver Cleanse Protocol', icon: '🫁', description: 'Hepatoprotection and detoxification support' },
  { name: 'Cognitive Remodeling Protocol', icon: '🧠', description: 'Neuroprotection, focus and memory enhancement' },
  { name: 'Libido Enhancement Protocol', icon: '🔥', description: 'Vascular health, blood flow and sexual performance' },
  { name: 'Recovery & Repair Protocol', icon: '🩹', description: 'Tissue healing, joint support and inflammation control' },
  { name: 'Body Recomposition Protocol', icon: '💪', description: 'Fat loss, lean mass gain and metabolic optimization' },
  { name: 'Longevity & Anti-Aging Protocol', icon: '⏳', description: 'Cellular repair, NAD+ and sirtuin activation' },
  { name: 'Immune Defense Protocol', icon: '🛡️', description: 'Immune system modulation and pathogen resistance' },
];

export function useProtocols(userId: string | undefined) {
  const [protocols, setProtocols] = useState<UserProtocol[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProtocols = useCallback(async () => {
    if (!userId) {
      setProtocols([]);
      setLoading(false);
      return;
    }

    const [protocolsRes, linksRes] = await Promise.all([
      supabase.from('user_protocols').select('*').eq('user_id', userId),
      supabase.from('user_compound_protocols').select('*'),
    ]);

    if (protocolsRes.error || linksRes.error) {
      console.error('Failed to fetch protocols:', protocolsRes.error, linksRes.error);
      setProtocols([]);
      setLoading(false);
      return;
    }

    const dbProtocols = (protocolsRes.data || []) as DbProtocol[];
    const dbLinks = (linksRes.data || []) as DbCompoundProtocol[];

    const linksByProtocol = new Map<string, string[]>();
    dbLinks.forEach(link => {
      const arr = linksByProtocol.get(link.user_protocol_id) || [];
      arr.push(link.user_compound_id);
      linksByProtocol.set(link.user_protocol_id, arr);
    });

    setProtocols(
      dbProtocols.map(p => ({
        id: p.id,
        user_id: p.user_id,
        name: p.name,
        icon: p.icon,
        description: p.description,
        notes: p.notes,
        compoundIds: linksByProtocol.get(p.id) || [],
      }))
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchProtocols();
  }, [fetchProtocols]);

  const createProtocol = useCallback(async (name: string, icon: string, description?: string) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('user_protocols')
      .insert({ user_id: userId, name, icon, description: description || null })
      .select()
      .single();
    if (error) {
      console.error('Failed to create protocol:', error);
      return null;
    }
    await fetchProtocols();
    return data as DbProtocol;
  }, [userId, fetchProtocols]);

  const deleteProtocol = useCallback(async (protocolId: string) => {
    const { error } = await supabase.from('user_protocols').delete().eq('id', protocolId);
    if (error) console.error('Failed to delete protocol:', error);
    await fetchProtocols();
  }, [fetchProtocols]);

  const updateProtocol = useCallback(async (protocolId: string, updates: { name?: string; icon?: string; description?: string; notes?: string }) => {
    const { error } = await supabase.from('user_protocols').update(updates).eq('id', protocolId);
    if (error) console.error('Failed to update protocol:', error);
    await fetchProtocols();
  }, [fetchProtocols]);

  const cloneProtocol = useCallback(async (protocolId: string) => {
    if (!userId) return null;
    const source = protocols.find(p => p.id === protocolId);
    if (!source) return null;
    const { data, error } = await supabase
      .from('user_protocols')
      .insert({ user_id: userId, name: `${source.name} (Copy)`, icon: source.icon, description: source.description, notes: source.notes })
      .select()
      .single();
    if (error) { console.error('Failed to clone protocol:', error); return null; }
    // Clone compound links
    if (source.compoundIds.length > 0) {
      const links = source.compoundIds.map(cId => ({ user_protocol_id: data.id, user_compound_id: cId }));
      const { error: linkErr } = await supabase.from('user_compound_protocols').insert(links);
      if (linkErr) console.error('Failed to clone compound links:', linkErr);
    }
    await fetchProtocols();
    return data;
  }, [userId, protocols, fetchProtocols]);

  const addCompoundToProtocol = useCallback(async (protocolId: string, compoundId: string) => {
    const { error } = await supabase
      .from('user_compound_protocols')
      .insert({ user_protocol_id: protocolId, user_compound_id: compoundId });
    if (error) console.error('Failed to add compound to protocol:', error);
    await fetchProtocols();
  }, [fetchProtocols]);

  const removeCompoundFromProtocol = useCallback(async (protocolId: string, compoundId: string) => {
    const { error } = await supabase
      .from('user_compound_protocols')
      .delete()
      .eq('user_protocol_id', protocolId)
      .eq('user_compound_id', compoundId);
    if (error) console.error('Failed to remove compound from protocol:', error);
    await fetchProtocols();
  }, [fetchProtocols]);

  return {
    protocols,
    loading,
    createProtocol,
    deleteProtocol,
    updateProtocol,
    cloneProtocol,
    addCompoundToProtocol,
    removeCompoundFromProtocol,
    refetch: fetchProtocols,
  };
}
