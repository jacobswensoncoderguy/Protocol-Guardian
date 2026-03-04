import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MeasurementSystem, DoseUnitPreference } from '@/lib/measurements';
import { AppFeatures, DEFAULT_APP_FEATURES } from '@/lib/appFeatures';

export interface UserProfile {
  gender?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  body_fat_pct?: number | null;
  age?: number | null;
  display_name?: string | null;
  measurement_system?: MeasurementSystem;
  dose_unit_preference?: DoseUnitPreference;
  app_features?: AppFeatures | null;
  reorder_horizon?: number | null;
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
      .select('gender, height_cm, weight_kg, body_fat_pct, age, display_name, measurement_system, dose_unit_preference, app_features, reorder_horizon')
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
    const upsertData: any = { user_id: userId, ...updates, updated_at: new Date().toISOString() };

    // Attach referrer on first profile creation
    const referrerId = sessionStorage.getItem('referrer_id');
    if (referrerId && referrerId !== userId) {
      upsertData.referred_by = referrerId;
      sessionStorage.removeItem('referrer_id');
    }

    const { error } = await (supabase as any)
      .from('profiles')
      .upsert(upsertData, { onConflict: 'user_id' });
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

  const measurementSystem: MeasurementSystem = profile?.measurement_system || 'imperial';
  const doseUnitPreference: DoseUnitPreference = profile?.dose_unit_preference || 'mg';
  const appFeatures: AppFeatures = (profile?.app_features as AppFeatures) || DEFAULT_APP_FEATURES;
  const reorderHorizon: 30 | 45 | 60 = ([30, 45, 60].includes(profile?.reorder_horizon ?? 30)
    ? (profile?.reorder_horizon ?? 30)
    : 30) as 30 | 45 | 60;

  const updateAppFeatures = useCallback(async (features: AppFeatures) => {
    await updateProfile({ app_features: features } as any);
  }, [updateProfile]);

  const updateReorderHorizon = useCallback(async (h: 30 | 45 | 60) => {
    await updateProfile({ reorder_horizon: h });
  }, [updateProfile]);

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
    appFeatures,
    updateAppFeatures,
    reorderHorizon,
    updateReorderHorizon,
  };
}
