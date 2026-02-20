import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, format, differenceInCalendarWeeks } from 'date-fns';

export interface WeeklyCompliancePoint {
  weekLabel: string;      // e.g. "Jan 6"
  weekStart: string;      // ISO date
  [compoundName: string]: number | string; // compliance rate 0-100 per compound
}

export interface CompoundMeta {
  compoundId: string;
  name: string;
  dosesPerDay: number;
  daysPerWeek: number;
  color: string;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(142 80% 50%)',
  'hsl(39 100% 55%)',
  'hsl(270 100% 65%)',
  'hsl(190 100% 50%)',
  'hsl(320 100% 60%)',
  'hsl(0 72% 51%)',
  'hsl(210 100% 60%)',
];

/**
 * Fetches weekly compliance trend data for all compounds with check-offs.
 * Groups dose_check_offs by week and compound, calculating the percentage
 * of expected doses that were actually checked off.
 */
export function useComplianceTrend(userId: string | undefined) {
  const [data, setData] = useState<WeeklyCompliancePoint[]>([]);
  const [compounds, setCompounds] = useState<CompoundMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId) {
      setData([]);
      setCompounds([]);
      setLoading(false);
      return;
    }

    // Fetch all check-offs and compound configs in parallel
    const [checkOffsRes, compoundsRes] = await Promise.all([
      supabase
        .from('dose_check_offs')
        .select('compound_id, check_date')
        .eq('user_id', userId)
        .order('check_date', { ascending: true }),
      supabase
        .from('user_compounds')
        .select('compound_id, name, doses_per_day, days_per_week')
        .eq('user_id', userId),
    ]);

    if (checkOffsRes.error || compoundsRes.error) {
      console.error('Compliance trend fetch error:', checkOffsRes.error || compoundsRes.error);
      setLoading(false);
      return;
    }

    const checkOffs = checkOffsRes.data || [];
    const userCompounds = compoundsRes.data || [];

    if (checkOffs.length === 0) {
      setData([]);
      setCompounds([]);
      setLoading(false);
      return;
    }

    // Build compound lookup
    const compoundMap = new Map<string, { name: string; dosesPerDay: number; daysPerWeek: number }>();
    userCompounds.forEach(c => {
      compoundMap.set(c.compound_id, {
        name: c.name,
        dosesPerDay: c.doses_per_day,
        daysPerWeek: c.days_per_week,
      });
    });

    // Find unique compounds that have check-offs
    const activeCompoundIds = [...new Set(checkOffs.map(c => c.compound_id))].filter(id => compoundMap.has(id));

    const meta: CompoundMeta[] = activeCompoundIds.map((id, i) => ({
      compoundId: id,
      name: compoundMap.get(id)!.name,
      dosesPerDay: compoundMap.get(id)!.dosesPerDay,
      daysPerWeek: compoundMap.get(id)!.daysPerWeek,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

    // Group check-offs by week and compound
    const weekMap = new Map<string, Map<string, number>>();
    checkOffs.forEach(co => {
      const ws = startOfWeek(new Date(co.check_date), { weekStartsOn: 1 });
      const wsKey = format(ws, 'yyyy-MM-dd');
      if (!weekMap.has(wsKey)) weekMap.set(wsKey, new Map());
      const compCounts = weekMap.get(wsKey)!;
      compCounts.set(co.compound_id, (compCounts.get(co.compound_id) || 0) + 1);
    });

    // Sort weeks chronologically and keep last 12
    const sortedWeeks = [...weekMap.keys()].sort();
    const recentWeeks = sortedWeeks.slice(-12);

    // Build chart data
    const points: WeeklyCompliancePoint[] = recentWeeks.map(wsKey => {
      const ws = new Date(wsKey);
      const compCounts = weekMap.get(wsKey)!;
      const point: WeeklyCompliancePoint = {
        weekLabel: format(ws, 'MMM d'),
        weekStart: wsKey,
      };

      meta.forEach(m => {
        const expectedPerWeek = m.dosesPerDay * m.daysPerWeek;
        const actual = compCounts.get(m.compoundId) || 0;
        point[m.name] = expectedPerWeek > 0
          ? Math.min(100, Math.round((actual / expectedPerWeek) * 100))
          : 0;
      });

      return point;
    });

    setData(points);
    setCompounds(meta);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, compounds, loading, refetch: fetch };
}
