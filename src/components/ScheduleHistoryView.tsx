import { useState, useMemo } from 'react';
import { WeeklySnapshot } from '@/hooks/useScheduleSnapshots';
import { generateScheduleFromCompounds } from '@/lib/scheduleGenerator';
import { Compound } from '@/data/compounds';
import { DayDose } from '@/data/schedule';
import { getCycleStatus, isPaused } from '@/lib/cycling';
import { ChevronRight, ChevronDown, Calendar, Check, X, Sun, Moon, Dumbbell } from 'lucide-react';

interface ScheduleHistoryViewProps {
  snapshots: WeeklySnapshot[];
  loading: boolean;
  checkedDosesMap: Map<string, Set<string>>; // date -> set of check keys
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startStr = `${months[start.getMonth()]} ${start.getDate()}`;
  const endStr = start.getMonth() === end.getMonth()
    ? `${end.getDate()}`
    : `${months[end.getMonth()]} ${end.getDate()}`;
  return `${startStr}–${endStr}, ${start.getFullYear()}`;
}

function getDateForDayIndex(weekStart: string, dayIndex: number): string {
  const d = new Date(weekStart + 'T00:00:00');
  const offset = dayIndex === 0 ? 6 : dayIndex - 1;
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun order

const ScheduleHistoryView = ({ snapshots, loading, checkedDosesMap }: ScheduleHistoryViewProps) => {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  if (loading) {
    return <div className="text-center text-muted-foreground py-8 text-sm">Loading history…</div>;
  }

  if (snapshots.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">No schedule history yet.</p>
        <p className="text-muted-foreground/60 text-xs mt-1">Your weekly schedules will be saved here automatically.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-bold text-foreground mb-3">Schedule History</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Each week's schedule is frozen when it starts. Changes to your protocol won't affect past records.
      </p>
      {snapshots.map(snapshot => (
        <WeekCard
          key={snapshot.id}
          snapshot={snapshot}
          expanded={expandedWeek === snapshot.id}
          onToggle={() => setExpandedWeek(expandedWeek === snapshot.id ? null : snapshot.id)}
          checkedDosesMap={checkedDosesMap}
        />
      ))}
    </div>
  );
};

const WeekCard = ({
  snapshot,
  expanded,
  onToggle,
  checkedDosesMap,
}: {
  snapshot: WeeklySnapshot;
  expanded: boolean;
  onToggle: () => void;
  checkedDosesMap: Map<string, Set<string>>;
}) => {
  const [drillDay, setDrillDay] = useState<number | null>(null);

  const schedule = useMemo(
    () => generateScheduleFromCompounds(snapshot.compound_snapshots),
    [snapshot.compound_snapshots]
  );

  const { totalPlanned, totalTaken } = useMemo(() => {
    let planned = 0;
    let taken = 0;
    DAY_INDICES.forEach(dayIdx => {
      const daySchedule = schedule[dayIdx];
      const date = getDateForDayIndex(snapshot.week_start_date, dayIdx);
      const dayChecks = checkedDosesMap.get(date) || new Set();
      const activeDoses = daySchedule.doses.filter(d => {
        const compound = snapshot.compound_snapshots.find(c => c.id === d.compoundId);
        if (!compound) return false;
        const status = getCycleStatus(compound);
        return !(status.hasCycle && !status.isOn) && !isPaused(compound);
      });
      planned += activeDoses.length;
      // Count only check-offs that match a planned dose key (avoid overcounting)
      activeDoses.forEach((dose, i) => {
        if (dayChecks.has(`${dose.compoundId}-${dose.timing}-${i}`)) taken++;
      });
    });
    return { totalPlanned: planned, totalTaken: taken };
  }, [schedule, snapshot, checkedDosesMap]);

  const compliancePct = totalPlanned > 0 ? Math.round((totalTaken / totalPlanned) * 100) : 0;

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {formatWeekRange(snapshot.week_start_date)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono ${compliancePct >= 80 ? 'text-status-good' : compliancePct >= 50 ? 'text-status-warning' : 'text-destructive'}`}>
            {compliancePct}%
          </span>
          <span className="text-[10px] text-muted-foreground">
            {totalTaken}/{totalPlanned}
          </span>
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/30 px-4 py-3">
          {/* 7-day compliance grid — clickable for drill-down */}
          <div className="grid grid-cols-7 gap-1 mb-3">
            {DAY_INDICES.map((dayIdx, colIdx) => {
              const daySchedule = schedule[dayIdx];
              const date = getDateForDayIndex(snapshot.week_start_date, dayIdx);
              const dayChecks = checkedDosesMap.get(date) || new Set();
              const activeDoses = daySchedule.doses.filter(d => {
                const compound = snapshot.compound_snapshots.find(c => c.id === d.compoundId);
                if (!compound) return false;
                const status = getCycleStatus(compound);
                return !(status.hasCycle && !status.isOn) && !isPaused(compound);
              });
              const dayTaken = dayChecks.size;
              const dayTotal = activeDoses.length;
              const dayPct = dayTotal > 0 ? Math.min(dayTaken / dayTotal, 1) : 0;
              const isSelected = drillDay === dayIdx;

              return (
                <button
                  key={colIdx}
                  onClick={() => setDrillDay(isSelected ? null : dayIdx)}
                  className={`text-center rounded-lg transition-all ${isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}`}
                >
                  <p className="text-[10px] text-muted-foreground mb-1">{DAYS_SHORT[colIdx]}</p>
                  <div className={`rounded-md py-1.5 text-[10px] font-mono ${
                    dayPct === 1 ? 'bg-status-good/20 text-status-good' :
                    dayPct >= 0.5 ? 'bg-status-warning/20 text-status-warning' :
                    dayTotal === 0 ? 'bg-secondary/50 text-muted-foreground' :
                    'bg-destructive/10 text-destructive'
                  }`}>
                    {dayTotal === 0 ? '—' : `${dayTaken}/${dayTotal}`}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Daily drill-down */}
          {drillDay !== null && (
            <DayDrillDown
              dayIdx={drillDay}
              weekStart={snapshot.week_start_date}
              schedule={schedule}
              compounds={snapshot.compound_snapshots}
              checkedDosesMap={checkedDosesMap}
            />
          )}

          {/* Compound summary (collapsed when drill-down is open) */}
          {drillDay === null && (
            <div className="space-y-1.5 mt-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Compounds ({snapshot.compound_snapshots.length})</p>
              {snapshot.compound_snapshots.map(compound => (
                <div key={compound.id} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-secondary/30">
                  <span className="text-foreground/80 truncate mr-2">{compound.name}</span>
                  <span className="text-muted-foreground font-mono text-[10px] flex-shrink-0">
                    {compound.dosePerUse} {compound.doseLabel} · {compound.daysPerWeek}x/wk
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Daily Drill-Down ─── */

const TIMING_CONFIG = [
  { key: 'morning' as const, label: 'Morning', icon: Sun, accent: 'text-primary', bg: 'bg-primary/5 border-primary/20' },
  { key: 'afternoon' as const, label: 'Mid-day', icon: Dumbbell, accent: 'text-status-warning', bg: 'bg-status-warning/5 border-status-warning/20' },
  { key: 'evening' as const, label: 'Evening', icon: Moon, accent: 'text-accent', bg: 'bg-accent/5 border-accent/20' },
];

const DayDrillDown = ({
  dayIdx,
  weekStart,
  schedule,
  compounds,
  checkedDosesMap,
}: {
  dayIdx: number;
  weekStart: string;
  schedule: ReturnType<typeof generateScheduleFromCompounds>;
  compounds: Compound[];
  checkedDosesMap: Map<string, Set<string>>;
}) => {
  const date = getDateForDayIndex(weekStart, dayIdx);
  const dayChecks = checkedDosesMap.get(date) || new Set();
  const daySchedule = schedule[dayIdx];

  const compoundMap = new Map(compounds.map(c => [c.id, c]));
  const offCycleIds = new Set(
    compounds.filter(c => {
      const status = getCycleStatus(c);
      return status.hasCycle && !status.isOn;
    }).map(c => c.id)
  );
  const pausedIds = new Set(compounds.filter(c => isPaused(c)).map(c => c.id));

  return (
    <div className="mt-2 space-y-2 animate-in fade-in-0 slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-foreground">{formatDateLabel(date)}</p>
        <span className="text-[10px] text-muted-foreground font-mono">{dayChecks.size} taken</span>
      </div>

      {TIMING_CONFIG.map(({ key, label, icon: Icon, accent, bg }) => {
        const timingDoses = daySchedule.doses.filter(d => d.timing === key);
        if (timingDoses.length === 0) return null;

        const activeDoses = timingDoses.filter(d => {
          return !offCycleIds.has(d.compoundId) && !pausedIds.has(d.compoundId);
        });
        const inactiveDoses = timingDoses.filter(d => {
          return offCycleIds.has(d.compoundId) || pausedIds.has(d.compoundId);
        });

        return (
          <div key={key} className={`rounded-lg border p-2.5 ${bg}`}>
            <p className={`text-[11px] font-semibold mb-2 flex items-center gap-1.5 ${accent}`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
              <span className="text-muted-foreground font-normal">({activeDoses.length} active)</span>
            </p>
            <div className="space-y-0.5">
              {activeDoses.map((dose, i) => {
                const compound = compoundMap.get(dose.compoundId);
                // Check if this dose was taken — use the key stored in DB
                // We check all keys in dayChecks that start with this compound's id and timing
                const isTaken = dayChecks.has(`${dose.compoundId}-${dose.timing}-${i}`);

                return (
                  <div key={`${dose.compoundId}-${i}`} className="flex items-center gap-2 px-2 py-1 rounded text-xs">
                    <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                      isTaken
                        ? 'bg-status-good/20 text-status-good'
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {isTaken ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
                    </div>
                    <span className={`flex-1 truncate ${isTaken ? 'text-foreground/60 line-through' : 'text-foreground/80'}`}>
                      {compound?.name || dose.compoundId}
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px] flex-shrink-0">
                      {dose.dose}
                    </span>
                  </div>
                );
              })}
              {inactiveDoses.map((dose, i) => {
                const compound = compoundMap.get(dose.compoundId);
                return (
                  <div key={`inactive-${dose.compoundId}-${i}`} className="flex items-center gap-2 px-2 py-1 rounded text-xs opacity-40">
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground">
                      <X className="w-2.5 h-2.5" />
                    </div>
                    <span className="flex-1 truncate text-muted-foreground">{compound?.name || dose.compoundId}</span>
                    <span className="text-muted-foreground/60 font-mono text-[10px] flex-shrink-0">
                      {offCycleIds.has(dose.compoundId) ? 'OFF' : 'Paused'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ScheduleHistoryView;
