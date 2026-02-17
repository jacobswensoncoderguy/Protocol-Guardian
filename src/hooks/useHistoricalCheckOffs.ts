import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Fetch all historical dose check-offs grouped by date.
 * Returns a Map<date_string, Set<check_key>>
 */
export function useHistoricalCheckOffs() {
  const { user } = useAuth();
  const [data, setData] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) { setData(new Map()); setLoading(false); return; }

    const { data: rows } = await supabase
      .from('dose_check_offs')
      .select('check_date, compound_id, timing, dose_index')
      .eq('user_id', user.id)
      .order('check_date', { ascending: false });

    if (rows) {
      const map = new Map<string, Set<string>>();
      rows.forEach(r => {
        const key = `${r.compound_id}-${r.timing}-${r.dose_index}`;
        if (!map.has(r.check_date)) map.set(r.check_date, new Set());
        map.get(r.check_date)!.add(key);
      });
      setData(map);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  return { checkedDosesMap: data, loading, refetch: fetch };
}
