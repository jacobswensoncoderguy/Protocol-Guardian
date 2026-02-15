import { useState, useEffect, useMemo, useCallback } from 'react';
import { Compound } from '@/data/compounds';
import { Target, Plus, ChevronLeft, ChevronRight, Shield, Scale, Zap, Rocket, Ruler, Weight, Percent, Calendar as CalendarIcon, Check, ToggleLeft, Syringe } from 'lucide-react';
import { StackAnalysis } from '@/hooks/useProtocolAnalysis';
import { ToleranceLevel } from '@/hooks/useProtocolAnalysis';
import { UserGoal } from '@/hooks/useGoals';
import { UserProfile, ToleranceEntry } from '@/hooks/useProfile';
import { useGoalReadings } from '@/hooks/useGoalReadings';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MeasurementSystem, DoseUnitPreference, displayHeight, displayWeight } from '@/lib/measurements';
import ProtocolOutcomesCard from '@/components/ProtocolOutcomesCard';
import ProtocolIntelligenceCard from '@/components/ProtocolIntelligenceCard';
import MiniSparkline from '@/components/MiniSparkline';
import { computeZoneIntensities, BODY_ZONES, BodyZone } from '@/data/bodyZoneMapping';
import GeometricBody from '@/components/GeometricBody';
import ZoneDetailDrawer from '@/components/ZoneDetailDrawer';
import GenderSelector from '@/components/GenderSelector';
import ToleranceSelector from '@/components/ToleranceSelector';
import ConfirmDialog from '@/components/ConfirmDialog';
import bodyMaleImg from '@/assets/body-male.jpeg';
import bodyFemaleImg from '@/assets/body-female.jpeg';

interface DashboardViewProps {
  compounds: Compound[];
  stackAnalysis?: StackAnalysis | null;
  aiLoading?: boolean;
  needsRefresh?: boolean;
  toleranceLevel?: string;
  onAnalyzeStack?: () => void;
  onViewAIInsights?: () => void;
  onViewOutcomes?: () => void;
  goals?: UserGoal[];
  userId?: string;
  profile?: UserProfile | null;
  toleranceHistory?: ToleranceEntry[];
  onUpdateProfile?: (updates: Partial<UserProfile>) => Promise<void>;
  onToleranceChange?: (level: ToleranceLevel) => void;
  measurementSystem?: MeasurementSystem;
  doseUnitPreference?: DoseUnitPreference;
}

const toleranceMeta: Record<string, { Icon: typeof Shield; label: string; color: string }> = {
  conservative: { Icon: Shield, label: 'Conservative', color: 'text-blue-400' },
  moderate: { Icon: Scale, label: 'Moderate', color: 'text-primary' },
  aggressive: { Icon: Zap, label: 'Aggressive', color: 'text-amber-400' },
  performance: { Icon: Rocket, label: 'Performance', color: 'text-rose-400' },
};

const GOAL_TYPE_ICONS: Record<string, string> = {
  muscle_gain: '💪', fat_loss: '🔥', cardiovascular: '❤️', cognitive: '🧠',
  hormonal: '⚡', longevity: '✨', recovery: '🩹', sleep: '🌙', libido: '🔥', custom: '🎯',
};

function getProgress(goal: UserGoal, firstReading?: number): number | null {
  const baseline = goal.baseline_value ?? firstReading ?? null;
  if (!goal.target_value || baseline == null) return null;
  const current = goal.current_value ?? baseline;
  const range = goal.target_value - baseline;
  if (range === 0) return 100;
  return Math.min(100, Math.max(0, Math.round(((current - baseline) / range) * 100)));
}

