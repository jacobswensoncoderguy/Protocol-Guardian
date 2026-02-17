import { useState, useEffect, useMemo, useCallback } from 'react';
import { Compound } from '@/data/compounds';
import { Target, Plus, Shield, Scale, Rocket, Ruler, Weight, Percent, Calendar as CalendarIcon, Check, ToggleLeft, ChevronRight, Sparkles, Package } from 'lucide-react';
import InfoTooltip from '@/components/InfoTooltip';
import { AppFeatures } from '@/lib/appFeatures';
import FeatureTeaserCard from '@/components/FeatureTeaserCard';
import { getGoalIcon } from '@/lib/goalIcons';
import { kgToLbs, lbsToKg } from '@/lib/measurements';
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
  onNavigateToInventory?: () => void;
  conversationManager?: {
    createProject: (name: string, description?: string, color?: string) => Promise<any>;
    createConversation: (title?: string, projectId?: string) => Promise<any>;
    projects: { id: string; name: string }[];
    refreshConversation: (convId: string, lastContent: string) => void;
  };
  appFeatures?: AppFeatures;
  onEnableFeature?: (key: keyof AppFeatures) => void;
  onAddCompound?: () => void;
}

const toleranceMeta: Record<string, { Icon: typeof Shield; label: string; color: string }> = {
  conservative: { Icon: Shield, label: 'Conservative', color: 'text-blue-400' },
  moderate: { Icon: Scale, label: 'Moderate', color: 'text-primary' },
  performance: { Icon: Rocket, label: 'Performance', color: 'text-rose-400' },
};

// Goal type icons now use Lucide — see goalIcons.tsx

function getProgress(goal: UserGoal, firstReading?: number): number | null {
  const baseline = goal.baseline_value ?? firstReading ?? null;
  if (!goal.target_value || baseline == null) return null;
  const current = goal.current_value ?? baseline;
  const range = goal.target_value - baseline;
  if (range === 0) return 100;
  return Math.min(100, Math.max(0, Math.round(((current - baseline) / range) * 100)));
}

