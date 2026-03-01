import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TitrationStep {
  id: string;
  schedule_id: string;
  step_number: number;
  dose_amount: number;
  dose_unit: string;
  start_date: string;
  end_date: string | null;
  duration_days: number | null;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  confirmed_at: string | null;
  confirmed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface TitrationSchedule {
  id: string;
  user_id: string;
  user_compound_id: string;
  name: string;
  start_date: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  steps: TitrationStep[];
}

export interface TitrationNotification {
  id: string;
  user_id: string;
  schedule_id: string;
  step_id: string;
  notification_type: 'step_due' | 'step_upcoming' | 'schedule_complete';
  is_read: boolean;
  is_actioned: boolean;
  created_at: string;
}

export function useTitration(userId?: string) {
  const [schedules, setSchedules] = useState<TitrationSchedule[]>([]);
  const [notifications, setNotifications] = useState<TitrationNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = useCallback(async () => {
    if (!userId) { setSchedules([]); setLoading(false); return; }
    
    const { data: schedData } = await supabase
      .from('titration_schedules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!schedData || schedData.length === 0) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    const schedIds = schedData.map(s => s.id);
    const { data: stepsData } = await supabase
      .from('titration_steps')
      .select('*')
      .in('schedule_id', schedIds)
      .order('step_number', { ascending: true });

    const stepsMap = new Map<string, TitrationStep[]>();
    (stepsData || []).forEach(step => {
      const list = stepsMap.get(step.schedule_id) || [];
      list.push(step as TitrationStep);
      stepsMap.set(step.schedule_id, list);
    });

    const result: TitrationSchedule[] = schedData.map(s => ({
      ...s,
      status: s.status as TitrationSchedule['status'],
      steps: stepsMap.get(s.id) || [],
    }));

    setSchedules(result);
    setLoading(false);
  }, [userId]);

  const fetchNotifications = useCallback(async () => {
    if (!userId) { setNotifications([]); return; }
    const { data } = await supabase
      .from('titration_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_actioned', false)
      .order('created_at', { ascending: false });
    setNotifications((data || []) as TitrationNotification[]);
  }, [userId]);

  useEffect(() => {
    fetchSchedules();
    fetchNotifications();
  }, [fetchSchedules, fetchNotifications]);

  // Check and create notifications for due steps
  const checkDueSteps = useCallback(async () => {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];
    
    for (const schedule of schedules) {
      if (schedule.status !== 'active') continue;
      for (const step of schedule.steps) {
        if (step.status !== 'pending') continue;
        if (step.start_date <= today) {
          // Check if notification already exists
          const existing = notifications.find(n => n.step_id === step.id && n.notification_type === 'step_due');
          if (!existing) {
            await supabase.from('titration_notifications').insert({
              user_id: userId,
              schedule_id: schedule.id,
              step_id: step.id,
              notification_type: 'step_due',
            });
          }
        }
      }
    }
    await fetchNotifications();
  }, [userId, schedules, notifications, fetchNotifications]);

  useEffect(() => {
    if (schedules.length > 0) checkDueSteps();
  }, [schedules]);

  const createSchedule = useCallback(async (
    compoundId: string,
    name: string,
    startDate: string,
    steps: { dose_amount: number; dose_unit: string; start_date: string; end_date?: string; duration_days?: number; notes?: string }[],
    notes?: string,
  ) => {
    if (!userId) return null;

    const { data: sched, error: schedError } = await supabase
      .from('titration_schedules')
      .insert({
        user_id: userId,
        user_compound_id: compoundId,
        name,
        start_date: startDate,
        notes: notes || null,
      })
      .select()
      .single();

    if (schedError || !sched) return null;

    const stepRows = steps.map((s, i) => ({
      schedule_id: sched.id,
      step_number: i + 1,
      dose_amount: s.dose_amount,
      dose_unit: s.dose_unit,
      start_date: s.start_date,
      end_date: s.end_date || null,
      duration_days: s.duration_days || null,
      notes: s.notes || null,
      status: i === 0 && s.start_date <= new Date().toISOString().split('T')[0] ? 'active' : 'pending',
    }));

    await supabase.from('titration_steps').insert(stepRows);
    await fetchSchedules();
    return sched;
  }, [userId, fetchSchedules]);

  const confirmStep = useCallback(async (stepId: string, scheduleId: string) => {
    if (!userId) return;

    // Find the step being confirmed to get its dose
    const schedule = schedules.find(s => s.id === scheduleId);
    const confirmedStep = schedule?.steps.find(s => s.id === stepId);

    // Mark step as completed
    await supabase.from('titration_steps').update({
      status: 'completed',
      confirmed_at: new Date().toISOString(),
      confirmed_by: userId,
    }).eq('id', stepId);

    // Mark notification as actioned
    await supabase.from('titration_notifications').update({
      is_actioned: true,
    }).eq('step_id', stepId).eq('user_id', userId);

    // Update the compound's dose_per_use to match the confirmed step
    if (schedule && confirmedStep) {
      await supabase.from('user_compounds').update({
        dose_per_use: confirmedStep.dose_amount,
      }).eq('id', schedule.user_compound_id);
    }

    // Activate next pending step
    if (schedule) {
      const nextStep = schedule.steps.find(s => s.status === 'pending');
      if (nextStep) {
        await supabase.from('titration_steps').update({ status: 'active' }).eq('id', nextStep.id);
      } else {
        // All steps done — complete schedule
        await supabase.from('titration_schedules').update({ status: 'completed' }).eq('id', scheduleId);
      }
    }

    await fetchSchedules();
    await fetchNotifications();
  }, [userId, schedules, fetchSchedules, fetchNotifications]);

  const skipStep = useCallback(async (stepId: string) => {
    if (!userId) return;
    await supabase.from('titration_steps').update({ status: 'skipped' }).eq('id', stepId);
    await supabase.from('titration_notifications').update({ is_actioned: true }).eq('step_id', stepId);
    await fetchSchedules();
    await fetchNotifications();
  }, [userId, fetchSchedules, fetchNotifications]);

  const deleteSchedule = useCallback(async (scheduleId: string) => {
    await supabase.from('titration_schedules').delete().eq('id', scheduleId);
    await fetchSchedules();
  }, [fetchSchedules]);

  const cancelSchedule = useCallback(async (scheduleId: string) => {
    await supabase.from('titration_schedules').update({ status: 'cancelled' }).eq('id', scheduleId);
    await fetchSchedules();
  }, [fetchSchedules]);

  // Get schedule for a specific compound
  const getScheduleForCompound = useCallback((compoundId: string): TitrationSchedule | undefined => {
    return schedules.find(s => s.user_compound_id === compoundId && s.status === 'active');
  }, [schedules]);

  // Get current active step for a compound
  const getCurrentStep = useCallback((compoundId: string): TitrationStep | undefined => {
    const schedule = getScheduleForCompound(compoundId);
    if (!schedule) return undefined;
    return schedule.steps.find(s => s.status === 'active') || schedule.steps.find(s => s.status === 'pending');
  }, [getScheduleForCompound]);

  // Get due notifications count
  const dueCount = notifications.filter(n => !n.is_actioned).length;

  return {
    schedules,
    notifications,
    loading,
    dueCount,
    createSchedule,
    confirmStep,
    skipStep,
    deleteSchedule,
    cancelSchedule,
    getScheduleForCompound,
    getCurrentStep,
    fetchSchedules,
    fetchNotifications,
  };
}
