import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MeasurementSystem, DoseUnitPreference } from '@/lib/measurements';

export interface UserProfile {
  gender?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  body_fat_pct?: number | null;
  age?: number | null;
  display_name?: string | null;
  measurement_system?: MeasurementSystem;
  dose_unit_preference?: DoseUnitPreference;
}

export interface ToleranceEntry {
  tolerance_level: string;
  created_at: string;
}

export function useProfile(userId?: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [toleranceHistory, setToleranceHistory] = useState<ToleranceEntry[]>([]);
  const [currentTolerance, setCurrentToleranceState] = useState<string>('moderate');
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    const { data } = await (supabase as any)
      .from('profiles')
      .select('gender, height_cm, weight_kg, body_fat_pct, age, display_name, measurement_system, dose_unit_preference')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) setProfile(data);
  }, [userId]);

  const fetchToleranceHistory = useCallback(async () => {
    if (!userId) return;
    const { data } = await (supabase as any)
      .from('tolerance_history')
      .select('tolerance_level, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data && data.length > 0) {
      setToleranceHistory(data);
      setCurrentToleranceState(data[0].tolerance_level);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([fetchProfile(), fetchToleranceHistory()]).finally(() => setLoading(false));
  }, [userId, fetchProfile, fetchToleranceHistory]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!userId) return;
    const { error } = await (supabase as any)
      .from('profiles')
      .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) console.error('Failed to update profile:', error);
    else setProfile(prev => prev ? { ...prev, ...updates } : updates);
  }, [userId]);

  const setTolerance = useCallback(async (level: string) => {
    if (!userId) return;
    setCurrentToleranceState(level);
    const { error } = await (supabase as any)
      .from('tolerance_history')
      .insert({ user_id: userId, tolerance_level: level });
    if (error) console.error('Failed to save tolerance:', error);
    else {
      const entry: ToleranceEntry = { tolerance_level: level, created_at: new Date().toISOString() };
      setToleranceHistory(prev => [entry, ...prev]);
    }
  }, [userId]);

  const measurementSystem: MeasurementSystem = profile?.measurement_system || 'metric';
  const doseUnitPreference: DoseUnitPreference = profile?.dose_unit_preference || 'mg';

  return {
    profile,
    loading,
    updateProfile,
    fetchProfile,
    currentTolerance,
    setTolerance,
    toleranceHistory,
    measurementSystem,
    doseUnitPreference,
  };
}
