import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import DailyCompletionCelebration from '@/components/DailyCompletionCelebration';
import { DayDose } from '@/data/schedule';
import { weekDayToDateStr } from '@/hooks/useDoseCheckOffs';
import { useAuth } from '@/hooks/useAuth';
import { Compound } from '@/data/compounds';
import { getCycleStatus, isPaused } from '@/lib/cycling';
import { generateScheduleFromCompounds } from '@/lib/scheduleGenerator';
import { CustomField } from '@/hooks/useCustomFields';
import { UserProtocol } from '@/hooks/useProtocols';
import { getCompoundScores, getDeliveryLabel, CompoundScores } from '@/data/compoundScores';
import CompoundScoreDrawer from '@/components/CompoundScoreDrawer';
import { supabase } from '@/integrations/supabase/client';
import { Sun, Moon, Dumbbell, Info, Syringe, Pause, Check, ArrowLeft, Search, X, ChevronLeft, ChevronRight, Calendar, Beaker, FlaskConical, Target } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarWidget } from '@/components/ui/calendar';

const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getScheduledDays(note: string, dpw: number): number[] {
  const n = note.toLowerCase();
  // Priority: daily/nightly/every day or dpw===7 → all 7 days
  if (dpw === 7 || /\bdaily\b|\bnightly\b|\bevery\s*day\b/i.test(n)) return [0,1,2,3,4,5,6];
  if (/\bm[\/-]f\b|mon[\s-]*fri/i.test(n)) return [1,2,3,4,5];
  if (/\bm\/w\/f\b/i.test(n)) return [1,3,5];
  if (/\bt\/th\b/i.test(n)) return [2,4];
  if (/\bm\/f\b/i.test(n)) return [1,5];
  // Extract individual day names (broader regex matching scheduleGenerator)
  const dayMap: Record<string, number> = { su:0, sun:0, sunday:0, mo:1, mon:1, monday:1, tu:2, tue:2, tues:2, tuesday:2, we:3, wed:3, wednesday:3, th:4, thu:4, thurs:4, thursday:4, fr:5, fri:5, friday:5, sa:6, sat:6, saturday:6 };
  const matches = n.match(/\b(su(?:n(?:day)?)?|mo(?:n(?:day)?)?|tu(?:e(?:s(?:day)?)?)?|we(?:d(?:nesday)?)?|th(?:u(?:rs(?:day)?)?)?|fr(?:i(?:day)?)?|sa(?:t(?:urday)?)?)\b/gi);
  if (matches && matches.length > 0) {
    const days = new Set<number>();
    matches.forEach(m => { const i = dayMap[m.toLowerCase()]; if (i !== undefined) days.add(i); });
    if (days.size > 0) return Array.from(days).sort();
  }
  // Fall back to dpw count using standard patterns
  switch (dpw) {
    case 6: return [1,2,3,4,5,6];
    case 5: return [1,2,3,4,5];
    case 4: return [1,2,4,5];
    case 3: return [1,3,5];
    case 2: return [2,4];
    case 1: return [1];
    default: return [0,1,2,3,4,5,6];
  }
}

function getFrequencyLabel(compound: Compound): string {
  const dpw = compound.daysPerWeek;
  const note = compound.timingNote || '';
  const days = getScheduledDays(note, dpw);
  if (days.length === 7) return 'Daily';
  if (days.length === 5 && days.join(',') === '1,2,3,4,5') return 'M-F';
  if (days.length === 3 && days.join(',') === '1,3,5') return 'M/W/F';
  if (days.length === 2 && days.join(',') === '2,4') return 'T/Th';
  if (days.length === 2 && days.join(',') === '1,5') return 'M/F';
  if (days.length >= 1 && days.length <= 5) return days.map(d => DAY_SHORT[d]).join('/');
  return `${dpw}x/wk`;
}
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import CompoundInfoDrawer from '@/components/CompoundInfoDrawer';

interface WeeklyScheduleViewProps {
  compounds: Compound[];
  protocols?: UserProtocol[];
  compoundAnalyses?: Record<string, any>;
  compoundLoading?: string | null;
  onAnalyzeCompound?: (compoundId: string) => void;
  customFields?: CustomField[];
  customFieldValues?: Map<string, Map<string, string>>;
  checkedDoses?: Set<string>;
  onToggleChecked?: (key: string) => void;
  /** When true, dose checkboxes are hidden (read-only mode for member views) */
  readOnly?: boolean;
  /** Name of the member being viewed in read-only mode — shown in a banner */
  readOnlyMemberName?: string;
  /** Callback to exit member read-only view back to self */
  onExitReadOnly?: () => void;
  /** Map of memberInitial -> Set<checkKey> for combined view initials badges */
  memberInitialsDoses?: Map<string, Set<string>>;
  /** Set of compound IDs belonging to household member (for ownership dot in combined view) */
  memberCompoundIds?: Set<string>;
  /** Controlled selected day index (0=Sun..6=Sat). If provided, parent manages state. */
  selectedDay?: number;
  /** Called when user changes selected day */
  onSelectedDayChange?: (dayIndex: number) => void;
  /** Week offset from current week (0=this week, -1=last week, +1=next week) */
  weekOffset?: number;
  /** Called when user navigates to a different week */
  onWeekOffsetChange?: (offset: number) => void;
}

function getResumeDate(daysLeft: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysLeft);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

