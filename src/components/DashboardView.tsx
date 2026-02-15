import { useState, useEffect, useCallback } from 'react';
import { Compound, getStatus } from '@/data/compounds';
import { getDaysRemainingWithCycling } from '@/lib/cycling';
import { Target, TrendingUp, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import CompoundInfoDrawer from '@/components/CompoundInfoDrawer';
import ProtocolOutcomesCard from '@/components/ProtocolOutcomesCard';
import ProtocolIntelligenceCard from '@/components/ProtocolIntelligenceCard';
import { StackAnalysis } from '@/hooks/useProtocolAnalysis';
import { UserGoal } from '@/hooks/useGoals';
import { GoalReading, useGoalReadings } from '@/hooks/useGoalReadings';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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

const QuickAddGoalCard = ({ goal, icon, progress, progressVal, barColor, onViewOutcomes, onAddReading }: {
  goal: UserGoal; icon: string; progress: number | null; progressVal: number; barColor: string;
  onViewOutcomes?: () => void; onAddReading: (value: number) => Promise<void>;
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
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={onViewOutcomes}>
          <span className="text-sm flex-shrink-0">{icon}</span>
          <span className="text-xs text-foreground truncate">{goal.title}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {goal.current_value != null && goal.target_unit && (
            <span className="text-[10px] font-mono text-muted-foreground">
              {goal.current_value}{goal.target_unit}
              {goal.target_value != null && ` → ${goal.target_value}${goal.target_unit}`}
            </span>
          )}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-0.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-primary"
                title="Quick add reading"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="end" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
                <Input
                  type="number"
                  step="any"
                  placeholder={goal.target_unit || 'Value'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="h-7 text-xs"
                  autoFocus
                />
                <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={submitting || !value}>
                  Add
                </Button>
              </form>
            </PopoverContent>
          </Popover>
          <span className="text-xs font-mono font-semibold text-foreground w-8 text-right">
            {progress !== null ? `${progress}%` : '—'}
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${progressVal}%` }}
        />
      </div>
    </div>
  );
};

const DashboardView = ({ compounds, stackAnalysis, aiLoading, needsRefresh, toleranceLevel, onAnalyzeStack, onViewAIInsights, onViewOutcomes, goals = [], userId }: DashboardViewProps) => {
  const [selectedCompound, setSelectedCompound] = useState<Compound | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { readings, fetchReadings, addReading } = useGoalReadings(userId);

  const activeGoals = goals.filter(g => g.status === 'active');

  useEffect(() => {
    if (activeGoals.length > 0) {
      fetchReadings(activeGoals.map(g => g.id!).filter(Boolean));
    }
  }, [activeGoals.length]);

  const overallProgress = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((sum, g) => {
        const goalReadings = readings.get(g.id!) || [];
        const firstReading = goalReadings.length > 0 ? goalReadings[0].value : undefined;
        const p = getProgress(g, firstReading);
        return sum + (p ?? 0);
      }, 0) / activeGoals.length)
    : 0;

  const onTrackCount = activeGoals.filter(g => {
    const goalReadings = readings.get(g.id!) || [];
    const firstReading = goalReadings.length > 0 ? goalReadings[0].value : undefined;
    const p = getProgress(g, firstReading);
    return p !== null && p >= 40;
  }).length;

  return (
    <div className="space-y-4">
      {/* Goal Progress Overview */}
      {activeGoals.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Goal Progress
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={onViewOutcomes} className="text-xs text-primary hover:underline">View All</button>
              <span className="text-xs text-muted-foreground">{onTrackCount} of {activeGoals.length} on track</span>
              <span className="text-lg font-mono font-bold text-primary">{overallProgress}%</span>
            </div>
          </div>

          {/* Overall bar */}
          <div className="h-2 bg-secondary rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          {/* Individual goals */}
          <div className="space-y-2.5">
            {activeGoals.map(goal => {
              const goalReadings = readings.get(goal.id!) || [];
              const firstReading = goalReadings.length > 0 ? goalReadings[0].value : undefined;
              const progress = getProgress(goal, firstReading);
              const icon = GOAL_TYPE_ICONS[goal.goal_type] || '🎯';
              const progressVal = progress ?? 0;
              const barColor = progressVal >= 75 ? 'bg-emerald-500' : progressVal >= 40 ? 'bg-primary' : progressVal >= 15 ? 'bg-amber-500' : 'bg-muted-foreground/40';

              return (
                <QuickAddGoalCard
                  key={goal.id}
                  goal={goal}
                  icon={icon}
                  progress={progress}
                  progressVal={progressVal}
                  barColor={barColor}
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
        </div>
      )}

      {/* No goals state */}
      {activeGoals.length === 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-6 text-center">
          <Target className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-foreground mb-1">No Active Goals</h3>
          <p className="text-xs text-muted-foreground">Set health goals to track your progress here.</p>
        </div>
      )}

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

      {/* Protocol Outcomes */}
      <ProtocolOutcomesCard />

      <CompoundInfoDrawer
        compound={selectedCompound}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
};

export default DashboardView;
