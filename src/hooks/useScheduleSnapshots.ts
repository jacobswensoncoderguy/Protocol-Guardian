import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Compound } from '@/data/compounds';

export interface WeeklySnapshot {
  id: string;
  week_start_date: string;
  compound_snapshots: Compound[];
  created_at: string;
}

/** Get Monday of the week for a given date (ISO week) */
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useScheduleSnapshots(compounds: Compound[]) {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<WeeklySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart] = useState(() => getWeekStart(new Date()));

  // Auto-snapshot current week on first load (if not already exists)
  useEffect(() => {
    if (!user || compounds.length === 0) return;

    const ensureCurrentSnapshot = async () => {
      const { data: existing } = await supabase
        .from('weekly_schedule_snapshots')
        .select('id')
        .eq('user_id', user.id)
        .eq('week_start_date', currentWeekStart)
        .maybeSingle();

      if (!existing) {
        await supabase.from('weekly_schedule_snapshots').insert({
          user_id: user.id,
          week_start_date: currentWeekStart,
          compound_snapshots: JSON.parse(JSON.stringify(compounds)),
        });
      }
    };
    ensureCurrentSnapshot();
  }, [user, currentWeekStart, compounds.length > 0]);

  // Fetch all snapshots
  const fetchSnapshots = useCallback(async () => {
    if (!user) { setSnapshots([]); setLoading(false); return; }

    const { data } = await supabase
      .from('weekly_schedule_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('week_start_date', { ascending: false });

    if (data) {
      setSnapshots(data.map(r => ({
        id: r.id,
        week_start_date: r.week_start_date,
        compound_snapshots: (r.compound_snapshots as any) || [],
        created_at: r.created_at,
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSnapshots(); }, [fetchSnapshots]);

  return { snapshots, loading, currentWeekStart, refetch: fetchSnapshots };
}