const GoalCard = ({ goal, icon, progress, progressVal, barColor, sparkData, onViewOutcomes, onAddReading }: {
  goal: UserGoal; icon: string; progress: number | null; progressVal: number; barColor: string;
  sparkData: number[]; onViewOutcomes?: () => void; onAddReading: (value: number) => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setSubmitting(true);
    await onAddReading(num);
    setValue('');
    setOpen(false);
    setSubmitting(false);
  };

  return (
    <div className="bg-card/60 backdrop-blur-sm rounded-lg border border-border/30 p-3 hover:border-primary/30 transition-all duration-300">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={onViewOutcomes}>
          <span className="text-sm flex-shrink-0">{icon}</span>
          <span className="text-xs font-medium text-foreground truncate">{goal.title}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <MiniSparkline values={sparkData} width={40} height={14} />
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button onClick={(e) => e.stopPropagation()} className="p-0.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-primary" title="Quick add reading">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="end" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
                <Input type="number" step="any" placeholder={goal.target_unit || 'Value'} value={value} onChange={(e) => setValue(e.target.value)} className="h-7 text-xs" autoFocus />
                <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={submitting || !value}>Add</Button>
              </form>
            </PopoverContent>
          </Popover>
          <span className="text-xs font-mono font-semibold text-foreground w-8 text-right">
            {progress !== null ? `${progress}%` : '—'}
          </span>
        </div>
      </div>
      <div className="h-1 bg-secondary/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${progressVal}%` }} />
      </div>
      {goal.current_value != null && goal.target_unit && (
        <div className="mt-1 text-[9px] font-mono text-muted-foreground/70">
          {goal.current_value}{goal.target_unit}
          {goal.target_value != null && <span className="text-muted-foreground/40"> → {goal.target_value}{goal.target_unit}</span>}
        </div>
      )}
    </div>
  );
};

