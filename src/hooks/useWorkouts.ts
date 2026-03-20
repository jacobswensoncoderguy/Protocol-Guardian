import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WorkoutSession {
  id: string;
  user_id: string;
  session_date: string;
  workout_type: string | null;
  program_name: string | null;
  source: string;
  external_id: string | null;
  duration_minutes: number | null;
  total_volume_lbs: number | null;
  calories_burned: number | null;
  avg_heart_rate: number | null;
  hrv_post_workout: number | null;
  notes: string | null;
  created_at: string;
}

export interface WorkoutSet {
  id: string;
  session_id: string;
  user_id: string;
  exercise_name: string;
  muscle_group: string | null;
  set_number: number | null;
  reps: number | null;
  weight_lbs: number | null;
  is_personal_record: boolean;
  rpe: number | null;
  created_at: string;
}

export function useWorkouts(userId?: string) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    if (!userId) { setSessions([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('session_date', { ascending: false })
      .limit(50);

    if (!error && data) setSessions(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const addSession = useCallback(async (session: Omit<WorkoutSession, 'id' | 'created_at'>) => {
    const { data, error } = await (supabase as any)
      .from('workout_sessions')
      .insert([session])
      .select()
      .single();
    if (!error && data) {
      setSessions(prev => [data, ...prev]);
      return data.id as string;
    }
    return null;
  }, []);

  const addSets = useCallback(async (sets: Array<Omit<WorkoutSet, 'id' | 'created_at'>>) => {
    if (sets.length === 0) return;
    const { error } = await (supabase as any)
      .from('workout_sets')
      .insert(sets);
    if (error) console.error('Failed to insert workout sets:', error);
  }, []);

  const fetchSetsForSession = useCallback(async (sessionId: string): Promise<WorkoutSet[]> => {
    const { data, error } = await (supabase as any)
      .from('workout_sets')
      .select('*')
      .eq('session_id', sessionId)
      .order('set_number', { ascending: true });
    if (error) return [];
    return data || [];
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    await (supabase as any).from('workout_sessions').delete().eq('id', sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  }, []);

  // Weekly stats
  const thisWeekSessions = sessions.filter(s => {
    const d = new Date(s.session_date);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return d >= weekStart;
  });

  const weeklyVolume = thisWeekSessions.reduce((sum, s) => sum + (s.total_volume_lbs || 0), 0);
  const weeklyWorkoutCount = thisWeekSessions.length;

  return {
    sessions,
    loading,
    addSession,
    addSets,
    fetchSetsForSession,
    deleteSession,
    refetch: fetchSessions,
    thisWeekSessions,
    weeklyVolume,
    weeklyWorkoutCount,
  };
}
