import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

export interface HealthMetrics {
  steps: number;
  calories: number;
  heartRate: number;
  sleepMinutes: number;
  activeMinutes: number;
  available: boolean;
  loading: boolean;
  error: string | null;
}

const DEFAULT_METRICS: HealthMetrics = {
  steps: 0,
  calories: 0,
  heartRate: 0,
  sleepMinutes: 0,
  activeMinutes: 0,
  available: false,
  loading: false,
  error: null,
};

/**
 * Hook that reads today's health data from Apple HealthKit / Google Health Connect
 * via the `capacitor-health` plugin. Falls back gracefully on web.
 *
 * Supported by the plugin's queryAggregated:
 *   - steps, active-calories (dataType enum)
 * Heart rate is fetched from today's workouts (queryWorkouts with includeHeartRate).
 * Sleep and active minutes are NOT supported by this plugin — they stay at 0.
 */
export function useHealthData() {
  const [metrics, setMetrics] = useState<HealthMetrics>(DEFAULT_METRICS);

  const isNative = Capacitor.isNativePlatform();

  const refresh = useCallback(async () => {
    if (!isNative) {
      setMetrics(prev => ({ ...prev, available: false }));
      return;
    }

    setMetrics(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { Health } = await import('capacitor-health');

      const { available } = await Health.isHealthAvailable();
      if (!available) {
        setMetrics(prev => ({ ...prev, available: false, loading: false }));
        return;
      }

      // Only request permissions the plugin actually supports
      await Health.requestHealthPermissions({
        permissions: [
          'READ_STEPS',
          'READ_ACTIVE_CALORIES',
          'READ_HEART_RATE',
        ],
      });

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Query steps and active calories (the only two supported aggregated types)
      const [stepsRes, caloriesRes] = await Promise.allSettled([
        Health.queryAggregated({
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          dataType: 'steps',
          bucket: 'day',
        }),
        Health.queryAggregated({
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          dataType: 'active-calories',
          bucket: 'day',
        }),
      ]);

      const stepsVal = stepsRes.status === 'fulfilled'
        ? stepsRes.value.aggregatedData.reduce((s, d) => s + d.value, 0)
        : 0;
      const calsVal = caloriesRes.status === 'fulfilled'
        ? caloriesRes.value.aggregatedData.reduce((s, d) => s + d.value, 0)
        : 0;

      // Get heart rate from today's workouts (best available source via this plugin)
      let hrVal = 0;
      let activeMinVal = 0;
      try {
        const workoutsRes = await Health.queryWorkouts({
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          includeHeartRate: true,
          includeRoute: false,
          includeSteps: false,
        });
        if (workoutsRes.workouts && workoutsRes.workouts.length > 0) {
          // Sum workout durations for active minutes
          activeMinVal = workoutsRes.workouts.reduce(
            (sum, w) => sum + Math.round((w.duration || 0) / 60),
            0
          );
          // Get latest heart rate sample from the most recent workout
          const lastWorkout = workoutsRes.workouts[workoutsRes.workouts.length - 1];
          if (lastWorkout.heartRate && lastWorkout.heartRate.length > 0) {
            hrVal = lastWorkout.heartRate[lastWorkout.heartRate.length - 1].bpm;
          }
        }
      } catch (e) {
        console.warn('[useHealthData] workout query failed:', e);
      }

      setMetrics({
        steps: Math.round(stepsVal),
        calories: Math.round(calsVal),
        heartRate: Math.round(hrVal),
        sleepMinutes: 0, // not supported by this plugin
        activeMinutes: activeMinVal,
        available: true,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      console.error('[useHealthData]', err);
      setMetrics(prev => ({
        ...prev,
        loading: false,
        error: err?.message || 'Failed to read health data',
      }));
    }
  }, [isNative]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...metrics, refresh };
}
