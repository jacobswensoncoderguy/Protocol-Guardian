import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, ArrowRightLeft, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, parseISO,
  addMonths, subMonths, isSameMonth, getDay, isSameDay,
} from 'date-fns';

interface DayData {
  date: string; // YYYY-MM-DD
  avgSeverity: number; // 0–5
  count: number;
  symptoms: { name: string; severity: number; category: string }[];
  hasChange: boolean;
  changes: string[];
}

const SEVERITY_COLORS = [
  'bg-transparent',                                           // 0 – no data
  'bg-status-good/30 hover:bg-status-good/50',               // 1 – minimal
  'bg-status-warning/25 hover:bg-status-warning/40',         // 2 – mild
  'bg-status-warning/55 hover:bg-status-warning/70',         // 3 – moderate
  'bg-destructive/50 hover:bg-destructive/65',               // 4 – severe
  'bg-destructive/85 hover:bg-destructive',                  // 5 – extreme
];

const SEVERITY_LABELS = ['None', 'Minimal', 'Mild', 'Moderate', 'Severe', 'Extreme'];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SymptomHeatmapView() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dayMap, setDayMap] = useState<Record<string, DayData>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [definitions, setDefinitions] = useState<Record<string, { name: string; category: string }>>({});

  const fetchMonth = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setSelectedDay(null);

    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const [logsRes, changesRes, defsRes] = await Promise.all([
      supabase.from('symptom_logs').select('*').eq('user_id', user.id).gte('log_date', start).lte('log_date', end),
      supabase.from('protocol_changes').select('*').eq('user_id', user.id).gte('change_date', start).lte('change_date', end),
      supabase.from('symptom_definitions').select('id, name, category'),
    ]);

    const defMap: Record<string, { name: string; category: string }> = {};
    (defsRes.data || []).forEach((d: any) => { defMap[d.id] = { name: d.name, category: d.category }; });
    setDefinitions(defMap);

    const map: Record<string, DayData> = {};

    (logsRes.data || []).forEach((log: any) => {
      const date = log.log_date;
      if (!map[date]) map[date] = { date, avgSeverity: 0, count: 0, symptoms: [], hasChange: false, changes: [] };
      const name = log.custom_symptom || defMap[log.symptom_definition_id]?.name || 'Unknown';
      const category = defMap[log.symptom_definition_id]?.category || 'custom';
      map[date].symptoms.push({ name, severity: log.severity, category });
      map[date].count++;
    });

    // Compute avg severity per day
    Object.values(map).forEach(d => {
      if (d.count > 0) {
        d.avgSeverity = Math.round(d.symptoms.reduce((s, sym) => s + sym.severity, 0) / d.count);
      }
    });

    (changesRes.data || []).forEach((ch: any) => {
      const date = ch.change_date;
      if (!map[date]) map[date] = { date, avgSeverity: 0, count: 0, symptoms: [], hasChange: false, changes: [] };
      map[date].hasChange = true;
      map[date].changes.push(ch.description);
    });

    setDayMap(map);
    setLoading(false);
  }, [user, currentMonth]);

  useEffect(() => { fetchMonth(); }, [fetchMonth]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Leading blank cells to align first day to correct weekday
  const leadingBlanks = useMemo(() => {
    return getDay(startOfMonth(currentMonth)); // 0=Sun
  }, [currentMonth]);

  // Severity stats for the month
  const monthStats = useMemo(() => {
    const vals = Object.values(dayMap);
    const withSymptoms = vals.filter(d => d.count > 0);
    if (withSymptoms.length === 0) return null;
    const totalLogs = withSymptoms.reduce((s, d) => s + d.count, 0);
    const avgSev = (withSymptoms.reduce((s, d) => s + d.avgSeverity, 0) / withSymptoms.length).toFixed(1);
    const worstDay = withSymptoms.reduce((a, b) => a.avgSeverity > b.avgSeverity ? a : b);
    const changeDays = vals.filter(d => d.hasChange).length;
    return { totalLogs, avgSev, worstDay, changeDays, trackedDays: withSymptoms.length };
  }, [dayMap]);

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth(m => subMonths(m, 1))}
          className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <h3 className="text-sm font-bold text-foreground">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <button
          onClick={() => setCurrentMonth(m => addMonths(m, 1))}
          className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors"
          disabled={isSameMonth(addMonths(currentMonth, 1), new Date()) || addMonths(currentMonth, 1) > new Date()}
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Month stats strip */}
      {monthStats && (
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: 'Logs', value: monthStats.totalLogs },
            { label: 'Days tracked', value: monthStats.trackedDays },
            { label: 'Avg severity', value: monthStats.avgSev },
            { label: 'Changes', value: monthStats.changeDays },
          ].map(s => (
            <div key={s.label} className="p-2 rounded-lg bg-secondary/30 text-center">
              <div className="text-sm font-bold text-foreground">{s.value}</div>
              <div className="text-[9px] text-muted-foreground leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Calendar heatmap */}
      <Card className="border-border/50">
        <CardContent className="p-3">
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAY_LABELS.map(d => (
                  <div key={d} className="text-center text-[9px] font-semibold text-muted-foreground py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Leading blanks */}
                {Array.from({ length: leadingBlanks }).map((_, i) => (
                  <div key={`blank-${i}`} />
                ))}

                {/* Day cells */}
                {days.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const data = dayMap[dateStr];
                  const sev = data?.count > 0 ? data.avgSeverity : 0;
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDay?.date === dateStr;
                  const isChange = data?.hasChange;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDay(isSelected ? null : (data || null))}
                      className={`
                        relative aspect-square rounded-md flex flex-col items-center justify-center
                        transition-all duration-150 cursor-pointer border
                        ${sev > 0 ? SEVERITY_COLORS[sev] : 'bg-secondary/20 hover:bg-secondary/40'}
                        ${isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-card' : 'border-transparent'}
                        ${isToday ? 'border-primary/60' : 'border-transparent'}
                      `}
                    >
                      <span className={`text-[10px] font-semibold leading-none ${
                        sev >= 4 ? 'text-white' : sev > 0 ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {format(day, 'd')}
                      </span>
                      {/* Protocol change dot */}
                      {isChange && (
                        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-status-warning" />
                      )}
                      {/* Count badge for days with many symptoms */}
                      {data?.count > 1 && (
                        <span className="absolute top-0.5 right-0.5 text-[7px] font-bold leading-none opacity-70">
                          {data.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-muted-foreground">Severity:</span>
          {[1, 2, 3, 4, 5].map(s => (
            <div
              key={s}
              className={`w-4 h-4 rounded-sm ${SEVERITY_COLORS[s].split(' ')[0]}`}
              title={SEVERITY_LABELS[s]}
            />
          ))}
          <span className="text-[9px] text-muted-foreground ml-1">low → high</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-status-warning" />
          <span className="text-[9px] text-muted-foreground">Protocol change</span>
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>{format(parseISO(selectedDay.date), 'EEE, MMMM d')}</span>
              {selectedDay.count > 0 && (
                <Badge variant="outline" className="text-[10px] h-5">
                  {SEVERITY_LABELS[selectedDay.avgSeverity]}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 space-y-2">
            {/* Protocol changes */}
            {selectedDay.hasChange && (
              <div className="space-y-1">
                {selectedDay.changes.map((ch, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <ArrowRightLeft className="w-3 h-3 text-status-warning flex-shrink-0 mt-0.5" />
                    <span className="text-[11px] text-foreground">{ch}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Symptoms */}
            {selectedDay.count > 0 ? (
              <div className="space-y-1">
                {selectedDay.symptoms
                  .sort((a, b) => b.severity - a.severity)
                  .map((sym, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[11px] text-foreground">{sym.name}</span>
                        <Badge variant="outline" className="text-[9px] h-3.5 capitalize px-1">{sym.category}</Badge>
                      </div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(dot => (
                          <div
                            key={dot}
                            className={`w-1.5 h-1.5 rounded-full ${dot <= sym.severity ? 'bg-destructive' : 'bg-secondary'}`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {selectedDay.hasChange ? 'No symptoms logged this day.' : 'No data for this day.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && Object.keys(dayMap).length === 0 && (
        <Card className="border-border/50">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No symptom data for {format(currentMonth, 'MMMM')}</p>
            <p className="text-xs text-muted-foreground mt-1">Log symptoms in the Symptoms tab to see your heatmap</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-1.5 p-2 rounded-lg bg-secondary/20">
        <Info className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-muted-foreground">Tap any day to see symptom details. Numbers show total symptom entries. Orange dots mark protocol changes.</p>
      </div>
    </div>
  );
}