const WeeklyScheduleView = ({ compounds, protocols = [], compoundAnalyses, compoundLoading, onAnalyzeCompound, customFields, customFieldValues, checkedDoses: externalChecked, onToggleChecked: externalToggle, readOnly = false, readOnlyMemberName, onExitReadOnly, memberInitialsDoses, memberCompoundIds, selectedDay: externalSelectedDay, onSelectedDayChange, weekOffset = 0, onWeekOffsetChange }: WeeklyScheduleViewProps) => {
  const today = new Date().getDay();
  const [internalSelectedDay, setInternalSelectedDay] = useState(today);
  const selectedDay = externalSelectedDay ?? internalSelectedDay;
  const setSelectedDay = (day: number) => {
    setInternalSelectedDay(day);
    onSelectedDayChange?.(day);
  };

  const isCurrentWeek = weekOffset === 0;
  const isViewingToday = selectedDay === today && isCurrentWeek;
  const todayDate = new Date();
  const getDateForDayIndex = (dayIdx: number): Date => {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() + (dayIdx - todayDate.getDay()) + (weekOffset * 7));
    return d;
  };
  const selectedDate = getDateForDayIndex(selectedDay);
  const todayMidnight = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const selectedMidnight = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const isViewingFuture = selectedMidnight > todayMidnight;

  // Week date range for header
  const weekSunday = getDateForDayIndex(0);
  const weekSaturday = getDateForDayIndex(6);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekRangeLabel = weekSunday.getMonth() === weekSaturday.getMonth()
    ? `${months[weekSunday.getMonth()]} ${weekSunday.getDate()}–${weekSaturday.getDate()}, ${weekSunday.getFullYear()}`
    : `${months[weekSunday.getMonth()]} ${weekSunday.getDate()} – ${months[weekSaturday.getMonth()]} ${weekSaturday.getDate()}, ${weekSunday.getFullYear()}`;

  const [selectedCompound, setSelectedCompound] = useState<Compound | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [doseUnit, setDoseUnit] = useState<'mg' | 'ml'>('mg');
  const [searchQuery, setSearchQuery] = useState('');

  // Track which compound IDs changed so we can flash their rows
  const [flashedIds, setFlashedIds] = useState<Set<string>>(new Set());
  const prevCompoundsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const prev = prevCompoundsRef.current;
    const changed = new Set<string>();
    compounds.forEach(c => {
      // Fingerprint the fields that affect schedule rendering
      const fingerprint = `${c.cycleStartDate}|${c.cycleOnDays}|${c.cycleOffDays}|${c.pausedAt}|${c.daysPerWeek}|${c.timingNote}|${c.dosesPerDay}|${c.dosePerUse}`;
      if (prev.has(c.id) && prev.get(c.id) !== fingerprint) {
        changed.add(c.id);
      }
      prev.set(c.id, fingerprint);
    });
    if (changed.size > 0) {
      setFlashedIds(changed);
      const t = setTimeout(() => setFlashedIds(new Set()), 1300);
      return () => clearTimeout(t);
    }
  }, [compounds]);

  // Use external (persisted) state if provided, otherwise local fallback
  const [localChecked, setLocalChecked] = useState<Set<string>>(new Set());
  const checkedDoses = externalChecked ?? localChecked;
  const toggleChecked = externalToggle ?? ((key: string) => {
    setLocalChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  });

  // Fetch cached personalized scores for all compounds
  const [cachedScoresMap, setCachedScoresMap] = useState<Map<string, CompoundScores>>(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);
  const refreshCachedScores = () => setCacheVersion(v => v + 1);
  useEffect(() => {
    let cancelled = false;
    const fetchCached = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from('personalized_score_cache')
        .select('compound_name, scores')
        .eq('user_id', user.id);
      if (cancelled || !data) return;
      const map = new Map<string, CompoundScores>();
      for (const row of data) {
        const s = row.scores as any;
        if (s && typeof s.bioavailability === 'number') {
          map.set(row.compound_name, {
            bioavailability: s.bioavailability,
            efficacy: s.efficacy,
            effectiveness: s.effectiveness,
            evidenceTier: s.evidenceTier || 'Mixed',
            confidencePct: s.confidencePct,
            confidenceNote: s.confidenceNote,
          });
        }
      }
      setCachedScoresMap(map);
    };
    fetchCached();
    return () => { cancelled = true; };
  }, [compounds, cacheVersion]);

  const weeklySchedule = useMemo(() => generateScheduleFromCompounds(compounds, customFields, customFieldValues), [compounds, customFields, customFieldValues]);
  const schedule = weeklySchedule[selectedDay];
  const compoundMap = new Map(compounds.map(c => [c.id, c]));

  // Filter doses by search query
  const filterDoses = (doses: typeof schedule.doses) => {
    if (!searchQuery.trim()) return doses;
    const q = searchQuery.toLowerCase();
    return doses.filter(d => {
      const c = compoundMap.get(d.compoundId);
      return c?.name.toLowerCase().includes(q);
    });
  };

  const offCycleIds = new Set(
    compounds
      .filter(c => {
        const status = getCycleStatus(c);
        return status.hasCycle && !status.isOn;
      })
      .map(c => c.id)
  );

  const pausedIds = new Set(
    compounds.filter(c => isPaused(c)).map(c => c.id)
  );

  const morningDoses = filterDoses(schedule.doses.filter(d => d.timing === 'morning'));
  const afternoonDoses = filterDoses(schedule.doses.filter(d => d.timing === 'afternoon'));
  const eveningDoses = filterDoses(schedule.doses.filter(d => d.timing === 'evening'));

  // Compute daily completion: all active doses across all timings
  // Must replicate DoseSection→DoseGroup sub-grouping so indexes match checkKeys
  const { allActiveDoseKeys, isDayComplete } = useMemo(() => {
    const buildGroupKeys = (groupDoses: DayDose[]) => {
      const seenOff = new Set<string>();
      const filtered = groupDoses.filter(d => {
        if (offCycleIds.has(d.compoundId)) {
          if (seenOff.has(d.compoundId)) return false;
          seenOff.add(d.compoundId);
        }
        return true;
      });
      return filtered
        .map((dose, i) => ({ dose, i }))
        .filter(({ dose }) => !offCycleIds.has(dose.compoundId) && !pausedIds.has(dose.compoundId))
        .map(({ dose, i }) => `${dose.compoundId}-${dose.timing}-${i}`);
    };

    // Split doses exactly like DoseSection does
    const splitIntoGroups = (doses: DayDose[]): DayDose[][] => {
      const peptides = doses.filter(d => d.category === 'peptide' || d.category === 'injectable-oil');
      const orals = doses.filter(d => d.category === 'oral' || d.category === 'prescription' || d.category === 'vitamin' || d.category === 'adaptogen' || d.category === 'nootropic' || d.category === 'holistic' || d.category === 'probiotic' || d.category === 'alternative-medicine');
      const powders = doses.filter(d => d.category === 'powder');
      const topicals = doses.filter(d => d.category === 'topical' || d.category === 'essential-oil');

      const protocolCompoundIds = new Set<string>();
      const protocolDoseGroups: DayDose[][] = [];
      protocols.forEach(p => {
        const pDoses = doses.filter(d => p.compoundIds.includes(d.compoundId));
        if (pDoses.length > 0) {
          protocolDoseGroups.push(pDoses);
          pDoses.forEach(d => protocolCompoundIds.add(d.compoundId));
        }
      });

      const ungroupedOrals = orals.filter(d => !protocolCompoundIds.has(d.compoundId));
      const ungroupedPowders = powders.filter(d => !protocolCompoundIds.has(d.compoundId));
      const ungroupedTopicals = topicals.filter(d => !protocolCompoundIds.has(d.compoundId));

      const groups: DayDose[][] = [];
      if (peptides.length > 0) groups.push(peptides);
      protocolDoseGroups.forEach(g => groups.push(g));
      if (ungroupedOrals.length > 0) groups.push(ungroupedOrals);
      if (ungroupedPowders.length > 0) groups.push(ungroupedPowders);
      if (ungroupedTopicals.length > 0) groups.push(ungroupedTopicals);
      return groups;
    };

    const keys: string[] = [];
    [morningDoses, afternoonDoses, eveningDoses].forEach(timingDoses => {
      const groups = splitIntoGroups(timingDoses);
      groups.forEach(group => {
        keys.push(...buildGroupKeys(group));
      });
    });

    const complete = keys.length > 0 && keys.every(k => checkedDoses.has(k));
    return { allActiveDoseKeys: keys, isDayComplete: complete };
  }, [morningDoses, afternoonDoses, eveningDoses, offCycleIds, pausedIds, checkedDoses, protocols]);

  // Helper to compute active dose keys for any day's schedule
  const computeDayKeys = useCallback((daySchedule: typeof schedule) => {
    const buildGroupKeys = (groupDoses: DayDose[]) => {
      const seenOff = new Set<string>();
      const filtered = groupDoses.filter(d => {
        if (offCycleIds.has(d.compoundId)) {
          if (seenOff.has(d.compoundId)) return false;
          seenOff.add(d.compoundId);
        }
        return true;
      });
      return filtered
        .map((dose, i) => ({ dose, i }))
        .filter(({ dose }) => !offCycleIds.has(dose.compoundId) && !pausedIds.has(dose.compoundId))
        .map(({ dose, i }) => `${dose.compoundId}-${dose.timing}-${i}`);
    };
    const splitIntoGroups = (doses: DayDose[]): DayDose[][] => {
      const peptides = doses.filter(d => d.category === 'peptide' || d.category === 'injectable-oil');
      const orals = doses.filter(d => d.category === 'oral' || d.category === 'prescription' || d.category === 'vitamin' || d.category === 'adaptogen' || d.category === 'nootropic' || d.category === 'holistic' || d.category === 'probiotic' || d.category === 'alternative-medicine');
      const powders = doses.filter(d => d.category === 'powder');
      const topicals = doses.filter(d => d.category === 'topical' || d.category === 'essential-oil');
      const pCompoundIds = new Set<string>();
      const pGroups: DayDose[][] = [];
      protocols.forEach(p => {
        const pDoses = doses.filter(d => p.compoundIds.includes(d.compoundId));
        if (pDoses.length > 0) { pGroups.push(pDoses); pDoses.forEach(d => pCompoundIds.add(d.compoundId)); }
      });
      const groups: DayDose[][] = [];
      if (peptides.length > 0) groups.push(peptides);
      pGroups.forEach(g => groups.push(g));
      const uOrals = orals.filter(d => !pCompoundIds.has(d.compoundId));
      const uPowders = powders.filter(d => !pCompoundIds.has(d.compoundId));
      const uTopicals = topicals.filter(d => !pCompoundIds.has(d.compoundId));
      if (uOrals.length > 0) groups.push(uOrals);
      if (uPowders.length > 0) groups.push(uPowders);
      if (uTopicals.length > 0) groups.push(uTopicals);
      return groups;
    };
    const keys: string[] = [];
    ['morning', 'afternoon', 'evening'].forEach(timing => {
      const timingDoses = daySchedule.doses.filter(d => d.timing === timing);
      splitIntoGroups(timingDoses).forEach(group => keys.push(...buildGroupKeys(group)));
    });
    return keys;
  }, [offCycleIds, pausedIds, protocols]);

  // Load check-offs for all 7 days to show completion badges on day selector
  const { user } = useAuth();
  const [weekCompletedDays, setWeekCompletedDays] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!user) { setWeekCompletedDays(new Set()); return; }
    let cancelled = false;
    const dates = Array.from({ length: 7 }, (_, i) => weekDayToDateStr(i, weekOffset));
    const load = async () => {
      const { data } = await supabase
        .from('dose_check_offs')
        .select('compound_id, timing, dose_index, check_date')
        .eq('user_id', user.id)
        .in('check_date', dates);
      if (cancelled || !data) return;

      // Group check-offs by date
      const byDate = new Map<string, Set<string>>();
      data.forEach(r => {
        const key = `${r.compound_id}-${r.timing}-${r.dose_index}`;
        if (!byDate.has(r.check_date)) byDate.set(r.check_date, new Set());
        byDate.get(r.check_date)!.add(key);
      });

      const completed = new Set<number>();
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const dateStr = dates[dayIdx];
        const dayChecks = byDate.get(dateStr) || new Set();
        const dayKeys = computeDayKeys(weeklySchedule[dayIdx]);
        if (dayKeys.length > 0 && dayKeys.every(k => dayChecks.has(k))) {
          completed.add(dayIdx);
        }
      }
      setWeekCompletedDays(completed);
    };
    load();
    return () => { cancelled = true; };
  }, [user, weekOffset, weeklySchedule, computeDayKeys]);

  // Also update when current day's checkedDoses change (optimistic)
  useEffect(() => {
    setWeekCompletedDays(prev => {
      const next = new Set(prev);
      if (isDayComplete) next.add(selectedDay);
      else next.delete(selectedDay);
      return next;
    });
  }, [isDayComplete, selectedDay]);

  // Celebration: show once when transitioning to 100%
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const prevCompleteRef = useRef(false);

  useEffect(() => {
    if (isDayComplete && !prevCompleteRef.current && !celebrationDismissed && !readOnly) {
      setShowCelebration(true);
    }
    prevCompleteRef.current = isDayComplete;
  }, [isDayComplete, celebrationDismissed, readOnly]);

  const handleDismissCelebration = useCallback(() => {
    setShowCelebration(false);
    setCelebrationDismissed(true);
  }, []);

  // Reset celebration dismissed state when switching days
  useEffect(() => {
    setCelebrationDismissed(false);
    prevCompleteRef.current = false;
  }, [selectedDay, weekOffset]);

  const handleCompoundClick = (compoundId: string) => {
    const compound = compoundMap.get(compoundId);
    if (compound) {
      setSelectedCompound(compound);
      setDrawerOpen(true);
    }
  };

  return (
    <TooltipProvider>
      <DailyCompletionCelebration show={showCelebration} onDismiss={handleDismissCelebration} />
      <div className={`space-y-4 rounded-xl transition-all duration-500 ${isDayComplete ? 'daily-complete-border border p-3 -m-1' : ''}`}>
        {/* Read-only member banner */}
        {readOnly && readOnlyMemberName && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs">
            {onExitReadOnly && (
              <button
                onClick={onExitReadOnly}
                className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors flex-shrink-0 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
            <span className="w-px h-4 bg-border/50 flex-shrink-0" />
            <span className="text-muted-foreground truncate">
              Viewing <span className="text-foreground font-semibold">{readOnlyMemberName}</span>'s schedule
              <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">— read only</span>
            </span>
          </div>
        )}
        {/* Week Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => onWeekOffsetChange?.(weekOffset - 1)}
            className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors">
                  <Calendar className="w-4 h-4 text-primary" />
                  {weekRangeLabel}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <CalendarWidget
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date && onWeekOffsetChange) {
                      const now = new Date();
                      const diffMs = date.getTime() - now.getTime();
                      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                      const newOffset = Math.floor((diffDays + now.getDay()) / 7);
                      onWeekOffsetChange(newOffset);
                      setSelectedDay(date.getDay());
                    }
                  }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {!isCurrentWeek && (
              <button
                onClick={() => { onWeekOffsetChange?.(0); setSelectedDay(today); }}
                className="text-[10px] text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                Today
              </button>
            )}
          </div>
          <button
            onClick={() => onWeekOffsetChange?.(weekOffset + 1)}
            className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day Selector */}
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {weeklySchedule.map((day) => {
            const dayDate = getDateForDayIndex(day.dayIndex);
            const isToday = isCurrentWeek && day.dayIndex === today;
            const isDayDone = weekCompletedDays.has(day.dayIndex);
            return (
            <Tooltip key={day.dayIndex}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSelectedDay(day.dayIndex)}
                  className={`relative flex-shrink-0 px-3 py-2.5 sm:py-2 rounded-lg text-xs font-medium transition-all touch-manipulation ${
                    selectedDay === day.dayIndex
                      ? 'bg-primary text-primary-foreground glow-cyan'
                      : isToday
                        ? 'bg-secondary border border-primary/30 text-primary'
                        : 'bg-secondary text-secondary-foreground active:bg-secondary/60'
                  }`}
                >
                  {day.shortName}
                  {isDayDone && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-status-good flex items-center justify-center ring-2 ring-background">
                      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              </TooltipTrigger>
          {isToday && (
                <TooltipContent side="bottom" className="text-xs">
                  Today
                </TooltipContent>
              )}
            </Tooltip>
          );
          })}
        </div>
        {/* Non-today hint */}
        {!isViewingToday && (
          <p className="text-[10px] text-muted-foreground/60 text-center -mt-2">
            {isViewingFuture
              ? <>Viewing {schedule.dayName} <span className="text-muted-foreground/40">(future · read only)</span> · <button onClick={() => { onWeekOffsetChange?.(0); setSelectedDay(today); }} className="text-primary underline-offset-2 underline">Back to Today</button></>
              : <>Viewing {schedule.dayName} <span className="text-muted-foreground/40">(past · checkmarks saved)</span> · <button onClick={() => { onWeekOffsetChange?.(0); setSelectedDay(today); }} className="text-primary underline-offset-2 underline">Back to Today</button></>
            }
          </p>
        )}

        {/* Search / Filter bar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Filter compounds…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-xs bg-secondary border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-foreground">{schedule.dayName}</h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground hover:text-primary transition-colors">
                <Info className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[280px] text-xs leading-relaxed">
              <p className="font-semibold mb-1">Cycling ON/OFF</p>
              <p>Some compounds follow cycling protocols to maintain effectiveness and reduce tolerance. <span className="text-status-warning">OFF</span> items show their resume date. <span className="text-status-good">Active</span> items show days remaining in the current ON phase. Tap any compound for details.</p>
            </TooltipContent>
          </Tooltip>
          <div className="ml-auto">
            <button
              onClick={() => setDoseUnit(u => u === 'mg' ? 'ml' : 'mg')}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              <Syringe className="w-2.5 h-2.5" />
              {doseUnit === 'mg' ? 'mg' : 'mL'}
            </button>
          </div>
        </div>

        {/* Combined view legend */}
        {memberCompoundIds && (
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-md bg-card/40 border border-border/40 w-fit text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
              Mine
            </span>
            <span className="w-px h-3 bg-border/60" />
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
              Member
            </span>
          </div>
        )}

        {/* Morning */}
        <DoseSection
          icon={<Sun className="w-4 h-4" />}
          title="Morning Protocol"
          accent="text-primary"
          bgAccent="bg-primary/5 border-primary/20"
          doses={morningDoses}
          compoundMap={compoundMap}
          offCycleIds={offCycleIds}
          pausedIds={pausedIds}
          onCompoundClick={handleCompoundClick}
          protocols={protocols}
          doseUnit={doseUnit}
          checkedDoses={checkedDoses}
          onToggleChecked={toggleChecked}
          readOnly={readOnly || isViewingFuture}
          memberInitialsDoses={isViewingToday ? memberInitialsDoses : undefined}
          memberCompoundIds={memberCompoundIds}
          flashedIds={flashedIds}
          cachedScoresMap={cachedScoresMap}
          onScoreDrawerClose={refreshCachedScores}
        />

        {/* Afternoon */}
        {afternoonDoses.length > 0 && (
          <DoseSection
            icon={<Dumbbell className="w-4 h-4" />}
            title="Afternoon / Pre-Workout"
            accent="text-primary"
            bgAccent="bg-primary/5 border-primary/20"
            doses={afternoonDoses}
            compoundMap={compoundMap}
            offCycleIds={offCycleIds}
            pausedIds={pausedIds}
            onCompoundClick={handleCompoundClick}
            protocols={protocols}
            doseUnit={doseUnit}
            checkedDoses={checkedDoses}
            onToggleChecked={toggleChecked}
            readOnly={readOnly || isViewingFuture}
            memberInitialsDoses={isViewingToday ? memberInitialsDoses : undefined}
            memberCompoundIds={memberCompoundIds}
            flashedIds={flashedIds}
            cachedScoresMap={cachedScoresMap}
            onScoreDrawerClose={refreshCachedScores}
          />
        )}

        {/* Evening */}
        <DoseSection
          icon={<Moon className="w-4 h-4" />}
          title="Evening Protocol"
          accent="text-accent"
          bgAccent="bg-accent/5 border-accent/20"
          doses={eveningDoses}
          compoundMap={compoundMap}
          offCycleIds={offCycleIds}
          pausedIds={pausedIds}
          onCompoundClick={handleCompoundClick}
          protocols={protocols}
          doseUnit={doseUnit}
          checkedDoses={checkedDoses}
          onToggleChecked={toggleChecked}
          readOnly={readOnly || isViewingFuture}
          memberInitialsDoses={isViewingToday ? memberInitialsDoses : undefined}
          memberCompoundIds={memberCompoundIds}
          flashedIds={flashedIds}
          cachedScoresMap={cachedScoresMap}
          onScoreDrawerClose={refreshCachedScores}
        />

        <CompoundInfoDrawer
          compound={selectedCompound}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          compoundAnalysis={selectedCompound ? compoundAnalyses?.[selectedCompound.id] ?? null : null}
          compoundLoading={selectedCompound ? compoundLoading === selectedCompound.id : false}
          onAnalyzeCompound={onAnalyzeCompound}
        />
      </div>
    </TooltipProvider>
  );
};


