import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CheckOffKey {
  compoundId: string;
  timing: string;
  doseIndex: number;
}

function toKey(k: CheckOffKey): string {
  return `${k.compoundId}-${k.timing}-${k.doseIndex}`;
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr(): string {
  return dateStr(new Date());
}

/** Returns a YYYY-MM-DD string for a given day-of-week index (0=Sun…6=Sat)
 *  within a week offset from the current one (0=this week, -1=last week, etc.). */
function weekDayToDateStr(dayIndex: number, weekOffset: number = 0): string {
  const now = new Date();
  const todayDow = now.getDay();
  const diff = dayIndex - todayDow + (weekOffset * 7);
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  return dateStr(target);
}

export { weekDayToDateStr, todayStr };

export function useDoseCheckOffs(selectedDayIndex?: number, weekOffset: number = 0) {
  const { user } = useAuth();
  const [checkedDoses, setCheckedDoses] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Compute the target date string based on selected day and week offset
  const targetDate = selectedDayIndex !== undefined
    ? weekDayToDateStr(selectedDayIndex, weekOffset)
    : todayStr();

  // Load check-offs for the target date
  useEffect(() => {
    if (!user) { setCheckedDoses(new Set()); setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('dose_check_offs')
        .select('compound_id, timing, dose_index')
        .eq('user_id', user.id)
        .eq('check_date', targetDate);

      if (data) {
        const keys = new Set(data.map(r => toKey({
          compoundId: r.compound_id,
          timing: r.timing,
          doseIndex: r.dose_index,
        })));
        setCheckedDoses(keys);
      }
      setLoading(false);
    };
    load();
  }, [user, targetDate]);

  const toggleChecked = useCallback(async (key: string) => {
    if (!user) return;

    // Parse key back: "compoundId-timing-index"
    const lastDash = key.lastIndexOf('-');
    const doseIndex = parseInt(key.substring(lastDash + 1), 10);
    const rest = key.substring(0, lastDash);
    const secondLastDash = rest.lastIndexOf('-');
    const timing = rest.substring(secondLastDash + 1);
    const compoundId = rest.substring(0, secondLastDash);

    const isCurrentlyChecked = checkedDoses.has(key);

    // Optimistic update
    setCheckedDoses(prev => {
      const next = new Set(prev);
      if (isCurrentlyChecked) next.delete(key);
      else next.add(key);
      return next;
    });

    if (isCurrentlyChecked) {
      await supabase
        .from('dose_check_offs')
        .delete()
        .eq('user_id', user.id)
        .eq('check_date', targetDate)
        .eq('compound_id', compoundId)
        .eq('timing', timing)
        .eq('dose_index', doseIndex);
    } else {
      await supabase
        .from('dose_check_offs')
        .insert({
          user_id: user.id,
          check_date: targetDate,
          compound_id: compoundId,
          timing,
          dose_index: doseIndex,
        });
    }
  }, [user, targetDate, checkedDoses]);

  return { checkedDoses, toggleChecked, loading };
}
