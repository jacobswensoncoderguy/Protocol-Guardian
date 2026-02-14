import { useState } from 'react';
import { weeklySchedule, DayDose } from '@/data/schedule';
import { Compound } from '@/data/compounds';
import { getCycleStatus } from '@/lib/cycling';
import { UserProtocol } from '@/hooks/useProtocols';
import { Sun, Moon, Dumbbell, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import CompoundInfoDrawer from '@/components/CompoundInfoDrawer';

interface WeeklyScheduleViewProps {
  compounds: Compound[];
  protocols?: UserProtocol[];
}

function getResumeDate(daysLeft: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysLeft);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

const WeeklyScheduleView = ({ compounds, protocols = [] }: WeeklyScheduleViewProps) => {
  const today = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(today);
  const [selectedCompound, setSelectedCompound] = useState<Compound | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const handleCompoundClick = (compoundId: string) => {
    const compound = compoundMap.get(compoundId);
    if (compound) {
      setSelectedCompound(compound);
      setDrawerOpen(true);
    }
  };

  return (
    <TooltipProvider>
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
        </div>

        {/* Morning */}
        <DoseSection
          icon={<Sun className="w-4 h-4" />}
          title="Morning Protocol"
          accent="text-primary"
          bgAccent="bg-primary/5 border-primary/20"
          doses={morningDoses}
          compoundMap={compoundMap}
          offCycleIds={offCycleIds}
          onCompoundClick={handleCompoundClick}
          protocols={protocols}
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
            onCompoundClick={handleCompoundClick}
            protocols={protocols}
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
          onCompoundClick={handleCompoundClick}
          protocols={protocols}
        />

        <CompoundInfoDrawer
          compound={selectedCompound}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
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
  onCompoundClick,
  protocols,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  bgAccent: string;
  doses: DayDose[];
  compoundMap: Map<string, Compound>;
  offCycleIds: Set<string>;
  onCompoundClick: (id: string) => void;
  protocols: UserProtocol[];
}) => {
  const allPeptides = doses.filter(d => d.category === 'peptide' || d.category === 'injectable-oil');
  const allOrals = doses.filter(d => d.category === 'oral');
  const allPowders = doses.filter(d => d.category === 'powder');

  // Build protocol groups from user-defined protocols
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
          <DoseGroup label="Injectables" doses={allPeptides} compoundMap={compoundMap} offCycleIds={offCycleIds} onCompoundClick={onCompoundClick} />
        )}
        {protocolGroups.map(pg => (
          <DoseGroup key={pg.label} label={pg.label} doses={pg.doses} compoundMap={compoundMap} offCycleIds={offCycleIds} onCompoundClick={onCompoundClick} />
        ))}
        {ungroupedOrals.length > 0 && (
          <DoseGroup label="Oral Supplements" doses={ungroupedOrals} compoundMap={compoundMap} offCycleIds={offCycleIds} onCompoundClick={onCompoundClick} />
        )}
        {ungroupedPowders.length > 0 && (
          <DoseGroup label="Powders" doses={ungroupedPowders} compoundMap={compoundMap} offCycleIds={offCycleIds} onCompoundClick={onCompoundClick} />
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
  onCompoundClick,
}: {
  label: string;
  doses: DayDose[];
  compoundMap: Map<string, Compound>;
  offCycleIds: Set<string>;
  onCompoundClick: (id: string) => void;
}) => {
  // Deduplicate off-cycle compounds
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
            <button
              key={`${dose.compoundId}-${i}`}
              onClick={() => onCompoundClick(dose.compoundId)}
              className={`flex items-center justify-between rounded px-2.5 py-1.5 text-left transition-colors hover:bg-card/80 active:bg-card ${isOff ? 'bg-card/20 opacity-50' : 'bg-card/50'}`}
            >
              <span className={`text-xs truncate mr-2 ${isOff ? 'text-muted-foreground' : 'text-foreground/90'}`}>
                {compound?.name || dose.compoundId}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isOff && status?.hasCycle && (
                  <span className="text-[10px] font-mono text-status-warning">OFF → {getResumeDate(status.daysLeftInPhase)}</span>
                )}
                {showCycleDays && (
                  <span className="text-[10px] font-mono text-muted-foreground">{status.daysLeftInPhase}d</span>
                )}
                {!isOff && <span className="text-xs font-mono text-primary">{dose.dose}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyScheduleView;
