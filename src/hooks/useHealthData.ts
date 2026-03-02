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

      await Health.requestHealthPermissions({
        permissions: [
          'READ_STEPS',
          'READ_ACTIVE_CALORIES',
          'READ_HEART_RATE' as any,
          'READ_SLEEP' as any,
          'READ_ACTIVE_MINUTES' as any,
        ],
      });

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const queryOpts = (dataType: string) => ({
        dataType: dataType as any,
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day' as const,
      });

      const [stepsRes, caloriesRes, heartRateRes, sleepRes, activeMinRes] = await Promise.allSettled([
        Health.queryAggregated(queryOpts('steps')),
        Health.queryAggregated(queryOpts('active-calories')),
        Health.queryAggregated(queryOpts('heart-rate')),
        Health.queryAggregated(queryOpts('sleep')),
        Health.queryAggregated(queryOpts('active-minutes')),
      ]);

      const stepsVal = stepsRes.status === 'fulfilled'
        ? stepsRes.value.aggregatedData.reduce((s, d) => s + d.value, 0)
        : 0;
      const calsVal = caloriesRes.status === 'fulfilled'
        ? caloriesRes.value.aggregatedData.reduce((s, d) => s + d.value, 0)
        : 0;
      const hrVal = heartRateRes.status === 'fulfilled' && heartRateRes.value.aggregatedData.length > 0
        ? heartRateRes.value.aggregatedData[heartRateRes.value.aggregatedData.length - 1].value
        : 0;
      const sleepVal = sleepRes.status === 'fulfilled'
        ? sleepRes.value.aggregatedData.reduce((s, d) => s + d.value, 0)
        : 0;
      const activeMinVal = activeMinRes.status === 'fulfilled'
        ? activeMinRes.value.aggregatedData.reduce((s, d) => s + d.value, 0)
        : 0;

      setMetrics({
        steps: Math.round(stepsVal),
        calories: Math.round(calsVal),
        heartRate: Math.round(hrVal),
        sleepMinutes: Math.round(sleepVal),
        activeMinutes: Math.round(activeMinVal),
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
