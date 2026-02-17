import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CheckOffKey {
  compoundId: string;
  timing: string;
  doseIndex: number;
}

function toKey(k: CheckOffKey): string {
  return `${k.compoundId}-${k.timing}-${k.doseIndex}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useDoseCheckOffs() {
  const { user } = useAuth();
  const [checkedDoses, setCheckedDoses] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const today = todayStr();

  // Load today's check-offs
  useEffect(() => {
    if (!user) { setCheckedDoses(new Set()); setLoading(false); return; }

    const load = async () => {
      const { data } = await supabase
        .from('dose_check_offs')
        .select('compound_id, timing, dose_index')
        .eq('user_id', user.id)
        .eq('check_date', today);

      if (data) {
        const keys = new Set(data.map(r => toKey({
          compoundId: r.compound_id,
          timing: r.timing,
          doseIndex: r.dose_index,
        })));
        setCheckedDoses(keys);
      }
      setLoading(false);
    };
    load();
  }, [user, today]);

  const toggleChecked = useCallback(async (key: string) => {
    if (!user) return;

    // Parse key back: "compoundId-timing-index"
    const lastDash = key.lastIndexOf('-');
    const doseIndex = parseInt(key.substring(lastDash + 1), 10);
    const rest = key.substring(0, lastDash);
    const secondLastDash = rest.lastIndexOf('-');
    const timing = rest.substring(secondLastDash + 1);
    const compoundId = rest.substring(0, secondLastDash);

    const isCurrentlyChecked = checkedDoses.has(key);

    // Optimistic update
    setCheckedDoses(prev => {
      const next = new Set(prev);
      if (isCurrentlyChecked) next.delete(key);
      else next.add(key);
      return next;
    });

    if (isCurrentlyChecked) {
      await supabase
        .from('dose_check_offs')
        .delete()
        .eq('user_id', user.id)
        .eq('check_date', today)
        .eq('compound_id', compoundId)
        .eq('timing', timing)
        .eq('dose_index', doseIndex);
    } else {
      await supabase
        .from('dose_check_offs')
        .insert({
          user_id: user.id,
          check_date: today,
          compound_id: compoundId,
          timing,
          dose_index: doseIndex,
        });
    }
  }, [user, today, checkedDoses]);

  return { checkedDoses, toggleChecked, loading };
}
