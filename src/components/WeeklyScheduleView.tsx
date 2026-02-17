import { useState, useMemo } from 'react';
import { DayDose } from '@/data/schedule';
import { Compound } from '@/data/compounds';
import { getCycleStatus, isPaused } from '@/lib/cycling';
import { generateScheduleFromCompounds } from '@/lib/scheduleGenerator';
import { CustomField } from '@/hooks/useCustomFields';
import { UserProtocol } from '@/hooks/useProtocols';
import { Sun, Moon, Dumbbell, Info, Syringe, Pause, Check } from 'lucide-react';

function getFrequencyLabel(compound: Compound): string {
  const dpw = compound.daysPerWeek;
  const note = (compound.timingNote || '').toLowerCase();

  if (dpw === 7 || /\bdaily\b|\bnightly\b|\bevery\s*day\b/.test(note)) return 'Daily';
  if (/\bm[\/-]f\b|mon[\s-]*fri/i.test(note) || dpw === 5) return 'M-F';
  if (/\bm\/w\/f\b/i.test(note) || dpw === 3) return 'M/W/F';
  if (/\bt\/th\b|tues.*thurs|tue.*thu/i.test(note) || dpw === 2) return 'T/Th';
  if (/\bm\/f\b/i.test(note)) return 'M/F';

  // Try to extract specific short day names from timingNote
  const dayPattern = /\b(sun|mon|tue|wed|thu|fri|sat)\b/gi;
  const matches = note.match(dayPattern);
  if (matches && matches.length > 0 && matches.length <= 4) {
    return matches.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join('/');
  }

  if (dpw === 6) return '6x/wk';
  if (dpw === 4) return '4x/wk';
  if (dpw === 1) {
    // Check for specific day
    const singleDay = note.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (singleDay) return singleDay[1].charAt(0).toUpperCase() + singleDay[1].slice(1, 3);
    return '1x/wk';
  }
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
}

function getResumeDate(daysLeft: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysLeft);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

const WeeklyScheduleView = ({ compounds, protocols = [], compoundAnalyses, compoundLoading, onAnalyzeCompound, customFields, customFieldValues }: WeeklyScheduleViewProps) => {
  const today = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(today);
  const [selectedCompound, setSelectedCompound] = useState<Compound | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [doseUnit, setDoseUnit] = useState<'mg' | 'ml'>('mg');
  const [checkedDoses, setCheckedDoses] = useState<Set<string>>(new Set());

  const toggleChecked = (key: string) => {
    setCheckedDoses(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const weeklySchedule = useMemo(() => generateScheduleFromCompounds(compounds, customFields, customFieldValues), [compounds, customFields, customFieldValues]);
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

  const pausedIds = new Set(
    compounds.filter(c => isPaused(c)).map(c => c.id)
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

  return (
    <div className={`rounded-lg border p-3 ${bgAccent}`}>
      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${accent}`}>
        {icon}
        {title}
        <span className="text-muted-foreground font-normal">({totalActive} active)</span>
      </h3>

      <div className="space-y-3">
        {allPeptides.length > 0 && (
          <DoseGroup label="Injectables" doses={allPeptides} compoundMap={compoundMap} offCycleIds={offCycleIds} pausedIds={pausedIds} onCompoundClick={onCompoundClick} doseUnit={doseUnit} checkedDoses={checkedDoses} onToggleChecked={onToggleChecked} />
        )}
        {protocolGroups.map(pg => (
          <DoseGroup key={pg.label} label={pg.label} doses={pg.doses} compoundMap={compoundMap} offCycleIds={offCycleIds} pausedIds={pausedIds} onCompoundClick={onCompoundClick} doseUnit={doseUnit} checkedDoses={checkedDoses} onToggleChecked={onToggleChecked} />
        ))}
        {ungroupedOrals.length > 0 && (
          <DoseGroup label="Oral Supplements" doses={ungroupedOrals} compoundMap={compoundMap} offCycleIds={offCycleIds} pausedIds={pausedIds} onCompoundClick={onCompoundClick} doseUnit={doseUnit} checkedDoses={checkedDoses} onToggleChecked={onToggleChecked} />
        )}
        {ungroupedPowders.length > 0 && (
          <DoseGroup label="Powders" doses={ungroupedPowders} compoundMap={compoundMap} offCycleIds={offCycleIds} pausedIds={pausedIds} onCompoundClick={onCompoundClick} doseUnit={doseUnit} checkedDoses={checkedDoses} onToggleChecked={onToggleChecked} />
        )}
        {ungroupedTopicals.length > 0 && (
          <DoseGroup label="Topicals" doses={ungroupedTopicals} compoundMap={compoundMap} offCycleIds={offCycleIds} pausedIds={pausedIds} onCompoundClick={onCompoundClick} doseUnit={doseUnit} checkedDoses={checkedDoses} onToggleChecked={onToggleChecked} />
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
}) => {
  const seenOff = new Set<string>();
  const filteredDoses = doses.filter(d => {
    if (offCycleIds.has(d.compoundId)) {
      if (seenOff.has(d.compoundId)) return false;
      seenOff.add(d.compoundId);
    }
    return true;
  });

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

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
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
          return (
            <div
              key={`${dose.compoundId}-${i}`}
              className={`flex items-center gap-2 rounded px-2.5 py-1.5 transition-colors hover:bg-card/80 active:bg-card ${isInactive ? 'bg-card/20 opacity-50' : 'bg-card/50'}`}
            >
              {!isInactive && (
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
              <button
                onClick={() => onCompoundClick(dose.compoundId)}
                className={`flex items-center justify-between flex-1 min-w-0 text-left ${isChecked ? 'opacity-60' : ''}`}
              >
                <span className={`text-xs truncate mr-2 ${isInactive ? 'text-muted-foreground' : isChecked ? 'text-muted-foreground line-through' : 'text-foreground/90'}`}>
                  {compound?.name || dose.compoundId}
                  {compound && !isPausedItem && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
                      ({getFrequencyLabel(compound)})
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isPausedItem && (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                      <Pause className="w-3 h-3" />
                      {pauseRestart ? `→ ${pauseRestart}` : 'Paused'}
                    </span>
                  )}
                  {!isPausedItem && isOff && status?.hasCycle && (
                    <span className="text-[10px] font-mono text-status-warning">OFF → {getResumeDate(status.daysLeftInPhase)}</span>
                  )}
                  {showCycleDays && (
                    <span className="text-[10px] font-mono text-muted-foreground">{status.daysLeftInPhase}d</span>
                  )}
                  {!isOff && !isPausedItem && <span className={`text-xs font-mono text-primary ${isChecked ? 'line-through opacity-60' : ''}`}>{displayDose}</span>}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyScheduleView;
