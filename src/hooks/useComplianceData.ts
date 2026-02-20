import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CompoundCompliance {
  compoundId: string;
  checkedDoses: number;
  firstCheckDate: string | null;
  lastCheckDate: string | null;
}

export interface ComplianceMap {
  /** Get compliance data for a specific compound */
  get(compoundId: string): CompoundCompliance | undefined;
  /** All compliance entries */
  entries: CompoundCompliance[];
  /** Whether the data is still loading */
  loading: boolean;
}

/**
 * Fetches dose check-off compliance data from the DB function.
 * Returns per-compound counts of actual checked doses,
 * which are used to adjust inventory and cost calculations.
 */
export function useComplianceData(userId: string | undefined): ComplianceMap {
  const [entries, setEntries] = useState<CompoundCompliance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompliance = useCallback(async () => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc('get_compound_compliance', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Failed to fetch compliance data:', error);
      setEntries([]);
    } else if (data) {
      setEntries(
        (data as any[]).map((row) => ({
          compoundId: row.compound_id,
          checkedDoses: Number(row.checked_doses),
          firstCheckDate: row.first_check_date,
          lastCheckDate: row.last_check_date,
        }))
      );
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchCompliance();
  }, [fetchCompliance]);

  // Re-fetch when dose_check_offs change
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`compliance:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dose_check_offs',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchCompliance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchCompliance]);

  const map = new Map(entries.map((e) => [e.compoundId, e]));

  return {
    get: (compoundId: string) => map.get(compoundId),
    entries,
    loading,
  };
}
