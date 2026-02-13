import { useState } from 'react';
import { weeklySchedule, DayDose } from '@/data/schedule';
import { Compound } from '@/data/compounds';
import { getCycleStatus } from '@/lib/cycling';
import { Sun, Moon, Dumbbell } from 'lucide-react';

interface WeeklyScheduleViewProps {
  compounds: Compound[];
}

const WeeklyScheduleView = ({ compounds }: WeeklyScheduleViewProps) => {
  const today = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(today);

  const schedule = weeklySchedule[selectedDay];
  const compoundMap = new Map(compounds.map(c => [c.id, c]));

  const offCycleIds = new Set(
    compounds
      .filter(c => {
        const status = getCycleStatus(c);
        return status.hasCycle && !status.isOn;
      })
      .map(c => c.id)
  );

  const morningDoses = schedule.doses.filter(d => d.timing === 'morning');
  const afternoonDoses = schedule.doses.filter(d => d.timing === 'afternoon');
  const eveningDoses = schedule.doses.filter(d => d.timing === 'evening');

  return (
    <div className="space-y-4">
      {/* Day Selector */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        {weeklySchedule.map((day) => (
          <button
            key={day.dayIndex}
            onClick={() => setSelectedDay(day.dayIndex)}
            className={`flex-shrink-0 px-3 py-2.5 sm:py-2 rounded-lg text-xs font-medium transition-all touch-manipulation ${
              selectedDay === day.dayIndex
                ? 'bg-primary text-primary-foreground glow-cyan'
                : day.dayIndex === today
                  ? 'bg-secondary border border-primary/30 text-primary'
                  : 'bg-secondary text-secondary-foreground active:bg-secondary/60'
            }`}
          >
            {day.shortName}
          </button>
        ))}
      </div>

      <h2 className="text-lg font-bold text-foreground">{schedule.dayName}</h2>

      {/* Morning */}
      <DoseSection
        icon={<Sun className="w-4 h-4" />}
        title="Morning Protocol"
        accent="text-primary"
        bgAccent="bg-primary/5 border-primary/20"
        doses={morningDoses}
        compoundMap={compoundMap}
        offCycleIds={offCycleIds}
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
      />
    </div>
  );
};

/** Format a date N days from now as "Mon DD" */
function formatCycleRestartDate(compound: Compound): string | null {
  const status = getCycleStatus(compound);
  if (!status.hasCycle || status.isOn) return null;
  const restart = new Date();
  restart.setDate(restart.getDate() + status.daysLeftInPhase);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[restart.getMonth()]} ${restart.getDate()}`;
}

const DoseSection = ({
  icon,
  title,
  accent,
  bgAccent,
  doses,
  compoundMap,
  offCycleIds,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  bgAccent: string;
  doses: DayDose[];
  compoundMap: Map<string, Compound>;
  offCycleIds: Set<string>;
}) => {
  const activeDoses = doses.filter(d => !offCycleIds.has(d.compoundId));
  const pausedDoses = doses.filter(d => offCycleIds.has(d.compoundId));

  const activePeptides = activeDoses.filter(d => d.category === 'peptide' || d.category === 'injectable-oil');
  const activeOrals = activeDoses.filter(d => d.category === 'oral');
  const activePowders = activeDoses.filter(d => d.category === 'powder');

  const pausedPeptides = pausedDoses.filter(d => d.category === 'peptide' || d.category === 'injectable-oil');
  const pausedOrals = pausedDoses.filter(d => d.category === 'oral');
  const pausedPowders = pausedDoses.filter(d => d.category === 'powder');

  const totalActive = activeDoses.length;

  return (
    <div className={`rounded-lg border p-3 ${bgAccent}`}>
      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${accent}`}>
        {icon}
        {title}
        <span className="text-muted-foreground font-normal">({totalActive} active)</span>
      </h3>

      <div className="space-y-3">
        {activePeptides.length > 0 && (
          <DoseGroup label="Injectables" doses={activePeptides} compoundMap={compoundMap} />
        )}
        {activeOrals.length > 0 && (
          <DoseGroup label="Oral Supplements" doses={activeOrals} compoundMap={compoundMap} />
        )}
        {activePowders.length > 0 && (
          <DoseGroup label="Powders" doses={activePowders} compoundMap={compoundMap} />
        )}

        {/* Off-cycle separator + grayed-out compounds */}
        {pausedDoses.length > 0 && (
          <>
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 h-px bg-muted-foreground/20" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Off-Cycle ({pausedDoses.length})</span>
              <div className="flex-1 h-px bg-muted-foreground/20" />
            </div>

            {pausedPeptides.length > 0 && (
              <PausedDoseGroup label="Injectables" doses={pausedPeptides} compoundMap={compoundMap} />
            )}
            {pausedOrals.length > 0 && (
              <PausedDoseGroup label="Oral Supplements" doses={pausedOrals} compoundMap={compoundMap} />
            )}
            {pausedPowders.length > 0 && (
              <PausedDoseGroup label="Powders" doses={pausedPowders} compoundMap={compoundMap} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

const DoseGroup = ({
  label,
  doses,
  compoundMap,
}: {
  label: string;
  doses: DayDose[];
  compoundMap: Map<string, Compound>;
}) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
      {doses.map((dose, i) => {
        const compound = compoundMap.get(dose.compoundId);
        const status = compound ? getCycleStatus(compound) : null;
        const showCycleDays = status?.hasCycle && status.isOn;
        return (
          <div key={`${dose.compoundId}-${i}`} className="flex items-center justify-between bg-card/50 rounded px-2.5 py-1.5">
            <span className="text-xs text-foreground/90 truncate mr-2">
              {compound?.name || dose.compoundId}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {showCycleDays && (
                <span className="text-[10px] font-mono text-muted-foreground">{status.daysLeftInPhase}d</span>
              )}
              <span className="text-xs font-mono text-primary">{dose.dose}</span>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const PausedDoseGroup = ({
  label,
  doses,
  compoundMap,
}: {
  label: string;
  doses: DayDose[];
  compoundMap: Map<string, Compound>;
}) => {
  // Deduplicate by compoundId (e.g. taurine appears twice)
  const seen = new Set<string>();
  const uniqueDoses = doses.filter(d => {
    if (seen.has(d.compoundId)) return false;
    seen.add(d.compoundId);
    return true;
  });

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1.5">{label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {uniqueDoses.map((dose, i) => {
          const compound = compoundMap.get(dose.compoundId);
          const restartDate = compound ? formatCycleRestartDate(compound) : null;
          const status = compound ? getCycleStatus(compound) : null;
          return (
            <div key={`${dose.compoundId}-${i}`} className="flex items-center justify-between bg-card/20 rounded px-2.5 py-1.5 opacity-50">
              <span className="text-xs text-muted-foreground truncate mr-2">
                {compound?.name || dose.compoundId}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
                {restartDate ? `resumes ${restartDate}` : status?.phaseLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyScheduleView;
