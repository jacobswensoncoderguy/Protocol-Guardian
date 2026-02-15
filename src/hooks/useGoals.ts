import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserGoal {
  id?: string;
  goal_type: string;
  title: string;
  description?: string;
  body_area?: string;
  target_value?: number;
  target_unit?: string;
  baseline_value?: number;
  current_value?: number;
  target_date?: string;
  status: string;
  priority: number;
}

export function useGoals(userId?: string) {
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGoals = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('user_goals')
      .select('*')
      .eq('user_id', userId)
      .order('priority', { ascending: true });
    if (!error && data) {
      setGoals(data as UserGoal[]);
    }
    setLoading(false);
  }, [userId]);

  const createGoals = useCallback(async (newGoals: Omit<UserGoal, 'id' | 'status'>[]) => {
    if (!userId) return;
    const rows = newGoals.map(g => ({
      user_id: userId,
      goal_type: g.goal_type,
      title: g.title,
      description: g.description || null,
      body_area: g.body_area || null,
      target_value: g.target_value || null,
      target_unit: g.target_unit || null,
      baseline_value: g.baseline_value || null,
      current_value: g.current_value || null,
      target_date: g.target_date || null,
      status: 'active',
      priority: g.priority || 2,
    }));
    const { error } = await (supabase as any).from('user_goals').insert(rows);
    if (error) console.error('Failed to create goals:', error);
    else await fetchGoals();
  }, [userId, fetchGoals]);

  const saveOnboarding = useCallback(async (responses: Record<string, unknown>, aiConversation?: string) => {
    if (!userId) return;
    const { error } = await (supabase as any).from('user_onboarding').upsert({
      user_id: userId,
      responses,
      ai_conversation: aiConversation || null,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) console.error('Failed to save onboarding:', error);
  }, [userId]);

  return { goals, loading, fetchGoals, createGoals, saveOnboarding };
}
