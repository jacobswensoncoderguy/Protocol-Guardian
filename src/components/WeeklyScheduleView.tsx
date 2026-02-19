import { useState, useMemo } from 'react';
import { DayDose } from '@/data/schedule';
import { Compound } from '@/data/compounds';
import { getCycleStatus, isPaused } from '@/lib/cycling';
import { generateScheduleFromCompounds } from '@/lib/scheduleGenerator';
import { CustomField } from '@/hooks/useCustomFields';
import { UserProtocol } from '@/hooks/useProtocols';
import { Sun, Moon, Dumbbell, Info, Syringe, Pause, Check, ArrowLeft, Search, X } from 'lucide-react';

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
}

function getResumeDate(daysLeft: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysLeft);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

const WeeklyScheduleView = ({ compounds, protocols = [], compoundAnalyses, compoundLoading, onAnalyzeCompound, customFields, customFieldValues, checkedDoses: externalChecked, onToggleChecked: externalToggle, readOnly = false, readOnlyMemberName, onExitReadOnly, memberInitialsDoses, memberCompoundIds, selectedDay: externalSelectedDay, onSelectedDayChange }: WeeklyScheduleViewProps) => {
  const today = new Date().getDay();
  const [internalSelectedDay, setInternalSelectedDay] = useState(today);
  const selectedDay = externalSelectedDay ?? internalSelectedDay;
  const setSelectedDay = (day: number) => {
    setInternalSelectedDay(day);
    onSelectedDayChange?.(day);
  };

  const isViewingToday = selectedDay === today;
  // Future days (in the current week, after today) are read-only — can't pre-check future doses
  const isViewingFuture = selectedDay > today;
  const [selectedCompound, setSelectedCompound] = useState<Compound | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [doseUnit, setDoseUnit] = useState<'mg' | 'ml'>('mg');
  const [searchQuery, setSearchQuery] = useState('');

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
        {/* Day Selector */}
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {weeklySchedule.map((day) => (
            <Tooltip key={day.dayIndex}>
              <TooltipTrigger asChild>
                <button
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
              </TooltipTrigger>
          {day.dayIndex === today && (
                <TooltipContent side="bottom" className="text-xs">
                  Today
                </TooltipContent>
              )}
            </Tooltip>
          ))}
        </div>
        {/* Non-today hint */}
        {!isViewingToday && (
          <p className="text-[10px] text-muted-foreground/60 text-center -mt-2">
            {isViewingFuture
              ? <>Viewing {schedule.dayName} <span className="text-muted-foreground/40">(future · read only)</span> · <button onClick={() => setSelectedDay(today)} className="text-primary underline-offset-2 underline">Back to Today</button></>
              : <>Viewing {schedule.dayName} <span className="text-muted-foreground/40">(past · checkmarks saved)</span> · <button onClick={() => setSelectedDay(today)} className="text-primary underline-offset-2 underline">Back to Today</button></>
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
          <DoseGroup label="Injectables" doses={allPeptides} compoundMap={compoundMap} offCycleIds={offCycleIds} pausedIds={pausedIds} onCompoundClick={onCompoundClick} doseUnit={doseUnit} checkedDoses={checkedDoses} onToggleChecked={onToggleChecked} readOnly={readOnly} memberInitialsDoses={memberInitialsDoses} memberCompoundIds={memberCompoundIds} />
        )}
        {protocolGroups.map(pg => (
          <DoseGroup key={pg.label} label={pg.label} doses={pg.doses} compoundMap={compoundMap} offCycleIds={offCycleIds} pausedIds={pausedIds} onCompoundClick={onCompoundClick} doseUnit={doseUnit} checkedDoses={checkedDoses} onToggleChecked={onToggleChecked} readOnly={readOnly} memberInitialsDoses={memberInitialsDoses} memberCompoundIds={memberCompoundIds} />
        ))}
        {ungroupedOrals.length > 0 && (
          <DoseGroup label="Oral Supplements" doses={ungroupedOrals} compoundMap={compoundMap} offCycleIds={offCycleIds} pausedIds={pausedIds} onCompoundClick={onCompoundClick} doseUnit={doseUnit} checkedDoses={checkedDoses} onToggleChecked={onToggleChecked} readOnly={readOnly} memberInitialsDoses={memberInitialsDoses} memberCompoundIds={memberCompoundIds} />
        )}
        {ungroupedPowders.length > 0 && (
          <DoseGroup label="Powders" doses={ungroupedPowders} compoundMap={compoundMap} offCycleIds={offCycleIds} pausedIds={pausedIds} onCompoundClick={onCompoundClick} doseUnit={doseUnit} checkedDoses={checkedDoses} onToggleChecked={onToggleChecked} readOnly={readOnly} memberInitialsDoses={memberInitialsDoses} memberCompoundIds={memberCompoundIds} />
        )}
        {ungroupedTopicals.length > 0 && (
          <DoseGroup label="Topicals" doses={ungroupedTopicals} compoundMap={compoundMap} offCycleIds={offCycleIds} pausedIds={pausedIds} onCompoundClick={onCompoundClick} doseUnit={doseUnit} checkedDoses={checkedDoses} onToggleChecked={onToggleChecked} readOnly={readOnly} memberInitialsDoses={memberInitialsDoses} memberCompoundIds={memberCompoundIds} />
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

          // Collect which member initials checked this dose (combined view)
          const checkedByInitials: string[] = [];
          if (memberInitialsDoses) {
            memberInitialsDoses.forEach((keySet, initial) => {
              if (keySet.has(checkKey)) checkedByInitials.push(initial);
            });
          }

          return (
            <div
              key={`${dose.compoundId}-${i}`}
              className={`flex items-center gap-2 rounded px-2.5 py-1.5 transition-colors hover:bg-card/80 active:bg-card ${isInactive ? 'bg-card/20 opacity-50' : 'bg-card/50'}`}
            >
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
              {/* Read-only indicator: show a dimmed eye-like dot for member views */}
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
                  {/* Member ownership dot in combined view */}
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
                  {/* Member initials badges for combined view */}
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