const DoseSection = ({
  icon,
  title,
  accent,
  bgAccent,
  doses,
  compoundMap,
  offCycleIds,
  pausedIds = new Set(),
  onCompoundClick,
  protocols,
  doseUnit,
  checkedDoses,
  onToggleChecked,
  readOnly = false,
  memberInitialsDoses,
  memberCompoundIds,
  flashedIds = new Set(),
  cachedScoresMap = new Map(),
  onScoreDrawerClose,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  bgAccent: string;
  doses: DayDose[];
  compoundMap: Map<string, Compound>;
  offCycleIds: Set<string>;
  pausedIds?: Set<string>;
  onCompoundClick: (id: string) => void;
  protocols: UserProtocol[];
  doseUnit: 'mg' | 'ml';
  checkedDoses: Set<string>;
  onToggleChecked: (key: string) => void;
  readOnly?: boolean;
  memberInitialsDoses?: Map<string, Set<string>>;
  memberCompoundIds?: Set<string>;
  flashedIds?: Set<string>;
  cachedScoresMap?: Map<string, CompoundScores>;
  onScoreDrawerClose?: () => void;
}) => {
  const allPeptides = doses.filter(d => d.category === 'peptide' || d.category === 'injectable-oil');
  const allOrals = doses.filter(d => d.category === 'oral' || d.category === 'prescription' || d.category === 'vitamin' || d.category === 'adaptogen' || d.category === 'nootropic' || d.category === 'holistic' || d.category === 'probiotic' || d.category === 'alternative-medicine');
  const allPowders = doses.filter(d => d.category === 'powder');
  const allTopicals = doses.filter(d => d.category === 'topical' || d.category === 'essential-oil');

  const protocolCompoundIds = new Set<string>();
  const protocolGroups: { label: string; doses: DayDose[] }[] = [];

  protocols.forEach(p => {
    const pDoses = doses.filter(d => p.compoundIds.includes(d.compoundId));
    if (pDoses.length > 0) {
      protocolGroups.push({ label: `${p.icon} ${p.name}`, doses: pDoses });
      pDoses.forEach(d => protocolCompoundIds.add(d.compoundId));
    }
  });

  const ungroupedOrals = allOrals.filter(d => !protocolCompoundIds.has(d.compoundId));
  const ungroupedPowders = allPowders.filter(d => !protocolCompoundIds.has(d.compoundId));
  const ungroupedTopicals = allTopicals.filter(d => !protocolCompoundIds.has(d.compoundId));

  const totalActive = doses.filter(d => !offCycleIds.has(d.compoundId) && !pausedIds.has(d.compoundId)).length;

  // Guard against non-numeric cached values (e.g. text stored instead of a number)
  const toNum = (v: unknown): number => {
    const n = typeof v === 'number' ? v : parseFloat(v as string);
    return Number.isFinite(n) ? n : 0;
  };

  // Compute aggregate stack scores for active compounds in this time slot
  // Prefer cached personalized scores, fall back to static
  const stackScores = useMemo(() => {
    const activeCompoundIds = new Set<string>();
    doses.forEach(d => {
      if (!offCycleIds.has(d.compoundId) && !pausedIds.has(d.compoundId)) {
        activeCompoundIds.add(d.compoundId);
      }
    });
    if (activeCompoundIds.size === 0) return null;

    let bioSum = 0, effSum = 0, ovrSum = 0, count = 0;
    activeCompoundIds.forEach(id => {
      const c = compoundMap.get(id);
      if (!c) return;
      const cached = cachedScoresMap.get(c.name);
      const s = cached || getCompoundScores(c.name, c.category);
      if (!s) return;
      bioSum += toNum(s.bioavailability);
      effSum += toNum(s.efficacy);
      ovrSum += toNum(s.effectiveness);
      count++;
    });
    if (count === 0) return null;
    return {
      bio: Math.round(bioSum / count),
      eff: Math.round(effSum / count),
      ovr: Math.round(ovrSum / count),
      count,
    };
  }, [doses, offCycleIds, pausedIds, compoundMap, cachedScoresMap]);

  const scoreColor = (v: number) =>
    v >= 80 ? 'text-status-good' : v >= 60 ? 'text-primary' : v >= 40 ? 'text-status-warning' : 'text-status-critical';

  const scoreBg = (v: number) =>
    v >= 80 ? 'bg-status-good/10' : v >= 60 ? 'bg-primary/10' : v >= 40 ? 'bg-status-warning/10' : 'bg-destructive/10';

  // Build per-compound score details for the breakdown sheet

  const compoundScoreDetails = useMemo(() => {
    const details: { name: string; bio: number; eff: number; ovr: number }[] = [];
    doses.forEach(d => {
      if (offCycleIds.has(d.compoundId) || pausedIds.has(d.compoundId)) return;
      const c = compoundMap.get(d.compoundId);
      if (!c) return;
      // Deduplicate by compound ID
      if (details.some(x => x.name === c.name)) return;
      const cached = cachedScoresMap.get(c.name);
      const s = cached || getCompoundScores(c.name, c.category);
      if (!s) return;
      details.push({ name: c.name, bio: toNum(s.bioavailability), eff: toNum(s.efficacy), ovr: toNum(s.effectiveness) });
    });
    return details;
  }, [doses, offCycleIds, pausedIds, compoundMap, cachedScoresMap]);

  const [stackBreakdownOpen, setStackBreakdownOpen] = useState(false);

  return (
    <div className={`rounded-lg border p-3 ${bgAccent}`}>
      <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${accent}`}>
        {icon}
        {title}
        <span className="text-muted-foreground font-normal">({totalActive} active)</span>
      </h3>

      {/* Stack Score Summary — clickable */}
      {stackScores && (
        <button
          onClick={() => setStackBreakdownOpen(true)}
          className="flex items-center gap-2 mb-3 px-1 w-full text-left hover:opacity-80 transition-opacity active:scale-[0.98]"
        >
          {[
            { label: 'Bio', value: stackScores.bio, Icon: Beaker },
            { label: 'Eff', value: stackScores.eff, Icon: FlaskConical },
            { label: 'Ovr', value: stackScores.ovr, Icon: Target },
          ].map(({ label, value, Icon }) => (
            <div key={label} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono ${scoreBg(value)}`}>
              <Icon className={`w-2.5 h-2.5 ${scoreColor(value)}`} />
              <span className="text-muted-foreground">{label}</span>
              <span className={`font-bold ${scoreColor(value)}`}>{value}%</span>
            </div>
          ))}
          <span className="text-[9px] text-muted-foreground/50 ml-auto">avg of {stackScores.count}</span>
        </button>
      )}

      {/* Stack Score Breakdown Sheet */}
      <Sheet open={stackBreakdownOpen} onOpenChange={setStackBreakdownOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {icon}
              {title} — Score Breakdown
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {/* Header row */}
            <div className="grid grid-cols-4 gap-2 text-[10px] font-mono text-muted-foreground px-2 pb-1 border-b border-border/40">
              <span className="col-span-1">Compound</span>
              <span className="text-center">Bio</span>
              <span className="text-center">Eff</span>
              <span className="text-center">Ovr</span>
            </div>
            {compoundScoreDetails.map(d => (
              <div key={d.name} className="grid grid-cols-4 gap-2 items-center px-2 py-1.5 rounded-md hover:bg-secondary/30">
                <span className="text-xs font-medium text-foreground/80 truncate">{d.name}</span>
                <span className={`text-center text-xs font-mono font-bold ${scoreColor(d.bio)}`}>{d.bio}%</span>
                <span className={`text-center text-xs font-mono font-bold ${scoreColor(d.eff)}`}>{d.eff}%</span>
                <span className={`text-center text-xs font-mono font-bold ${scoreColor(d.ovr)}`}>{d.ovr}%</span>
              </div>
            ))}
            {/* Average row */}
            {stackScores && (
              <div className="grid grid-cols-4 gap-2 items-center px-2 py-2 mt-1 border-t border-border/40 font-semibold">
                <span className="text-xs text-muted-foreground">Average</span>
                <span className={`text-center text-xs font-mono font-bold ${scoreColor(stackScores.bio)}`}>{stackScores.bio}%</span>
                <span className={`text-center text-xs font-mono font-bold ${scoreColor(stackScores.eff)}`}>{stackScores.eff}%</span>
                <span className={`text-center text-xs font-mono font-bold ${scoreColor(stackScores.ovr)}`}>{stackScores.ovr}%</span>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <div className="space-y-3">
        {allPeptides.length > 0 && (
          <DoseGroup label="Injectables" doses={allPeptides} compoundMap={compoundMap} offCycleIds={offCycleIds} pausedIds={pausedIds} onCompoundClick={onCompoundClick} doseUnit={doseUnit} checkedDoses={checkedDoses} onToggleChecked={onToggleChecked} readOnly={readOnly} memberInitialsDoses={memberInitialsDoses} memberCompoundIds={memberCompoundIds} flashedIds={flashedIds} cachedScoresMap={cachedScoresMap} onScoreDrawerClose={onScoreDrawerClose} />
        )}
        {protocolGroups.map(pg => (
          <DoseGroup key={pg.label} label={pg.label} doses={pg.doses} compoundMap={compoundMap} offCycleIds={offCycleIds} pausedIds={pausedIds} onCompoundClick={onCompoundClick} doseUnit={doseUnit} checkedDoses={checkedDoses} onToggleChecked={onToggleChecked} readOnly={readOnly} memberInitialsDoses={memberInitialsDoses} memberCompoundIds={memberCompoundIds} flashedIds={flashedIds} cachedScoresMap={cachedScoresMap} onScoreDrawerClose={onScoreDrawerClose} />
        ))}
        {ungroupedOrals.length > 0 && (
          <DoseGroup label="Oral Supplements" doses={ungroupedOrals} compoundMap={compoundMap} offCycleIds={offCycleIds} pausedIds={pausedIds} onCompoundClick={onCompoundClick} doseUnit={doseUnit} checkedDoses={checkedDoses} onToggleChecked={onToggleChecked} readOnly={readOnly} memberInitialsDoses={memberInitialsDoses} memberCompoundIds={memberCompoundIds} flashedIds={flashedIds} cachedScoresMap={cachedScoresMap} onScoreDrawerClose={onScoreDrawerClose} />
        )}
        {ungroupedPowders.length > 0 && (
          <DoseGroup label="Powders" doses={ungroupedPowders} compoundMap={compoundMap} offCycleIds={offCycleIds} pausedIds={pausedIds} onCompoundClick={onCompoundClick} doseUnit={doseUnit} checkedDoses={checkedDoses} onToggleChecked={onToggleChecked} readOnly={readOnly} memberInitialsDoses={memberInitialsDoses} memberCompoundIds={memberCompoundIds} flashedIds={flashedIds} cachedScoresMap={cachedScoresMap} onScoreDrawerClose={onScoreDrawerClose} />
        )}
        {ungroupedTopicals.length > 0 && (
          <DoseGroup label="Topicals" doses={ungroupedTopicals} compoundMap={compoundMap} offCycleIds={offCycleIds} pausedIds={pausedIds} onCompoundClick={onCompoundClick} doseUnit={doseUnit} checkedDoses={checkedDoses} onToggleChecked={onToggleChecked} readOnly={readOnly} memberInitialsDoses={memberInitialsDoses} memberCompoundIds={memberCompoundIds} flashedIds={flashedIds} cachedScoresMap={cachedScoresMap} onScoreDrawerClose={onScoreDrawerClose} />
        )}
      </div>
    </div>
  );
};

const DoseGroup = ({
  label,
  doses,
  compoundMap,
  offCycleIds,
  pausedIds = new Set(),
  onCompoundClick,
  doseUnit,
  checkedDoses,
  onToggleChecked,
  readOnly = false,
  memberInitialsDoses,
  memberCompoundIds,
  flashedIds = new Set(),
  cachedScoresMap = new Map(),
  onScoreDrawerClose,
}: {
  label: string;
  doses: DayDose[];
  compoundMap: Map<string, Compound>;
  offCycleIds: Set<string>;
  pausedIds?: Set<string>;
  onCompoundClick: (id: string) => void;
  doseUnit: 'mg' | 'ml';
  checkedDoses: Set<string>;
  onToggleChecked: (key: string) => void;
  readOnly?: boolean;
  memberInitialsDoses?: Map<string, Set<string>>;
  memberCompoundIds?: Set<string>;
  flashedIds?: Set<string>;
  cachedScoresMap?: Map<string, CompoundScores>;
  onScoreDrawerClose?: () => void;
}) => {
  const seenOff = new Set<string>();
  const filteredDoses = doses.filter(d => {
    if (offCycleIds.has(d.compoundId)) {
      if (seenOff.has(d.compoundId)) return false;
      seenOff.add(d.compoundId);
    }
    return true;
  });

  // Active (not off-cycle, not paused) dose keys for check-all — must match checkKey formula below
  const activeDoseKeys = filteredDoses
    .map((dose, i) => ({ dose, i }))
    .filter(({ dose }) => !offCycleIds.has(dose.compoundId) && !pausedIds.has(dose.compoundId))
    .map(({ dose, i }) => `${dose.compoundId}-${dose.timing}-${i}`);

  const allChecked = activeDoseKeys.length > 0 && activeDoseKeys.every(k => checkedDoses.has(k));
  const someChecked = activeDoseKeys.some(k => checkedDoses.has(k));

  const handleCheckAll = () => {
    if (allChecked) {
      // Uncheck all
      activeDoseKeys.forEach(k => { if (checkedDoses.has(k)) onToggleChecked(k); });
    } else {
      // Check all that aren't already checked
      activeDoseKeys.forEach(k => { if (!checkedDoses.has(k)) onToggleChecked(k); });
    }
  };

  const convertToMl = (compound: Compound, doseStr: string): string => {
    if (doseUnit !== 'ml') return doseStr;
    const isPeptide = compound.category === 'peptide';
    const isOil = compound.category === 'injectable-oil';
    if (!isPeptide && !isOil) return doseStr;

    if (isPeptide) {
      // Peptide: dose is in IU, 1mL = 100 IU
      const reconVolIU = (compound.reconVolume || 2) * 100;
      const vialMg = compound.unitSize;
      const isIu = compound.doseLabel.toLowerCase().includes('iu');
      const isMg = compound.doseLabel.toLowerCase().includes('mg');
      if (isIu) {
        const ml = Math.round((compound.dosePerUse / 100) * 1000) / 1000;
        return `${ml} mL`;
      }
      if (isMg && vialMg > 0) {
        const iu = (compound.dosePerUse / vialMg) * reconVolIU;
        const ml = Math.round((iu / 100) * 1000) / 1000;
        return `${ml} mL`;
      }
    }

    if (isOil) {
      // Oil: unitSize is now mg/mL directly
      const concMgPerMl = compound.unitSize;
      if (concMgPerMl > 0 && compound.doseLabel.toLowerCase().includes('mg')) {
        const ml = Math.round((compound.dosePerUse / concMgPerMl) * 1000) / 1000;
        return `${ml} mL`;
      }
    }

    return doseStr;
  };

  const [scoreDrawerCompound, setScoreDrawerCompound] = useState<Compound | null>(null);
  const [scoreDrawerScores, setScoreDrawerScores] = useState<CompoundScores | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {!readOnly && activeDoseKeys.length > 1 && (
          <button
            onClick={handleCheckAll}
            className={`flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
              allChecked
                ? 'bg-primary/20 border-primary/40 text-primary'
                : someChecked
                  ? 'bg-secondary/60 border-border/50 text-muted-foreground'
                  : 'bg-secondary/30 border-border/30 text-muted-foreground/60 hover:text-muted-foreground hover:border-border/50'
            }`}
          >
            <Check className="w-2.5 h-2.5" />
            {allChecked ? 'Uncheck All' : 'Check All'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {filteredDoses.map((dose, i) => {
          const compound = compoundMap.get(dose.compoundId);
          const status = compound ? getCycleStatus(compound) : null;
          const isOff = offCycleIds.has(dose.compoundId);
          const isPausedItem = pausedIds.has(dose.compoundId);
          const showCycleDays = status?.hasCycle && status.isOn && !isPausedItem;
          const displayDose = compound ? convertToMl(compound, dose.dose) : dose.dose;
          const pauseRestart = compound?.pauseRestartDate
            ? new Date(compound.pauseRestartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : null;
          const checkKey = `${dose.compoundId}-${dose.timing}-${i}`;
          const isChecked = checkedDoses.has(checkKey);
          const isInactive = isOff || isPausedItem;

          // Collect which member initials checked this dose (combined view)
          const checkedByInitials: string[] = [];
          if (memberInitialsDoses) {
            memberInitialsDoses.forEach((keySet, initial) => {
              if (keySet.has(checkKey)) checkedByInitials.push(initial);
            });
          }

          const isFlashing = flashedIds.has(dose.compoundId);

          // Score badges for this compound — prefer cached personalized, fall back to static
          const cachedScores = compound && !isInactive ? cachedScoresMap.get(compound.name) : null;
          const staticScores = compound && !isInactive ? getCompoundScores(compound.name, compound.category) : null;
          const rawScores = cachedScores || staticScores;

          // Coerce score values to numbers — AI sometimes returns text instead of a number.
          // When cached value is text, fall back to the static score for that metric.
          const safeNum = (cached: unknown, fallback: unknown): number => {
            const n = Number(cached);
            if (!isNaN(n)) return n;
            const fb = Number(fallback);
            return !isNaN(fb) ? fb : 0;
          };
          const compoundScores = rawScores ? {
            ...rawScores,
            bioavailability: safeNum(rawScores.bioavailability, staticScores?.bioavailability),
            efficacy: safeNum(rawScores.efficacy, staticScores?.efficacy),
            effectiveness: safeNum(rawScores.effectiveness, staticScores?.effectiveness),
          } : null;

          const doseScoreColor = (v: number) =>
            v >= 80 ? 'text-status-good' : v >= 60 ? 'text-primary' : v >= 40 ? 'text-status-warning' : 'text-status-critical';

          return (
            <div
              key={`${dose.compoundId}-${i}-${isFlashing ? 'flash' : 'still'}`}
              className={`rounded px-2.5 py-1.5 transition-colors hover:bg-card/80 active:bg-card ${isInactive ? 'bg-card/20 opacity-50' : 'bg-card/50'} ${isFlashing ? 'animate-row-flash' : ''}`}
            >
              <div className="flex items-center gap-2">
                {!isInactive && !readOnly && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleChecked(checkKey); }}
                    className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isChecked
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-muted-foreground/40 hover:border-primary/60'
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3" />}
                  </button>
                )}
                {/* Read-only indicator */}
                {!isInactive && readOnly && (
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isChecked
                      ? 'bg-muted-foreground/30 border-muted-foreground/40'
                      : 'border-muted-foreground/20'
                  }`}>
                    {isChecked && <Check className="w-3 h-3 text-muted-foreground" />}
                  </div>
                )}
                <button
                  onClick={() => onCompoundClick(dose.compoundId)}
                  className={`flex items-center justify-between flex-1 min-w-0 text-left ${isChecked ? 'opacity-60' : ''}`}
                >
                  <span className={`flex items-center gap-1 text-xs truncate mr-2 ${isInactive ? 'text-muted-foreground' : isChecked ? 'text-muted-foreground line-through' : 'text-foreground/90'}`}>
                    {memberCompoundIds && memberCompoundIds.has(dose.compoundId) && (
                      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-accent" title="Household member's compound" />
                    )}
                    {memberCompoundIds && !memberCompoundIds.has(dose.compoundId) && (
                      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary" title="Your compound" />
                    )}
                    <span className="truncate">
                      {compound?.name || dose.compoundId}
                      {compound && !isPausedItem && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
                          ({getFrequencyLabel(compound)})
                        </span>
                      )}
                    </span>
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {checkedByInitials.map((initial, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent/20 text-accent border border-accent/30 text-[9px] font-bold"
                        title={`Checked by ${initial}`}
                      >
                        {initial}
                      </span>
                    ))}
                    <div className="flex items-center gap-1.5">
                      {isPausedItem && (
                        <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          <Pause className="w-3 h-3" />
                          {pauseRestart ? `→ ${pauseRestart}` : 'Paused'}
                        </span>
                      )}
                      {!isPausedItem && isOff && status?.hasCycle && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-status-warning/15 text-status-warning" title={`OFF phase — resumes ${getResumeDate(status.daysLeftInPhase)}`}>
                          OFF {status.daysLeftInPhase}d → {getResumeDate(status.daysLeftInPhase)}
                        </span>
                      )}
                      {showCycleDays && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-status-good/15 text-status-good" title={`ON phase — ${status.daysLeftInPhase} days remaining`}>
                          ON {status.daysLeftInPhase}d
                        </span>
                      )}
                      {!isOff && !isPausedItem && <span className={`text-xs font-mono text-primary ${isChecked ? 'line-through opacity-60' : ''}`}>{displayDose}</span>}
                    </div>
                  </div>
                </button>
              </div>
              {/* Per-compound score badges */}
              {compoundScores && !isChecked && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (compound) {
                      setScoreDrawerCompound(compound);
                      setScoreDrawerScores(compoundScores);
                    }
                  }}
                  className="flex items-center gap-2 ml-7 mt-0.5 py-2 px-1 -mx-1 cursor-pointer hover:opacity-80 transition-opacity active:scale-[0.97] touch-manipulation select-none"
                  style={{ minHeight: '44px' }}
                >
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-1 rounded border border-border/30 bg-secondary/20">
                    <Beaker className="w-2.5 h-2.5 text-primary" />
                    <span className={doseScoreColor(compoundScores.bioavailability)}>{compoundScores.bioavailability}%</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-1 rounded border border-border/30 bg-secondary/20">
                    <FlaskConical className="w-2.5 h-2.5 text-primary" />
                    <span className={doseScoreColor(compoundScores.efficacy)}>{compoundScores.efficacy}%</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-1 rounded border border-border/30 bg-secondary/20">
                    <Target className="w-2.5 h-2.5 text-primary" />
                    <span className={doseScoreColor(compoundScores.effectiveness)}>{compoundScores.effectiveness}%</span>
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
      {scoreDrawerCompound && scoreDrawerScores && (
        <CompoundScoreDrawer
          open={!!scoreDrawerCompound}
          onOpenChange={(open) => { if (!open) { setScoreDrawerCompound(null); setScoreDrawerScores(null); onScoreDrawerClose?.(); } }}
          compoundName={scoreDrawerCompound.name}
          scores={scoreDrawerScores}
          deliveryMethod={getDeliveryLabel(scoreDrawerCompound.category)}
          category={scoreDrawerCompound.category}
          dosePerUse={scoreDrawerCompound.dosePerUse}
          dosesPerDay={scoreDrawerCompound.dosesPerDay}
          daysPerWeek={scoreDrawerCompound.daysPerWeek}
          unitLabel={scoreDrawerCompound.unitLabel}
          doseLabel={scoreDrawerCompound.doseLabel}
        />
      )}
    </div>
  );
};

export default WeeklyScheduleView;
