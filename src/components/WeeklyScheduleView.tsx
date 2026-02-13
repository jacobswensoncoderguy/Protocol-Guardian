import { useState } from 'react';
import { weeklySchedule, DayDose } from '@/data/schedule';
import { Compound } from '@/data/compounds';
import { Sun, Moon, Dumbbell } from 'lucide-react';

interface WeeklyScheduleViewProps {
  compounds: Compound[];
}

const WeeklyScheduleView = ({ compounds }: WeeklyScheduleViewProps) => {
  const today = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(today);

  const schedule = weeklySchedule[selectedDay];
  const compoundMap = new Map(compounds.map(c => [c.id, c]));

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
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  bgAccent: string;
  doses: DayDose[];
  compoundMap: Map<string, Compound>;
}) => {
  const peptides = doses.filter(d => d.category === 'peptide' || d.category === 'injectable-oil');
  const orals = doses.filter(d => d.category === 'oral');
  const powders = doses.filter(d => d.category === 'powder');

  return (
    <div className={`rounded-lg border p-3 ${bgAccent}`}>
      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${accent}`}>
        {icon}
        {title}
        <span className="text-muted-foreground font-normal">({doses.length} items)</span>
      </h3>

      <div className="space-y-3">
        {peptides.length > 0 && (
          <DoseGroup label="Injectables" doses={peptides} compoundMap={compoundMap} />
        )}
        {orals.length > 0 && (
          <DoseGroup label="Oral Supplements" doses={orals} compoundMap={compoundMap} />
        )}
        {powders.length > 0 && (
          <DoseGroup label="Powders" doses={powders} compoundMap={compoundMap} />
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
        return (
          <div key={`${dose.compoundId}-${i}`} className="flex items-center justify-between bg-card/50 rounded px-2.5 py-1.5">
            <span className="text-xs text-foreground/90 truncate mr-2">
              {compound?.name || dose.compoundId}
            </span>
            <span className="text-xs font-mono text-primary flex-shrink-0">{dose.dose}</span>
          </div>
        );
      })}
    </div>
  </div>
);

export default WeeklyScheduleView;
