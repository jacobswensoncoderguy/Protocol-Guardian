import { useState, useEffect, useCallback } from 'react';
import { Target, TrendingUp, Plus, Loader2, RefreshCw, Activity, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { UserGoal } from '@/hooks/useGoals';
import { GoalReading, useGoalReadings } from '@/hooks/useGoalReadings';
import { supabase } from '@/integrations/supabase/client';

interface OutcomesViewProps {
  userId?: string;
  goals: UserGoal[];
  onRefreshGoals: () => void;
}

const GOAL_TYPE_COLORS: Record<string, string> = {
  muscle_gain: 'hsl(var(--chart-2))',
  fat_loss: 'hsl(var(--chart-4))',
  cardiovascular: 'hsl(var(--destructive))',
  cognitive: 'hsl(var(--chart-5))',
  hormonal: 'hsl(var(--primary))',
  longevity: 'hsl(var(--chart-3))',
  recovery: 'hsl(var(--chart-2))',
  sleep: 'hsl(var(--chart-5))',
  libido: 'hsl(var(--chart-4))',
  custom: 'hsl(var(--muted-foreground))',
};

const GOAL_TYPE_ICONS: Record<string, string> = {
  muscle_gain: '💪',
  fat_loss: '🔥',
  cardiovascular: '❤️',
  cognitive: '🧠',
  hormonal: '⚡',
  longevity: '✨',
  recovery: '🩹',
  sleep: '🌙',
  libido: '🔥',
  custom: '🎯',
};

function getProgress(goal: UserGoal, firstReading?: number): number | null {
  const baseline = goal.baseline_value ?? firstReading ?? null;
  if (!goal.target_value || baseline == null) return null;
  const current = goal.current_value ?? baseline;
  const range = goal.target_value - baseline;
  if (range === 0) return 100;
  return Math.min(100, Math.max(0, Math.round(((current - baseline) / range) * 100)));
}

function getStatusColor(progress: number | null): string {
  if (progress === null) return 'bg-muted';
  if (progress >= 75) return 'bg-emerald-500';
  if (progress >= 40) return 'bg-primary';
  if (progress >= 15) return 'bg-amber-500';
  return 'bg-muted-foreground/40';
}

const OutcomesView = ({ userId, goals, onRefreshGoals }: OutcomesViewProps) => {
  const { readings, loading: readingsLoading, fetchReadings, addReading } = useGoalReadings(userId);
  const [bodyImage, setBodyImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [addReadingGoal, setAddReadingGoal] = useState<string | null>(null);
  const [newReadingValue, setNewReadingValue] = useState('');
  const [newReadingUnit, setNewReadingUnit] = useState('');

  const activeGoals = goals.filter(g => g.status === 'active');

  useEffect(() => {
    if (activeGoals.length > 0) {
      fetchReadings(activeGoals.map(g => g.id!).filter(Boolean));
    }
  }, [activeGoals.length]);

  const generateBodyIllustration = useCallback(async () => {
    setImageLoading(true);
    try {
      const bodyAreas = [...new Set(activeGoals.map(g => g.body_area).filter(Boolean))];
      const { data, error } = await supabase.functions.invoke('generate-body-illustration', {
        body: {
          goals: activeGoals.map(g => ({
            title: g.title,
            goal_type: g.goal_type,
            body_area: g.body_area,
            target_value: g.target_value,
            current_value: g.current_value,
            baseline_value: g.baseline_value,
          })),
          bodyAreas,
        },
      });
      if (error) throw error;
      if (data?.imageUrl) setBodyImage(data.imageUrl);
    } catch (e) {
      console.error('Failed to generate body illustration:', e);
    } finally {
      setImageLoading(false);
    }
  }, [activeGoals]);

  const handleAddReading = async (goalId: string) => {
    const val = parseFloat(newReadingValue);
    if (isNaN(val)) return;
    await addReading(goalId, val, newReadingUnit || 'units');
    // Update current_value on the goal
    await (supabase as any).from('user_goals').update({ current_value: val }).eq('id', goalId);
    setAddReadingGoal(null);
    setNewReadingValue('');
    setNewReadingUnit('');
    onRefreshGoals();
  };

  const overallProgress = activeGoals.reduce((sum, g) => {
    const goalReadings = readings.get(g.id!) || [];
    const firstVal = goalReadings.length > 0 ? goalReadings[0].value : undefined;
    const p = getProgress(g, firstVal);
    return sum + (p ?? 0);
  }, 0) / (activeGoals.length || 1);

  if (activeGoals.length === 0) {
    return (
      <div className="text-center py-12">
        <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-foreground mb-1">No Active Goals</h3>
        <p className="text-xs text-muted-foreground">Use the Goal Expansion tool (🎯) to define measurable health targets.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Progress Header */}
      <div className="bg-card rounded-xl border border-border/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Overall Progress
          </h3>
          <span className="text-lg font-bold font-mono text-primary">{Math.round(overallProgress)}%</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-chart-2 rounded-full transition-all duration-700"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-muted-foreground">{activeGoals.length} active goal{activeGoals.length !== 1 ? 's' : ''}</span>
          <span className="text-[10px] text-muted-foreground">
            {activeGoals.filter(g => {
              const gr = readings.get(g.id!) || [];
              return (getProgress(g, gr[0]?.value) ?? 0) >= 75;
            }).length} on track
          </span>
        </div>
      </div>

      {/* Body Illustration + Goals Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* AI Body Illustration */}
        <div className="bg-card rounded-xl border border-border/50 p-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Body Map
            </h3>
            <button
              onClick={generateBodyIllustration}
              disabled={imageLoading}
              className="text-[10px] text-primary hover:underline disabled:opacity-50 flex items-center gap-1"
            >
              {imageLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {bodyImage ? 'Regenerate' : 'Generate'}
            </button>
          </div>

          {bodyImage ? (
            <div className="rounded-lg overflow-hidden border border-border/30">
              <img src={bodyImage} alt="Body progress illustration" className="w-full h-auto" />
            </div>
          ) : (
            <div className="aspect-square rounded-lg bg-secondary/30 border border-dashed border-border/50 flex flex-col items-center justify-center gap-2">
              {imageLoading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-[10px] text-muted-foreground">Generating illustration...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6 text-muted-foreground/40" />
                  <span className="text-[10px] text-muted-foreground">Click generate to create an AI body map</span>
                  <span className="text-[10px] text-muted-foreground/60">based on your goals & progress</span>
                </>
              )}
            </div>
          )}

          {/* Body area legend */}
          {activeGoals.some(g => g.body_area) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[...new Set(activeGoals.map(g => g.body_area).filter(Boolean))].map(area => (
                <span key={area} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {area}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Goal Progress Cards */}
        <div className="lg:col-span-2 space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <Target className="w-3.5 h-3.5" />
            Goal Progress
          </h3>

          {activeGoals.map(goal => {
            const goalReadings = readings.get(goal.id!) || [];
            const firstVal = goalReadings.length > 0 ? goalReadings[0].value : undefined;
            const progress = getProgress(goal, firstVal);
            const isExpanded = expandedGoal === goal.id;
            const isAdding = addReadingGoal === goal.id;
            const color = GOAL_TYPE_COLORS[goal.goal_type] || GOAL_TYPE_COLORS.custom;
            const icon = GOAL_TYPE_ICONS[goal.goal_type] || '🎯';

            const chartData = goalReadings.map(r => ({
              date: new Date(r.reading_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              value: r.value,
            }));

            // Add baseline as first point if we have it
            if (goal.baseline_value != null && chartData.length > 0) {
              chartData.unshift({ date: 'Baseline', value: goal.baseline_value });
            }

            return (
              <div key={goal.id} className="bg-card rounded-lg border border-border/50 overflow-hidden">
                {/* Goal header */}
                <button
                  onClick={() => setExpandedGoal(isExpanded ? null : goal.id!)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/30 transition-colors"
                >
                  <span className="text-base">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground truncate">{goal.title}</span>
                      {progress !== null && (
                        <span className="text-xs font-mono text-primary ml-2 flex-shrink-0">{progress}%</span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getStatusColor(progress)}`}
                        style={{ width: `${progress ?? 0}%` }}
                      />
                    </div>
                    {/* Meta line */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">{goal.goal_type.replace(/_/g, ' ')}</span>
                      {goal.body_area && <span className="text-[10px] text-muted-foreground/60">· {goal.body_area}</span>}
                      {goal.target_value != null && goal.target_unit && (
                        <span className="text-[10px] text-muted-foreground/60">
                          · Target: {goal.target_value} {goal.target_unit}
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                </button>

                {/* Expanded: chart + readings */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3 border-t border-border/30 pt-3">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-secondary/30 rounded-lg px-2.5 py-2 text-center">
                        <span className="text-[10px] text-muted-foreground block">Baseline</span>
                        <span className="text-sm font-mono font-semibold text-foreground">
                          {goal.baseline_value ?? '—'}
                        </span>
                      </div>
                      <div className="bg-secondary/30 rounded-lg px-2.5 py-2 text-center">
                        <span className="text-[10px] text-muted-foreground block">Current</span>
                        <span className="text-sm font-mono font-semibold text-primary">
                          {goal.current_value ?? '—'}
                        </span>
                      </div>
                      <div className="bg-secondary/30 rounded-lg px-2.5 py-2 text-center">
                        <span className="text-[10px] text-muted-foreground block">Target</span>
                        <span className="text-sm font-mono font-semibold text-foreground">
                          {goal.target_value ?? '—'}
                        </span>
                        {goal.target_unit && <span className="text-[10px] text-muted-foreground ml-0.5">{goal.target_unit}</span>}
                      </div>
                    </div>

                    {/* Trend Chart */}
                    {chartData.length >= 2 ? (
                      <div className="h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id={`gradient-${goal.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                              axisLine={false}
                              tickLine={false}
                              width={35}
                              domain={['auto', 'auto']}
                            />
                            <Tooltip
                              contentStyle={{
                                background: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                fontSize: '11px',
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke={color}
                              strokeWidth={2}
                              fill={`url(#gradient-${goal.id})`}
                              dot={{ r: 3, fill: color, strokeWidth: 0 }}
                              activeDot={{ r: 5, fill: color }}
                            />
                            {/* Target line */}
                            {goal.target_value != null && (
                              <Line
                                type="monotone"
                                dataKey={() => goal.target_value}
                                stroke="hsl(var(--muted-foreground))"
                                strokeDasharray="4 4"
                                strokeWidth={1}
                                dot={false}
                                name="Target"
                              />
                            )}
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-24 rounded-lg bg-secondary/20 border border-dashed border-border/40 flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground">Add readings to see trend chart</span>
                      </div>
                    )}

                    {/* Recent readings */}
                    {goalReadings.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Recent Readings</p>
                        <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-thin">
                          {goalReadings.slice(-5).reverse().map(r => (
                            <div key={r.id} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-secondary/30">
                              <span className="text-muted-foreground">{new Date(r.reading_date).toLocaleDateString()}</span>
                              <span className="font-mono text-foreground">{r.value} {r.unit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add Reading */}
                    {isAdding ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={newReadingValue}
                          onChange={e => setNewReadingValue(e.target.value)}
                          placeholder="Value"
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={newReadingUnit || goal.target_unit || ''}
                          onChange={e => setNewReadingUnit(e.target.value)}
                          placeholder="Unit"
                          className="w-20 px-2.5 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                        />
                        <button
                          onClick={() => handleAddReading(goal.id!)}
                          disabled={!newReadingValue}
                          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setAddReadingGoal(null); setNewReadingValue(''); }}
                          className="px-2 py-1.5 rounded-lg bg-secondary text-muted-foreground text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddReadingGoal(goal.id!); setNewReadingUnit(goal.target_unit || ''); }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-primary text-xs font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Log Reading
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Object.entries(
          activeGoals.reduce((acc, g) => {
            const type = g.goal_type.replace(/_/g, ' ');
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).map(([type, count]) => (
          <div key={type} className="bg-card rounded-lg border border-border/50 px-3 py-2 text-center">
            <span className="text-lg">{GOAL_TYPE_ICONS[type.replace(/ /g, '_')] || '🎯'}</span>
            <p className="text-xs font-medium text-foreground capitalize mt-0.5">{type}</p>
            <p className="text-[10px] text-muted-foreground">{count} goal{count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OutcomesView;