const GoalCard = ({ goal, GoalIcon, progress, progressVal, barColor, sparkData, onViewOutcomes, onAddReading }: {
  goal: UserGoal; GoalIcon: React.ComponentType<{ className?: string }>; progress: number | null; progressVal: number; barColor: string;
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
          <span className="text-sm flex-shrink-0"><GoalIcon className="w-4 h-4 text-primary" /></span>
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
const ProfileToleranceBar = ({ profile, toleranceLevel, toleranceHistory, onUpdateProfile, onToleranceChange, onGenderChange, measurementSystem = 'metric', onNavigateToInventory }: {
  profile?: UserProfile | null;
  toleranceLevel?: string;
  toleranceHistory?: ToleranceEntry[];
  onUpdateProfile?: (updates: Partial<UserProfile>) => Promise<void>;
  onToleranceChange?: (level: ToleranceLevel) => void;
  onGenderChange?: (gender: string, temporary: boolean) => void;
  measurementSystem?: MeasurementSystem;
  onNavigateToInventory?: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState(profile?.body_fat_pct?.toString() || '');
  const [age, setAge] = useState(profile?.age?.toString() || '');
  const [showToleranceConfirm, setShowToleranceConfirm] = useState(false);
  const [pendingTolerance, setPendingTolerance] = useState<ToleranceLevel | null>(null);

  // Convert stored metric values to display units
  const toDisplayHeight = useCallback((cm: number | null | undefined) => {
    if (!cm) return '';
    return measurementSystem === 'imperial' ? (cm / 2.54).toFixed(1) : cm.toString();
  }, [measurementSystem]);

  const toDisplayWeight = useCallback((kg: number | null | undefined) => {
    if (!kg) return '';
    return measurementSystem === 'imperial' ? kgToLbs(kg).toString() : kg.toString();
  }, [measurementSystem]);

  // Re-sync form values when profile or measurement system changes, but NOT while editing
  useEffect(() => {
    if (editing) return;
    setHeight(toDisplayHeight(profile?.height_cm));
    setWeight(toDisplayWeight(profile?.weight_kg));
    setBodyFat(profile?.body_fat_pct?.toString() || '');
    setAge(profile?.age?.toString() || '');
  }, [profile, measurementSystem, toDisplayHeight, toDisplayWeight, editing]);

  const handleSave = async () => {
    if (!onUpdateProfile) return;
    const heightVal = height ? parseFloat(height) : null;
    const weightVal = weight ? parseFloat(weight) : null;
    // Convert back to metric for storage
    const heightCm = heightVal != null
      ? (measurementSystem === 'imperial' ? Math.round(heightVal * 2.54) : heightVal)
      : null;
    const weightKg = weightVal != null
      ? (measurementSystem === 'imperial' ? lbsToKg(weightVal) : weightVal)
      : null;
    await onUpdateProfile({
      height_cm: heightCm,
      weight_kg: weightKg,
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
      {/* Compact horizontal layout: Gender tabs | divider | Tolerance selector */}
      <div className="flex items-start gap-3 mb-2">
        {onGenderChange && (
          <div className="flex-shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Gender</p>
            <GenderSelector
              currentGender={profile?.gender}
              onGenderChange={onGenderChange}
              locked={!!profile?.gender}
            />
          </div>
        )}
        {onGenderChange && toleranceLevel && (
          <div className="w-px bg-border/40 self-stretch min-h-[48px]" />
        )}
        {toleranceLevel && (
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              Dosing Tolerance
              <InfoTooltip text="Conservative = lower doses & caution. Moderate = balanced approach. Performance = higher doses for advanced users." />
            </p>
            {(() => {
              const meta = toleranceMeta[toleranceLevel];
              if (!meta) return null;
              const colorClass = toleranceLevel === 'conservative' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                : toleranceLevel === 'performance' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-primary/10 border-primary/30 text-primary';
              return (
                <button
                  onClick={onNavigateToInventory}
                  className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-lg border transition-all hover:opacity-80 active:scale-95 ${colorClass}`}
                  title="Tap to change on Compounds tab"
                >
                  <meta.Icon className="w-3 h-3" />
                  <span>{meta.label}</span>
                  <ChevronRight className="w-3 h-3 opacity-50" />
                </button>
              );
            })()}
            {latestTolerance && (
              <p className="text-[9px] text-muted-foreground/60 font-mono mt-1">
                Set {new Date(latestTolerance.created_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
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
          {/* Metric/Imperial toggle inside edit card */}
          <div className="flex items-center justify-between pb-1.5 border-b border-border/20">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Unit System</span>
            <button
              onClick={async () => {
                const newSystem = measurementSystem === 'metric' ? 'imperial' : 'metric';
                // Convert current form values to the new system
                const currentHeightVal = height ? parseFloat(height) : null;
                const currentWeightVal = weight ? parseFloat(weight) : null;
                if (currentHeightVal != null) {
                  // Convert between inches and cm
                  const newHeight = measurementSystem === 'metric'
                    ? (currentHeightVal / 2.54).toFixed(1)
                    : Math.round(currentHeightVal * 2.54).toString();
                  setHeight(newHeight);
                }
                if (currentWeightVal != null) {
                  const newWeight = measurementSystem === 'metric'
                    ? kgToLbs(currentWeightVal).toString()
                    : lbsToKg(currentWeightVal).toString();
                  setWeight(newWeight);
                }
                await onUpdateProfile?.({ measurement_system: newSystem } as any);
              }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
            >
              <ToggleLeft className="w-3 h-3" />
              {measurementSystem === 'metric' ? 'Metric (cm/kg)' : 'Imperial (ft/lb)'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-muted-foreground block mb-0.5">
                Height ({measurementSystem === 'metric' ? 'cm' : 'in'})
              </label>
              <Input type="number" value={height} onChange={e => setHeight(e.target.value)} className="h-7 text-xs" placeholder={measurementSystem === 'metric' ? '175' : '70'} />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground block mb-0.5">
                Weight ({measurementSystem === 'metric' ? 'kg' : 'lb'})
              </label>
              <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="h-7 text-xs" placeholder={measurementSystem === 'metric' ? '82' : '180'} />
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

const DashboardView = ({ compounds, stackAnalysis, aiLoading, needsRefresh, toleranceLevel, onAnalyzeStack, onViewAIInsights, onViewOutcomes, goals = [], userId, profile, toleranceHistory = [], onUpdateProfile, onToleranceChange, measurementSystem = 'metric', doseUnitPreference = 'mg', onNavigateToInventory, conversationManager, appFeatures, onEnableFeature, onAddCompound }: DashboardViewProps) => {
  const { readings, fetchReadings, addReading } = useGoalReadings(userId);
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

  // Filter out dormant compounds from coverage calculations
  const activeCompounds = useMemo(() =>
    compounds.filter(c => !c.notes?.includes('[DORMANT]')),
    [compounds]
  );

  const compoundNameIds = useMemo(() =>
    activeCompounds.map(c => c.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')),
    [activeCompounds]
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

  const f = appFeatures || { goal_tracking: true, supplementation: true, inventory_tracking: true, dosing_reorder: true, medical_records: true };

  return (
    <div className="space-y-3">
      {/* Profile & Tolerance Info Bar */}
      <ProfileToleranceBar
        profile={{ ...profile, gender: displayGender }}
        toleranceLevel={toleranceLevel}
        toleranceHistory={toleranceHistory}
        onUpdateProfile={onUpdateProfile}
        onToleranceChange={onToleranceChange}
        onGenderChange={handleGenderChange}
        measurementSystem={measurementSystem}
        onNavigateToInventory={onNavigateToInventory}
      />

      {/* Protocol Coverage — supplementation feature */}
      {f.supplementation ? (
        <div className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-semibold flex items-center gap-1.5">
              Protocol Coverage
              <InfoTooltip text="Shows how well your compounds cover 7 body zones (brain, heart, arms, core, hormonal, legs, immune). Higher % means broader protection." />
            </h2>
            <span className="text-lg font-mono font-bold text-primary">{bodyCoverage}%</span>
          </div>
          <div className="h-2 bg-secondary/50 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-gradient-to-r from-primary to-chart-2 rounded-full transition-all duration-700" style={{ width: `${bodyCoverage}%` }} />
          </div>
          <p className="text-[9px] text-muted-foreground/60 mb-3 leading-snug">
            {activeCompounds.length} active compounds · {coverageRationale}
          </p>

          {/* Empty state CTA when no active compounds */}
          {activeCompounds.length === 0 ? (
            <div className="py-10 flex items-center justify-center">
              <div className="text-center">
                <Package className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-1">No Compounds Yet</h3>
                <p className="text-xs text-muted-foreground mb-4">Add your first compound to see body zone coverage and protocol analysis.</p>
                {onAddCompound && (
                  <button
                    onClick={onAddCompound}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    Add Compound
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>

          {/* Body avatar with floating zone badges */}
          <div className="relative flex justify-center my-4">
            <div className="relative">
              <img
                src={displayGender === 'female' ? bodyFemaleImg : bodyMaleImg}
                alt={displayGender === 'female' ? 'Female body' : 'Male body'}
                className="h-72 w-auto rounded-xl object-contain"
              />
              {(() => {
                const zonePositions: Record<BodyZone, { top: string; left?: string; right?: string }> = {
                  brain: { top: '2%', right: '-10%' },
                  heart: { top: '22%', right: '-12%' },
                  arms: { top: '28%', left: '-12%' },
                  core: { top: '45%', right: '-12%' },
                  hormonal: { top: '52%', left: '-12%' },
                  legs: { top: '72%', right: '-10%' },
                  immune: { top: '38%', left: '-10%' },
                };
                return (Object.entries(zoneIntensities) as Array<[BodyZone, number]>)
                  .filter(([, v]) => v > 0.1)
                  .map(([zone, intensity]) => {
                    const pos = zonePositions[zone];
                    if (!pos) return null;
                    const pct = Math.round(intensity * 100);
                    return (
                      <button
                        key={zone}
                        onClick={() => handleZoneTap(zone)}
                        className="absolute flex items-center gap-1 px-2 py-0.5 rounded-full bg-card/80 backdrop-blur-sm border border-border/30 hover:border-primary/50 transition-all active:scale-95 shadow-lg"
                        style={{ top: pos.top, left: pos.left, right: pos.right }}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: BODY_ZONES[zone].color,
                            boxShadow: `0 0 ${4 + intensity * 8}px ${BODY_ZONES[zone].color}`,
                          }}
                        />
                        <span className="text-[10px] font-mono font-semibold text-foreground">{pct}%</span>
                      </button>
                    );
                  });
              })()}
            </div>
          </div>
           <p className="text-[10px] text-muted-foreground/50 text-center mb-3">Tap a zone to view compounds &amp; impact</p>

           <ZoneLegend zoneIntensities={zoneIntensities} onZoneTap={handleZoneTap} />
            </>
          )}
        </div>
      ) : (
        <FeatureTeaserCard featureKey="supplementation" onEnable={() => onEnableFeature?.('supplementation')} />
      )}

      {/* Goal Progress */}
      {f.goal_tracking ? (
        <div className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Goal Progress
              <InfoTooltip text="Track your health goals over time. Add readings to see progress percentage and sparkline trends." />
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={onViewOutcomes} className="text-xs text-primary hover:underline">View All</button>
              <span className="text-lg font-mono font-bold text-primary">{overallProgress}%</span>
            </div>
          </div>

          <div className="h-2 bg-secondary/50 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${overallProgress}%` }} />
          </div>

          {activeGoals.length > 0 ? (
            <div className="space-y-2">
              {activeGoals.map(goal => {
                const goalReadings = readings.get(goal.id!) || [];
                const firstReading = goalReadings.length > 0 ? goalReadings[0].value : undefined;
                const progress = getProgress(goal, firstReading);
                const GoalIcon = getGoalIcon(goal.goal_type);
                const progressVal = progress ?? 0;
                const barColor = progressVal >= 75 ? 'bg-emerald-500' : progressVal >= 40 ? 'bg-primary' : progressVal >= 15 ? 'bg-amber-500' : 'bg-muted-foreground/40';
                const sparkData = goalReadings.slice(-7).map(r => r.value);

                return (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    GoalIcon={GoalIcon}
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
            <div className="py-8 flex items-center justify-center">
              <div className="text-center">
                <Target className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-1">No Active Goals</h3>
                <p className="text-xs text-muted-foreground mb-4">Set health goals to track biomarkers, body composition, and more.</p>
                <button
                  onClick={onViewOutcomes}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  Create Your First Goal
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <FeatureTeaserCard featureKey="goal_tracking" onEnable={() => onEnableFeature?.('goal_tracking')} />
      )}

      {/* Inventory Tracking teaser */}
      {!f.inventory_tracking && (
        <FeatureTeaserCard featureKey="inventory_tracking" onEnable={() => onEnableFeature?.('inventory_tracking')} />
      )}

      {/* Dosing & Reorder teaser */}
      {!f.dosing_reorder && (
        <FeatureTeaserCard featureKey="dosing_reorder" onEnable={() => onEnableFeature?.('dosing_reorder')} />
      )}

      {/* Medical Records teaser */}
      {!f.medical_records && (
        <FeatureTeaserCard featureKey="medical_records" onEnable={() => onEnableFeature?.('medical_records')} />
      )}

      {/* Protocol Intelligence */}
      {f.supplementation && onAnalyzeStack && (
        <ProtocolIntelligenceCard
          analysis={stackAnalysis ?? null}
          loading={aiLoading ?? false}
          needsRefresh={needsRefresh ?? false}
          toleranceLevel={toleranceLevel}
          onRefresh={onAnalyzeStack}
          onViewDetails={onViewAIInsights ?? (() => {})}
        />
      )}

      {f.supplementation && <ProtocolOutcomesCard />}

      <ZoneDetailDrawer
        zone={selectedZone}
        open={zoneDrawerOpen}
        onOpenChange={setZoneDrawerOpen}
        compounds={activeCompounds}
        toleranceLevel={toleranceLevel}
        measurementSystem={measurementSystem}
        profile={profile}
        goals={goals}
        userId={userId}
        conversationManager={conversationManager}
      />
    </div>
  );
};

export default DashboardView;
