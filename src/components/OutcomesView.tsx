import { useState, useEffect } from 'react';
import { Target, TrendingUp, Plus, Activity, ChevronDown, ChevronUp, Ruler, Weight, Percent, Calendar as CalendarIcon, Trash2, Edit2, X, Check } from 'lucide-react';
import { getGoalIcon } from '@/lib/goalIcons';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { UserGoal } from '@/hooks/useGoals';
import { GoalReading, useGoalReadings } from '@/hooks/useGoalReadings';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/hooks/useProfile';
import { MeasurementSystem, displayHeight, displayWeight } from '@/lib/measurements';
import BiomarkerHistoryView from './BiomarkerHistoryView';
import AddGoalDialog from './AddGoalDialog';
import ConfirmDialog from './ConfirmDialog';
import { toast } from 'sonner';

interface OutcomesViewProps {
  userId?: string;
  goals: UserGoal[];
  onRefreshGoals: () => void;
  onUploadClick?: () => void;
  profile?: UserProfile | null;
  measurementSystem?: MeasurementSystem;
  onCreateGoal?: (goals: Omit<UserGoal, 'id' | 'status'>[]) => Promise<void>;
  onUpdateGoal?: (goalId: string, updates: Partial<UserGoal>) => Promise<void>;
  onDeleteGoal?: (goalId: string) => Promise<void>;
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

function getDaysUntil(dateStr?: string): string | null {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 7) return `${diff}d left`;
  if (diff <= 30) return `${Math.ceil(diff / 7)}w left`;
  return `${Math.ceil(diff / 30)}mo left`;
}

