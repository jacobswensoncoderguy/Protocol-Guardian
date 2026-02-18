import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Fetches today's dose check-offs for a specific (linked) household member.
 * Returns a Set of check-off keys in the same format as useDoseCheckOffs:
 * "{compoundId}-{timing}-{doseIndex}"
 * 
 * Also subscribes to realtime changes so the view stays in sync.
 */
export function useHouseholdDoseCheckOffs(memberUserIds: string[]) {
  // Map of userId -> Set<string> (checked dose keys for that member)
  const [memberCheckedDoses, setMemberCheckedDoses] = useState<Map<string, Set<string>>>(new Map());

  const today = todayStr();

  const fetchForMember = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('dose_check_offs')
      .select('compound_id, timing, dose_index')
      .eq('user_id', uid)
      .eq('check_date', today);

    if (!error && data) {
      const keys = new Set(data.map(r => `${r.compound_id}-${r.timing}-${r.dose_index}`));
      setMemberCheckedDoses(prev => {
        const next = new Map(prev);
        next.set(uid, keys);
        return next;
      });
    }
  }, [today]);

  useEffect(() => {
    if (memberUserIds.length === 0) {
      setMemberCheckedDoses(new Map());
      return;
    }

    // Initial fetch for all members
    memberUserIds.forEach(uid => fetchForMember(uid));

    // Realtime subscription — listen for any changes on dose_check_offs
    // We filter by user_id server-side via RLS, but we subscribe broadly
    // and re-fetch per member on change
    const channel = supabase
      .channel(`household-check-offs-${memberUserIds.join('-')}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dose_check_offs',
        },
        (payload) => {
          // Determine which member's data changed
          const changedUserId = (payload.new as any)?.user_id || (payload.old as any)?.user_id;
          if (changedUserId && memberUserIds.includes(changedUserId)) {
            fetchForMember(changedUserId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberUserIds.join(','), fetchForMember]);

  return { memberCheckedDoses };
}
