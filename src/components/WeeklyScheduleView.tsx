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
  const allPeptides = doses.filter(d => d.category === 'peptide' || d.category === 'injectable-oil');
  const allOrals = doses.filter(d => d.category === 'oral');
  const allPowders = doses.filter(d => d.category === 'powder');

  const totalActive = doses.filter(d => !offCycleIds.has(d.compoundId)).length;

  return (
    <div className={`rounded-lg border p-3 ${bgAccent}`}>
      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${accent}`}>
        {icon}
        {title}
        <span className="text-muted-foreground font-normal">({totalActive} active)</span>
      </h3>

      <div className="space-y-3">
        {allPeptides.length > 0 && (
          <DoseGroup label="Injectables" doses={allPeptides} compoundMap={compoundMap} offCycleIds={offCycleIds} />
        )}
        {allOrals.length > 0 && (
          <DoseGroup label="Oral Supplements" doses={allOrals} compoundMap={compoundMap} offCycleIds={offCycleIds} />
        )}
        {allPowders.length > 0 && (
          <DoseGroup label="Powders" doses={allPowders} compoundMap={compoundMap} offCycleIds={offCycleIds} />
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
}: {
  label: string;
  doses: DayDose[];
  compoundMap: Map<string, Compound>;
  offCycleIds: Set<string>;
}) => {
  // Deduplicate off-cycle compounds (e.g. taurine appears in morning + evening)
  const seenOff = new Set<string>();
  const filteredDoses = doses.filter(d => {
    if (offCycleIds.has(d.compoundId)) {
      if (seenOff.has(d.compoundId)) return false;
      seenOff.add(d.compoundId);
    }
    return true;
  });

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {filteredDoses.map((dose, i) => {
          const compound = compoundMap.get(dose.compoundId);
          const status = compound ? getCycleStatus(compound) : null;
          const isOff = offCycleIds.has(dose.compoundId);
          const showCycleDays = status?.hasCycle && status.isOn;
          return (
            <div key={`${dose.compoundId}-${i}`} className={`flex items-center justify-between rounded px-2.5 py-1.5 ${isOff ? 'bg-card/20 opacity-50' : 'bg-card/50'}`}>
              <span className={`text-xs truncate mr-2 ${isOff ? 'text-muted-foreground' : 'text-foreground/90'}`}>
                {compound?.name || dose.compoundId}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isOff && status?.hasCycle && (
                  <span className="text-[10px] font-mono text-orange-400">OFF {status.daysLeftInPhase}d</span>
                )}
                {showCycleDays && (
                  <span className="text-[10px] font-mono text-muted-foreground">{status.daysLeftInPhase}d</span>
                )}
                {!isOff && <span className="text-xs font-mono text-primary">{dose.dose}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyScheduleView;