// Zone legend with color-coded labels
const ZoneLegend = ({ zoneIntensities, onZoneTap }: { zoneIntensities: Record<BodyZone, number>; onZoneTap?: (zone: BodyZone) => void }) => {
  const activeZones = (Object.entries(zoneIntensities) as Array<[BodyZone, number]>)
    .filter(([, v]) => v > 0.1)
    .sort((a, b) => b[1] - a[1]);

  if (activeZones.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {activeZones.map(([zone, intensity]) => (
        <button
          key={zone}
          onClick={() => onZoneTap?.(zone)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/40 border border-border/20 hover:border-primary/30 transition-all active:scale-95"
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: BODY_ZONES[zone].color,
              boxShadow: `0 0 ${4 + intensity * 6}px ${BODY_ZONES[zone].color}`,
            }}
          />
          <span className="text-[10px] font-medium text-muted-foreground">{BODY_ZONES[zone].label}</span>
          <span className="text-[9px] font-mono text-muted-foreground/50">{Math.round(intensity * 100)}%</span>
        </button>
      ))}
    </div>
  );
};
// Profile & Tolerance info bar for Protocol Coverage screen
const ProfileToleranceBar = ({ profile, toleranceLevel, toleranceHistory, onUpdateProfile, onToleranceChange, onGenderChange, measurementSystem = 'metric', doseUnitPreference = 'mg' }: {
  profile?: UserProfile | null;
  toleranceLevel?: string;
  toleranceHistory?: ToleranceEntry[];
  onUpdateProfile?: (updates: Partial<UserProfile>) => Promise<void>;
  onToleranceChange?: (level: ToleranceLevel) => void;
  onGenderChange?: (gender: string, temporary: boolean) => void;
  measurementSystem?: MeasurementSystem;
  doseUnitPreference?: DoseUnitPreference;
}) => {
  const [editing, setEditing] = useState(false);
  const [height, setHeight] = useState(profile?.height_cm?.toString() || '');
  const [weight, setWeight] = useState(profile?.weight_kg?.toString() || '');
  const [bodyFat, setBodyFat] = useState(profile?.body_fat_pct?.toString() || '');
  const [age, setAge] = useState(profile?.age?.toString() || '');
  const [showToleranceConfirm, setShowToleranceConfirm] = useState(false);
  const [pendingTolerance, setPendingTolerance] = useState<ToleranceLevel | null>(null);

  useEffect(() => {
    setHeight(profile?.height_cm?.toString() || '');
    setWeight(profile?.weight_kg?.toString() || '');
    setBodyFat(profile?.body_fat_pct?.toString() || '');
    setAge(profile?.age?.toString() || '');
  }, [profile]);

  const handleSave = async () => {
    if (!onUpdateProfile) return;
    await onUpdateProfile({
      height_cm: height ? parseFloat(height) : null,
      weight_kg: weight ? parseFloat(weight) : null,
      body_fat_pct: bodyFat ? parseFloat(bodyFat) : null,
      age: age ? parseInt(age) : null,
    });
    setEditing(false);
    toast.success('Profile updated');
  };

  const handleToleranceSelect = (level: ToleranceLevel) => {
    setPendingTolerance(level);
    setShowToleranceConfirm(true);
  };

  const confirmTolerance = () => {
    if (pendingTolerance && onToleranceChange) {
      onToleranceChange(pendingTolerance);
      toast.success(`Tolerance locked to ${pendingTolerance}`);
    }
    setShowToleranceConfirm(false);
  };

  const latestTolerance = toleranceHistory?.[0];

  return (
    <div className="w-full space-y-2 mb-3">
      {/* Gender selector */}
      {onGenderChange && (
        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Profile Gender</p>
          <GenderSelector
            currentGender={profile?.gender}
            onGenderChange={onGenderChange}
            locked={!!profile?.gender}
          />
        </div>
      )}

      {/* Dynamic Tolerance selector */}
      {onToleranceChange && (
        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Dosing Tolerance Level</p>
          <ToleranceSelector
            value={(toleranceLevel || 'moderate') as ToleranceLevel}
            onChange={handleToleranceSelect}
          />
          {latestTolerance && (
            <p className="text-[9px] text-muted-foreground/60 font-mono mt-1">
              Set {new Date(latestTolerance.created_at).toLocaleDateString()} at {new Date(latestTolerance.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}

      {/* Measurement toggles */}
      <div className="flex items-center gap-3 px-1">
        <button
          onClick={() => onUpdateProfile?.({ measurement_system: measurementSystem === 'metric' ? 'imperial' : 'metric' } as any)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
        >
          <ToggleLeft className="w-3 h-3" />
          <span className="font-medium">{measurementSystem === 'metric' ? 'Metric' : 'Imperial'}</span>
        </button>
        <button
          onClick={() => onUpdateProfile?.({ dose_unit_preference: doseUnitPreference === 'mg' ? 'iu' : 'mg' } as any)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
        >
          <Syringe className="w-3 h-3" />
          <span className="font-medium">{doseUnitPreference === 'mg' ? 'mg/mcg' : 'IU'}</span>
        </button>
      </div>

      {/* Profile metrics row */}
      {!editing ? (
        <button
          onClick={() => setEditing(true)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/30 border border-border/20 hover:border-primary/30 transition-all"
        >
          <div className="flex items-center gap-3 flex-1 text-[10px] text-muted-foreground">
            {profile?.height_cm && <span className="flex items-center gap-0.5"><Ruler className="w-3 h-3" />{displayHeight(profile.height_cm, measurementSystem)}</span>}
            {profile?.weight_kg && <span className="flex items-center gap-0.5"><Weight className="w-3 h-3" />{displayWeight(profile.weight_kg, measurementSystem)}</span>}
            {profile?.body_fat_pct != null && <span className="flex items-center gap-0.5"><Percent className="w-3 h-3" />{profile.body_fat_pct}%</span>}
            {profile?.age && <span className="flex items-center gap-0.5"><CalendarIcon className="w-3 h-3" />{profile.age}y</span>}
            {!profile?.height_cm && !profile?.weight_kg && <span className="text-muted-foreground/50">Tap to add measurements</span>}
          </div>
        </button>
      ) : (
        <div className="px-3 py-3 rounded-lg bg-secondary/30 border border-primary/30 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-muted-foreground block mb-0.5">Height (cm)</label>
              <Input type="number" value={height} onChange={e => setHeight(e.target.value)} className="h-7 text-xs" placeholder="175" />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground block mb-0.5">Weight (kg)</label>
              <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="h-7 text-xs" placeholder="82" />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground block mb-0.5">Body Fat %</label>
              <Input type="number" value={bodyFat} onChange={e => setBodyFat(e.target.value)} className="h-7 text-xs" placeholder="15" />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground block mb-0.5">Age</label>
              <Input type="number" value={age} onChange={e => setAge(e.target.value)} className="h-7 text-xs" placeholder="35" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={handleSave}>Save</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Tolerance confirmation dialog */}
      <ConfirmDialog
        open={showToleranceConfirm}
        onOpenChange={setShowToleranceConfirm}
        title="Confirm Tolerance Level"
        description={`Lock your dosing tolerance to "${pendingTolerance}"? This will update all pages with this tolerance level.`}
        confirmLabel="Lock It In"
        onConfirm={confirmTolerance}
      />
    </div>
  );
};

const DashboardView = ({ compounds, stackAnalysis, aiLoading, needsRefresh, toleranceLevel, onAnalyzeStack, onViewAIInsights, onViewOutcomes, goals = [], userId, profile, toleranceHistory = [], onUpdateProfile, onToleranceChange, measurementSystem = 'metric', doseUnitPreference = 'mg' }: DashboardViewProps) => {
  const { readings, fetchReadings, addReading } = useGoalReadings(userId);
  const [activeScreen, setActiveScreen] = useState(0);
  const [selectedZone, setSelectedZone] = useState<BodyZone | null>(null);
  const [zoneDrawerOpen, setZoneDrawerOpen] = useState(false);
  const [tempGender, setTempGender] = useState<string | null>(null);

  const handleGenderChange = async (gender: string, temporary: boolean) => {
    if (temporary) {
      setTempGender(gender);
      toast.info(`Viewing as ${gender} temporarily`);
    } else {
      setTempGender(null);
      await onUpdateProfile?.({ gender });
      toast.success(`Gender updated to ${gender}`);
    }
  };

  const displayGender = tempGender || profile?.gender;

  const handleZoneTap = (zone: BodyZone) => {
    setSelectedZone(zone);
    setZoneDrawerOpen(true);
  };

  const activeGoals = goals.filter(g => g.status === 'active');

  useEffect(() => {
    if (activeGoals.length > 0) {
      fetchReadings(activeGoals.map(g => g.id!).filter(Boolean));
    }
  }, [activeGoals.length]);

  const compoundNameIds = useMemo(() =>
    compounds.map(c => c.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')),
    [compounds]
  );

  const zoneIntensities = useMemo(() => computeZoneIntensities(compoundNameIds), [compoundNameIds]);

  const bodyCoverage = useMemo(() => {
    const zones = Object.values(zoneIntensities);
    // Weighted average of all zone intensities (each zone's intensity is 0-1)
    const totalIntensity = zones.reduce((sum, v) => sum + v, 0);
    return Math.round((totalIntensity / zones.length) * 100);
  }, [zoneIntensities]);

  const coverageRationale = useMemo(() => {
    const entries = Object.entries(zoneIntensities) as Array<[BodyZone, number]>;
    const active = entries.filter(([, v]) => v > 0.1);
    const uncovered = entries.filter(([, v]) => v <= 0.1);
    const strongest = active.sort((a, b) => b[1] - a[1]).slice(0, 2);
    const weakest = active.sort((a, b) => a[1] - b[1]).slice(0, 1);

    let rationale = `${active.length}/${entries.length} zones active. `;
    if (strongest.length > 0) {
      rationale += `Strongest: ${strongest.map(([z, v]) => `${BODY_ZONES[z].label} (${Math.round(v * 100)}%)`).join(', ')}. `;
    }
    if (weakest.length > 0 && weakest[0][1] < 0.5) {
      rationale += `Weakest: ${BODY_ZONES[weakest[0][0]].label} (${Math.round(weakest[0][1] * 100)}%). `;
    }
    if (uncovered.length > 0) {
      rationale += `Uncovered: ${uncovered.map(([z]) => BODY_ZONES[z].label).join(', ')}.`;
    }
    return rationale.trim();
  }, [zoneIntensities]);

  const overallProgress = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((sum, g) => {
        const goalReadings = readings.get(g.id!) || [];
        const firstReading = goalReadings.length > 0 ? goalReadings[0].value : undefined;
        return sum + (getProgress(g, firstReading) ?? 0);
      }, 0) / activeGoals.length)
    : 0;

  const protocolScore = stackAnalysis?.overallGrade
    ? { A: 95, B: 75, C: 55, D: 35, F: 15 }[stackAnalysis.overallGrade] ?? 50
    : 50;

  // Swipe handling
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(diff) > 50) {
      setActiveScreen(diff > 0 ? 0 : 1);
    }
    setTouchStart(null);
  };

  return (
    <div className="space-y-3">
      {/* Swipeable hero area */}
      <div
        className="relative overflow-hidden rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Dot indicators */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
          {[0, 1].map(i => (
            <button
              key={i}
              onClick={() => setActiveScreen(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                activeScreen === i ? 'w-4 bg-primary shadow-[0_0_8px_hsl(190,100%,50%)]' : 'bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {/* Navigation arrows */}
        <button
          onClick={() => setActiveScreen(0)}
          className={`absolute left-1 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground transition-all ${activeScreen === 0 ? 'opacity-0 pointer-events-none' : 'opacity-70'}`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveScreen(1)}
          className={`absolute right-1 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground transition-all ${activeScreen === 1 ? 'opacity-0 pointer-events-none' : 'opacity-70'}`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${activeScreen * 100}%)` }}
        >
          {/* Screen 1: Wireframe Body Map */}
          <div className="w-full flex-shrink-0" style={{ minHeight: 'calc(100vh - 180px)' }}>
            <div className="flex flex-col items-center h-full pt-6 pb-4 px-4">
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-0.5">Protocol Coverage</h2>
              <p className="text-[10px] text-muted-foreground/60 mb-1">
                {compounds.length} compounds · {bodyCoverage}% avg coverage
              </p>
              <p className="text-[9px] text-muted-foreground/40 mb-2 text-center max-w-[280px] leading-snug">
                {coverageRationale}
              </p>

              {/* Profile & Tolerance Info Bar */}
              <ProfileToleranceBar
                profile={{ ...profile, gender: displayGender }}
                toleranceLevel={toleranceLevel}
                toleranceHistory={toleranceHistory}
                onUpdateProfile={onUpdateProfile}
                onToleranceChange={onToleranceChange}
                onGenderChange={handleGenderChange}
                measurementSystem={measurementSystem}
                doseUnitPreference={doseUnitPreference}
              />

              {/* Wireframe body – no 3D, no orbit controls */}
              <div className="relative w-full flex-1 flex items-center justify-center" style={{ minHeight: 340 }}>
                <div className="w-[260px] h-[380px]">
                  <GeometricBody zoneIntensities={zoneIntensities} onZoneTap={handleZoneTap} gender={displayGender === 'female' ? 'female' : 'male'} />
                </div>
              </div>

              {/* Tap instruction */}
              <p className="text-[9px] text-muted-foreground/50 mb-3">Tap a zone to view compounds & impact</p>

              {/* Zone legend */}
              <div className="w-full">
                <ZoneLegend zoneIntensities={zoneIntensities} onZoneTap={handleZoneTap} />
              </div>

              <p className="text-[9px] text-muted-foreground/40 mt-3 animate-pulse">
                ← Swipe for goals →
              </p>
            </div>
          </div>

          {/* Screen 2: Goals + Sparklines */}
          <div className="w-full flex-shrink-0" style={{ minHeight: 'calc(100vh - 180px)' }}>
            <div className="flex flex-col h-full pt-6 pb-4 px-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Goal Progress
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={onViewOutcomes} className="text-xs text-primary hover:underline">View All</button>
                  <span className="text-lg font-mono font-bold text-primary">{overallProgress}%</span>
                </div>
              </div>

              <div className="h-2 bg-secondary/50 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${overallProgress}%` }} />
              </div>

              {activeGoals.length > 0 ? (
                <div className="space-y-2 flex-1 overflow-y-auto scrollbar-thin">
                  {activeGoals.map(goal => {
                    const goalReadings = readings.get(goal.id!) || [];
                    const firstReading = goalReadings.length > 0 ? goalReadings[0].value : undefined;
                    const progress = getProgress(goal, firstReading);
                    const icon = GOAL_TYPE_ICONS[goal.goal_type] || '🎯';
                    const progressVal = progress ?? 0;
                    const barColor = progressVal >= 75 ? 'bg-emerald-500' : progressVal >= 40 ? 'bg-primary' : progressVal >= 15 ? 'bg-amber-500' : 'bg-muted-foreground/40';
                    const sparkData = goalReadings.slice(-7).map(r => r.value);

                    return (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        icon={icon}
                        progress={progress}
                        progressVal={progressVal}
                        barColor={barColor}
                        sparkData={sparkData}
                        onViewOutcomes={onViewOutcomes}
                        onAddReading={async (value: number) => {
                          await addReading(goal.id!, value, goal.target_unit || '');
                          toast.success('Reading added');
                          fetchReadings(activeGoals.map(g => g.id!).filter(Boolean));
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center cursor-pointer" onClick={onViewOutcomes}>
                  <div className="text-center">
                    <Target className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-foreground mb-1">No Active Goals</h3>
                    <p className="text-xs text-muted-foreground">Tap to set goals and track progress</p>
                  </div>
                </div>
              )}

              <p className="text-[9px] text-muted-foreground/40 mt-3 text-center animate-pulse">
                ← Swipe for body map →
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Protocol Intelligence */}
      {onAnalyzeStack && (
        <ProtocolIntelligenceCard
          analysis={stackAnalysis ?? null}
          loading={aiLoading ?? false}
          needsRefresh={needsRefresh ?? false}
          toleranceLevel={toleranceLevel}
          onRefresh={onAnalyzeStack}
          onViewDetails={onViewAIInsights ?? (() => {})}
        />
      )}

      <ProtocolOutcomesCard />

      <ZoneDetailDrawer
        zone={selectedZone}
        open={zoneDrawerOpen}
        onOpenChange={setZoneDrawerOpen}
        compounds={compounds}
        toleranceLevel={toleranceLevel}
      />
    </div>
  );
};

export default DashboardView;