const OutcomesView = ({ userId, goals, onRefreshGoals, onUploadClick, profile, measurementSystem = 'metric', onCreateGoal, onUpdateGoal, onDeleteGoal }: OutcomesViewProps) => {
  const { readings, loading: readingsLoading, fetchReadings, addReading } = useGoalReadings(userId);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [addReadingGoal, setAddReadingGoal] = useState<string | null>(null);
  const [newReadingValue, setNewReadingValue] = useState('');
  const [newReadingUnit, setNewReadingUnit] = useState('');
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [deleteConfirmGoal, setDeleteConfirmGoal] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    target_value: string;
    baseline_value: string;
    target_unit: string;
    target_date: string;
    description: string;
  }>({ title: '', target_value: '', baseline_value: '', target_unit: '', target_date: '', description: '' });

  const activeGoals = goals.filter(g => g.status === 'active');

  useEffect(() => {
    if (activeGoals.length > 0) {
      fetchReadings(activeGoals.map(g => g.id!).filter(Boolean));
    }
  }, [activeGoals.length]);
  const handleAddReading = async (goalId: string) => {
    const val = parseFloat(newReadingValue);
    if (isNaN(val)) return;
    await addReading(goalId, val, newReadingUnit || 'units');
    await (supabase as any).from('user_goals').update({ current_value: val }).eq('id', goalId);
    setAddReadingGoal(null);
    setNewReadingValue('');
    setNewReadingUnit('');
    onRefreshGoals();
    toast.success('Reading logged');
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (onDeleteGoal) {
      await onDeleteGoal(goalId);
      toast.success('Goal deleted');
    }
    setDeleteConfirmGoal(null);
  };

  const startEditing = (goal: UserGoal) => {
    setEditingGoalId(goal.id!);
    setEditForm({
      title: goal.title,
      target_value: goal.target_value?.toString() || '',
      baseline_value: goal.baseline_value?.toString() || '',
      target_unit: goal.target_unit || '',
      target_date: goal.target_date || '',
      description: goal.description || '',
    });
  };

  const handleSaveEdit = async (goalId: string) => {
    if (onUpdateGoal && editForm.title.trim()) {
      await onUpdateGoal(goalId, {
        title: editForm.title.trim(),
        target_value: editForm.target_value ? parseFloat(editForm.target_value) : undefined,
        baseline_value: editForm.baseline_value ? parseFloat(editForm.baseline_value) : undefined,
        target_unit: editForm.target_unit || undefined,
        target_date: editForm.target_date || undefined,
        description: editForm.description || undefined,
      });
      toast.success('Goal updated');
    }
    setEditingGoalId(null);
  };

  const handleCreateGoal = async (goal: Omit<UserGoal, 'id' | 'status'>) => {
    if (onCreateGoal) {
      await onCreateGoal([goal]);
      toast.success('Goal created');
    }
  };

  const overallProgress = activeGoals.reduce((sum, g) => {
    const goalReadings = readings.get(g.id!) || [];
    const firstVal = goalReadings.length > 0 ? goalReadings[0].value : undefined;
    const p = getProgress(g, firstVal);
    return sum + (p ?? 0);
  }, 0) / (activeGoals.length || 1);

  return (
    <div className="space-y-4">
      {/* Persistent Measurements Bar */}
      {profile && (profile.height_cm || profile.weight_kg || profile.body_fat_pct || profile.age) && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/30 border border-border/20 text-[10px] text-muted-foreground">
          {profile.height_cm && <span className="flex items-center gap-0.5"><Ruler className="w-3 h-3" />{displayHeight(profile.height_cm, measurementSystem)}</span>}
          {profile.weight_kg && <span className="flex items-center gap-0.5"><Weight className="w-3 h-3" />{displayWeight(profile.weight_kg, measurementSystem)}</span>}
          {profile.body_fat_pct != null && <span className="flex items-center gap-0.5"><Percent className="w-3 h-3" />{profile.body_fat_pct}%</span>}
          {profile.age && <span className="flex items-center gap-0.5"><CalendarIcon className="w-3 h-3" />{profile.age}y</span>}
        </div>
      )}

      {/* Overall Progress Header */}
      <div className="bg-card rounded-xl border border-border/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Overall Progress
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold font-mono text-primary">{Math.round(overallProgress)}%</span>
          </div>
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

      {/* Add Goal Button */}
      <button
        onClick={() => setShowAddGoal(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all text-primary text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        Add New Goal
      </button>

      {activeGoals.length === 0 ? (
        <div className="text-center py-12">
          <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground mb-1">No Active Goals</h3>
          <p className="text-xs text-muted-foreground mb-4">Create measurable health targets with smart metrics and deadlines.</p>
          <button
            onClick={() => setShowAddGoal(true)}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            Create Your First Goal
          </button>
        </div>
      ) : (
        <>
          {/* Goal Progress Cards */}
          <div className="space-y-2">
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
                const isEditing = editingGoalId === goal.id;
                const color = GOAL_TYPE_COLORS[goal.goal_type] || GOAL_TYPE_COLORS.custom;
                const GoalIcon = getGoalIcon(goal.goal_type);
                const deadline = getDaysUntil(goal.target_date);

                const chartData = goalReadings.map(r => ({
                  date: new Date(r.reading_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  value: r.value,
                }));

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
                      <span className="text-base"><GoalIcon className="w-4 h-4 text-primary" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          {isEditing ? (
                            <div className="flex items-center gap-1 flex-1 mr-2" onClick={e => e.stopPropagation()}>
                              <input
                                value={editForm.title}
                                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(goal.id!); if (e.key === 'Escape') setEditingGoalId(null); }}
                                className="flex-1 px-2 py-0.5 rounded border border-primary/50 bg-secondary text-sm text-foreground focus:outline-none"
                                autoFocus
                              />
                              <button onClick={() => handleSaveEdit(goal.id!)} className="p-0.5 text-primary"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setEditingGoalId(null)} className="p-0.5 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-foreground truncate">{goal.title}</span>
                          )}
                          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                            {deadline && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                                deadline === 'overdue' ? 'bg-destructive/15 text-destructive' :
                                deadline.includes('d') ? 'bg-amber-500/15 text-amber-400' :
                                'bg-primary/10 text-primary'
                              }`}>
                                {deadline}
                              </span>
                            )}
                            {progress !== null && (
                              <span className="text-xs font-mono text-primary">{progress}%</span>
                            )}
                          </div>
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
                          {goal.target_date && (
                            <span className="text-[10px] text-muted-foreground/60">
                              · Achieve by: {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                          {(!goal.target_value || !goal.target_unit) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-mono ml-1">⚠ unmeasurable</span>
                          )}
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                    </button>

                    {/* Expanded: chart + readings */}
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3 border-t border-border/30 pt-3">
                        {/* Action buttons */}
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => startEditing(goal)}
                            className="text-[10px] flex items-center gap-1 px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirmGoal(goal.id!)}
                            className="text-[10px] flex items-center gap-1 px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>

                        {/* Inline Edit Form */}
                        {isEditing && (
                          <div className="space-y-2 p-3 rounded-lg bg-secondary/20 border border-primary/20" onClick={e => e.stopPropagation()}>
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Title</label>
                              <input
                                value={editForm.title}
                                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50"
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Baseline</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={editForm.baseline_value}
                                  onChange={e => setEditForm(f => ({ ...f, baseline_value: e.target.value }))}
                                  placeholder="—"
                                  className="w-full px-2 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Target</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={editForm.target_value}
                                  onChange={e => setEditForm(f => ({ ...f, target_value: e.target.value }))}
                                  placeholder="—"
                                  className="w-full px-2 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Unit</label>
                                <input
                                  value={editForm.target_unit}
                                  onChange={e => setEditForm(f => ({ ...f, target_unit: e.target.value }))}
                                  placeholder="e.g. lbs, %"
                                  className="w-full px-2 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                                <CalendarIcon className="w-3 h-3" /> Achievement Date
                              </label>
                              <input
                                type="date"
                                value={editForm.target_date}
                                onChange={e => setEditForm(f => ({ ...f, target_date: e.target.value }))}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Notes</label>
                              <textarea
                                value={editForm.description}
                                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Additional context..."
                                rows={2}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveEdit(goal.id!)}
                                className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
                              >
                                Save Changes
                              </button>
                              <button
                                onClick={() => setEditingGoalId(null)}
                                className="px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

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

                        {/* Recent readings with timestamps */}
                        {goalReadings.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                              Reading History ({goalReadings.length} entries)
                            </p>
                            <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
                              {goalReadings.slice().reverse().map(r => (
                                <div key={r.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-secondary/30">
                                  <span className="text-muted-foreground">
                                    {new Date(r.reading_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                  <span className="font-mono text-foreground font-medium">
                                    {r.value} {r.unit}
                                  </span>
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
                              step="any"
                              value={newReadingValue}
                              onChange={e => setNewReadingValue(e.target.value)}
                              placeholder={goal.target_unit || 'Value'}
                              className="flex-1 px-2.5 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                              autoFocus
                            />
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">{goal.target_unit || ''}</span>
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

        </>
      )}

      {/* Biomarker History */}
      <BiomarkerHistoryView userId={userId} onUploadClick={onUploadClick || (() => {})} />

      {/* Add Goal Dialog */}
      <AddGoalDialog
        open={showAddGoal}
        onOpenChange={setShowAddGoal}
        onCreateGoal={handleCreateGoal}
        existingGoals={goals}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirmGoal}
        onOpenChange={(o) => { if (!o) setDeleteConfirmGoal(null); }}
        title="Delete Goal"
        description="This will permanently delete this goal and all its progress data. Are you sure?"
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteConfirmGoal && handleDeleteGoal(deleteConfirmGoal)}
      />
    </div>
  );
};

export default OutcomesView;
