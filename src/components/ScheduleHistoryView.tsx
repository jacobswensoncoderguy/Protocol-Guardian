import { useState, useMemo } from 'react';
import { WeeklySnapshot } from '@/hooks/useScheduleSnapshots';
import { generateScheduleFromCompounds } from '@/lib/scheduleGenerator';
import { Compound } from '@/data/compounds';
import { getCycleStatus, isPaused } from '@/lib/cycling';
import { ChevronRight, Calendar, Check, X, Clock } from 'lucide-react';

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
  // weekStart is Monday (dayIndex=1 in our system where 0=Sun)
  // So for dayIndex 0 (Sun), we need to go +6 from Monday
  // For dayIndex 1 (Mon), we stay at Monday (+0)
  const offset = dayIndex === 0 ? 6 : dayIndex - 1;
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  const schedule = useMemo(
    () => generateScheduleFromCompounds(snapshot.compound_snapshots),
    [snapshot.compound_snapshots]
  );

  // Calculate weekly compliance
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
      activeDoses.forEach((d, i) => {
        const key = `${d.compoundId}-${d.timing}-${i}`;
        if (dayChecks.has(key)) taken++;
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
              const dayTaken = activeDoses.filter((d, i) => dayChecks.has(`${d.compoundId}-${d.timing}-${i}`)).length;
              const dayTotal = activeDoses.length;
              const dayPct = dayTotal > 0 ? dayTaken / dayTotal : 0;

              return (
                <div key={colIdx} className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">{DAYS_SHORT[colIdx]}</p>
                  <div className={`rounded-md py-1.5 text-[10px] font-mono ${
                    dayPct === 1 ? 'bg-status-good/20 text-status-good' :
                    dayPct >= 0.5 ? 'bg-status-warning/20 text-status-warning' :
                    dayTotal === 0 ? 'bg-secondary/50 text-muted-foreground' :
                    'bg-destructive/10 text-destructive'
                  }`}>
                    {dayTotal === 0 ? '—' : `${dayTaken}/${dayTotal}`}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Compound details */}
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
        </div>
      )}
    </div>
  );
};

export default ScheduleHistoryView;
