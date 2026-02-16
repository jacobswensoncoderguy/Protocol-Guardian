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
  baseline_date?: string;
  baseline_label?: string;
  target_label?: string;
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

  const updateGoal = useCallback(async (goalId: string, updates: Partial<UserGoal>) => {
    if (!userId) return;
    // Optimistic update
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, ...updates } : g));

    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.goal_type !== undefined) dbUpdates.goal_type = updates.goal_type;
    if (updates.body_area !== undefined) dbUpdates.body_area = updates.body_area;
    if (updates.target_value !== undefined) dbUpdates.target_value = updates.target_value;
    if (updates.target_unit !== undefined) dbUpdates.target_unit = updates.target_unit;
    if (updates.baseline_value !== undefined) dbUpdates.baseline_value = updates.baseline_value;
    if (updates.current_value !== undefined) dbUpdates.current_value = updates.current_value;
    if (updates.target_date !== undefined) dbUpdates.target_date = updates.target_date;
    if (updates.baseline_date !== undefined) dbUpdates.baseline_date = updates.baseline_date;
    if (updates.baseline_label !== undefined) dbUpdates.baseline_label = updates.baseline_label;
    if (updates.target_label !== undefined) dbUpdates.target_label = updates.target_label;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;

    const { error } = await (supabase as any)
      .from('user_goals')
      .update(dbUpdates)
      .eq('id', goalId);

    if (error) {
      console.error('Failed to update goal:', error);
      await fetchGoals(); // rollback
    }
  }, [userId, fetchGoals]);

  const deleteGoal = useCallback(async (goalId: string) => {
    if (!userId) return;
    setGoals(prev => prev.filter(g => g.id !== goalId));

    const { error } = await (supabase as any)
      .from('user_goals')
      .delete()
      .eq('id', goalId);

    if (error) {
      console.error('Failed to delete goal:', error);
      await fetchGoals();
    }
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

  return { goals, loading, fetchGoals, createGoals, updateGoal, deleteGoal, saveOnboarding };
}
