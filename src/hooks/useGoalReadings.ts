import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GoalReading {
  id: string;
  user_goal_id: string;
  value: number;
  unit: string;
  reading_date: string;
  notes: string | null;
  source: string | null;
}

export function useGoalReadings(userId?: string) {
  const [readings, setReadings] = useState<Map<string, GoalReading[]>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchReadings = useCallback(async (goalIds: string[]) => {
    if (!userId || goalIds.length === 0) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('user_goal_readings')
      .select('*')
      .eq('user_id', userId)
      .in('user_goal_id', goalIds)
      .order('reading_date', { ascending: true });

    if (!error && data) {
      const grouped = new Map<string, GoalReading[]>();
      (data as GoalReading[]).forEach(r => {
        const arr = grouped.get(r.user_goal_id) || [];
        arr.push(r);
        grouped.set(r.user_goal_id, arr);
      });
      setReadings(grouped);
    }
    setLoading(false);
  }, [userId]);

  const addReading = useCallback(async (goalId: string, value: number, unit: string, notes?: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from('user_goal_readings')
      .insert({
        user_id: userId,
        user_goal_id: goalId,
        value,
        unit,
        reading_date: new Date().toISOString().split('T')[0],
        notes: notes || null,
      });
    if (error) console.error('Failed to add reading:', error);
    else await fetchReadings([goalId]);
  }, [userId, fetchReadings]);

  return { readings, loading, fetchReadings, addReading };
}
