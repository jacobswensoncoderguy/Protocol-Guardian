import { useState, useEffect, useMemo, useCallback } from 'react';
import { Compound } from '@/data/compounds';
import { Target, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { StackAnalysis } from '@/hooks/useProtocolAnalysis';
import { UserGoal } from '@/hooks/useGoals';
import { useGoalReadings } from '@/hooks/useGoalReadings';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ProtocolOutcomesCard from '@/components/ProtocolOutcomesCard';
import ProtocolIntelligenceCard from '@/components/ProtocolIntelligenceCard';
import MiniSparkline from '@/components/MiniSparkline';
import { computeZoneIntensities, BODY_ZONES, BodyZone } from '@/data/bodyZoneMapping';
import GeometricBody from '@/components/GeometricBody';
import ZoneDetailDrawer from '@/components/ZoneDetailDrawer';

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
}

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

const DashboardView = ({ compounds, stackAnalysis, aiLoading, needsRefresh, toleranceLevel, onAnalyzeStack, onViewAIInsights, onViewOutcomes, goals = [], userId }: DashboardViewProps) => {
  const { readings, fetchReadings, addReading } = useGoalReadings(userId);
  const [activeScreen, setActiveScreen] = useState(0);
  const [selectedZone, setSelectedZone] = useState<BodyZone | null>(null);
  const [zoneDrawerOpen, setZoneDrawerOpen] = useState(false);

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
    const covered = zones.filter(v => v > 0.3).length;
    return Math.round((covered / zones.length) * 100);
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
              <p className="text-[10px] text-muted-foreground/60 mb-2">
                {compounds.length} compounds · {bodyCoverage}% body coverage
              </p>

              {/* Wireframe body – no 3D, no orbit controls */}
              <div className="relative w-full flex-1 flex items-center justify-center" style={{ minHeight: 340 }}>
                <div className="w-[260px] h-[380px]">
                  <GeometricBody zoneIntensities={zoneIntensities} onZoneTap={handleZoneTap} />
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
