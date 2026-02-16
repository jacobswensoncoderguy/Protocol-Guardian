import { useState, useEffect } from 'react';
import { Target, TrendingUp, Plus, Activity, ChevronDown, ChevronUp, Ruler, Weight, Percent, Calendar as CalendarIcon, Trash2, Edit2, X, Check, MessageCircle, Clock, Trophy, Pause, RotateCcw, Archive } from 'lucide-react';
import { getGoalIcon } from '@/lib/goalIcons';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { UserGoal } from '@/hooks/useGoals';
import { GoalReading, useGoalReadings } from '@/hooks/useGoalReadings';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/hooks/useProfile';
import { MeasurementSystem, displayHeight, displayWeight } from '@/lib/measurements';
import BiomarkerHistoryView from './BiomarkerHistoryView';
import AddGoalDialog from './AddGoalDialog';
import ConfirmDialog from './ConfirmDialog';
import GoalCardChat from './GoalCardChat';
import GoalCelebration from './GoalCelebration';
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

const NEON_COLORS: Record<string, { glow: string; solid: string; ring: string }> = {
  muscle_gain: { glow: 'hsl(var(--neon-green))', solid: 'hsl(142 80% 50%)', ring: 'shadow-[0_0_12px_hsl(142_80%_50%/0.4)]' },
  fat_loss: { glow: 'hsl(var(--neon-amber))', solid: 'hsl(39 100% 55%)', ring: 'shadow-[0_0_12px_hsl(39_100%_55%/0.4)]' },
  cardiovascular: { glow: 'hsl(var(--destructive))', solid: 'hsl(0 72% 51%)', ring: 'shadow-[0_0_12px_hsl(0_72%_51%/0.4)]' },
  cognitive: { glow: 'hsl(var(--neon-violet))', solid: 'hsl(270 100% 65%)', ring: 'shadow-[0_0_12px_hsl(270_100%_65%/0.4)]' },
  hormonal: { glow: 'hsl(var(--neon-cyan))', solid: 'hsl(190 100% 50%)', ring: 'shadow-[0_0_12px_hsl(190_100%_50%/0.4)]' },
  longevity: { glow: 'hsl(var(--neon-green))', solid: 'hsl(142 80% 50%)', ring: 'shadow-[0_0_12px_hsl(142_80%_50%/0.4)]' },
  recovery: { glow: 'hsl(var(--neon-cyan))', solid: 'hsl(190 100% 50%)', ring: 'shadow-[0_0_12px_hsl(190_100%_50%/0.4)]' },
  sleep: { glow: 'hsl(var(--neon-violet))', solid: 'hsl(270 100% 65%)', ring: 'shadow-[0_0_12px_hsl(270_100%_65%/0.4)]' },
  libido: { glow: 'hsl(var(--neon-magenta))', solid: 'hsl(320 100% 60%)', ring: 'shadow-[0_0_12px_hsl(320_100%_60%/0.4)]' },
  custom: { glow: 'hsl(var(--neon-cyan))', solid: 'hsl(190 100% 50%)', ring: 'shadow-[0_0_12px_hsl(190_100%_50%/0.4)]' },
};

function getProgress(goal: UserGoal, firstReading?: number): number | null {
  const baseline = goal.baseline_value ?? firstReading ?? null;
  if (!goal.target_value || baseline == null) return null;
  const current = goal.current_value ?? baseline;
  const range = goal.target_value - baseline;
  if (range === 0) return 100;
  return Math.min(100, Math.max(0, Math.round(((current - baseline) / range) * 100)));
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

/* ── Neon Radial Gauge ── */
const NeonGauge = ({ value, max, label, color, unit }: { value: number; max: number; label: string; color: string; unit?: string }) => {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ * 0.75; // 270° arc
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="80" viewBox="0 0 80 80">
        {/* Background arc */}
        <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="5"
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
          strokeLinecap="round" transform="rotate(135 40 40)" />
        {/* Neon arc */}
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
          strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(135 40 40)"
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dashoffset 0.8s ease-out' }} />
        <text x="40" y="37" textAnchor="middle" className="fill-foreground text-sm font-mono font-bold">{value}</text>
        {unit && <text x="40" y="50" textAnchor="middle" className="fill-muted-foreground text-[8px]">{unit}</text>}
      </svg>
      <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
    </div>
  );
};

/* ── Neon Progress Bar ── */
const NeonProgressBar = ({ progress, color, label }: { progress: number; color: string; label: string }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      <span className="text-xs font-mono font-bold" style={{ color }}>{Math.round(progress)}%</span>
    </div>
    <div className="h-2 bg-secondary/50 rounded-full overflow-hidden relative">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${progress}%`,
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
          boxShadow: `0 0 12px ${color}66, inset 0 0 4px ${color}33`,
        }}
      />
    </div>
  </div>
);

const OutcomesView = ({ userId, goals, onRefreshGoals, onUploadClick, profile, measurementSystem = 'metric', onCreateGoal, onUpdateGoal, onDeleteGoal }: OutcomesViewProps) => {
  const { readings, loading: readingsLoading, fetchReadings, addReading, updateReading, deleteReading } = useGoalReadings(userId);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [addReadingGoal, setAddReadingGoal] = useState<string | null>(null);
  const [newReadingValue, setNewReadingValue] = useState('');
  const [newReadingUnit, setNewReadingUnit] = useState('');
  const [newReadingDate, setNewReadingDate] = useState('');
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [deleteConfirmGoal, setDeleteConfirmGoal] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingReadingId, setEditingReadingId] = useState<string | null>(null);
  const [editReadingForm, setEditReadingForm] = useState<{ value: string; unit: string; reading_date: string }>({ value: '', unit: '', reading_date: '' });
  const [chatGoal, setChatGoal] = useState<UserGoal | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string; target_value: string; baseline_value: string; target_unit: string; target_date: string; description: string; baseline_date: string; baseline_label: string; target_label: string;
  }>({ title: '', target_value: '', baseline_value: '', target_unit: '', target_date: '', description: '', baseline_date: '', baseline_label: '', target_label: '' });
  const [celebrateGoal, setCelebrateGoal] = useState<UserGoal | null>(null);
  const [showAchievements, setShowAchievements] = useState(false);

  const activeGoals = goals.filter(g => g.status === 'active');
  const inactiveGoals = goals.filter(g => ['achieved', 'paused', 'archived'].includes(g.status));

  useEffect(() => {
    if (activeGoals.length > 0) {
      fetchReadings(activeGoals.map(g => g.id!).filter(Boolean));
    }
  }, [activeGoals.length]);

  const handleAddReading = async (goalId: string) => {
    const val = parseFloat(newReadingValue);
    if (isNaN(val)) return;
    const dateToUse = newReadingDate || undefined;
    await addReading(goalId, val, newReadingUnit || 'units', undefined, dateToUse);
    await (supabase as any).from('user_goals').update({ current_value: val }).eq('id', goalId);
    setAddReadingGoal(null);
    setNewReadingValue('');
    setNewReadingUnit('');
    setNewReadingDate('');
    onRefreshGoals();
    toast.success('Reading logged');

    // Check if goal achieved (milestone detection)
    const goal = goals.find(g => g.id === goalId);
    if (goal && goal.target_value != null && goal.baseline_value != null) {
      const range = goal.target_value - goal.baseline_value;
      const progress = range !== 0 ? ((val - goal.baseline_value) / range) : 0;
      if (progress >= 0.95) {
        setCelebrateGoal({ ...goal, current_value: val });
      }
    }
  };

  const handleChangeGoalStatus = async (goalId: string, newStatus: string) => {
    if (onUpdateGoal) {
      await onUpdateGoal(goalId, { status: newStatus } as any);
      toast.success(newStatus === 'achieved' ? '🏆 Goal achieved!' : newStatus === 'paused' ? 'Goal paused' : 'Goal archived');
    }
  };

  const handleReactivateGoal = async (goalId: string) => {
    if (onUpdateGoal) {
      await onUpdateGoal(goalId, { status: 'active' } as any);
      toast.success('Goal reactivated');
    }
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
      baseline_date: goal.baseline_date || '',
      baseline_label: goal.baseline_label || 'Baseline',
      target_label: goal.target_label || 'Target',
    });
  };

  const handleSaveEdit = async (goalId: string) => {
    if (onUpdateGoal && editForm.title.trim()) {
      const updates: Partial<UserGoal> = {
        title: editForm.title.trim(),
        target_value: editForm.target_value ? parseFloat(editForm.target_value) : undefined,
        baseline_value: editForm.baseline_value ? parseFloat(editForm.baseline_value) : undefined,
        target_unit: editForm.target_unit || undefined,
        target_date: editForm.target_date || undefined,
        description: editForm.description || undefined,
        baseline_date: editForm.baseline_date || undefined,
        baseline_label: editForm.baseline_label || 'Baseline',
        target_label: editForm.target_label || 'Target',
      };
      await onUpdateGoal(goalId, updates);
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
          <span className="text-lg font-bold font-mono" style={{ color: 'hsl(var(--neon-cyan))', textShadow: '0 0 8px hsl(190 100% 50% / 0.5)' }}>{Math.round(overallProgress)}%</span>
        </div>
        <NeonProgressBar progress={overallProgress} color="hsl(var(--neon-cyan))" label={`${activeGoals.length} active goal${activeGoals.length !== 1 ? 's' : ''}`} />
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
          <button onClick={() => setShowAddGoal(true)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
            Create Your First Goal
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
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
              const neon = NEON_COLORS[goal.goal_type] || NEON_COLORS.custom;
              const GoalIcon = getGoalIcon(goal.goal_type);
              const deadline = getDaysUntil(goal.target_date);

              const chartData = goalReadings.map(r => ({
                date: new Date(r.reading_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                value: r.value,
              }));
              if (goal.baseline_value != null && chartData.length > 0) {
                chartData.unshift({ date: 'Baseline', value: goal.baseline_value });
              }

              // Compute time progress for deadline gauge
              let timeProgress = 0;
              const behindSchedule = goal.target_date && progress !== null && (() => {
                const baselineDate = goal.baseline_date
                  ? new Date(goal.baseline_date)
                  : goalReadings[0]?.reading_date
                    ? new Date(goalReadings[0].reading_date)
                    : null;
                if (!baselineDate) return false;
                const target = new Date(goal.target_date!);
                const total = target.getTime() - baselineDate.getTime();
                const elapsed = Date.now() - baselineDate.getTime();
                timeProgress = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 100;
                return timeProgress > progress;
              })();

              return (
                <div key={goal.id} className={`bg-card rounded-xl border overflow-hidden transition-all ${isExpanded ? `border-border/60 ${neon.ring}` : 'border-border/30'}`}>
                  {/* Goal header */}
                  <button
                    onClick={() => setExpandedGoal(isExpanded ? null : goal.id!)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/20 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${neon.solid}15`, boxShadow: `0 0 8px ${neon.solid}22` }}>
                      <GoalIcon className="w-4 h-4" style={{ color: neon.solid }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground truncate">{goal.title}</span>
                        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                          {behindSchedule && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-destructive/15 text-destructive animate-pulse">
                              ⚠ behind
                            </span>
                          )}
                          {deadline && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                              deadline === 'overdue' ? 'bg-destructive/15 text-destructive' :
                              deadline.includes('d') ? 'bg-amber-500/15 text-amber-400' :
                              'bg-primary/10 text-primary'
                            }`}>{deadline}</span>
                          )}
                          {progress !== null && (
                            <span className="text-sm font-mono font-bold" style={{ color: neon.solid, textShadow: `0 0 6px ${neon.solid}55` }}>{progress}%</span>
                          )}
                        </div>
                      </div>
                      {/* Neon progress bar */}
                      <div className="h-1.5 bg-secondary/40 rounded-full overflow-hidden mt-1.5">
                        <div className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${progress ?? 0}%`, background: `linear-gradient(90deg, ${neon.solid}, ${neon.solid}88)`, boxShadow: `0 0 8px ${neon.solid}44` }} />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">{goal.goal_type.replace(/_/g, ' ')}</span>
                        {goal.target_value != null && goal.target_unit && (
                          <span className="text-[10px] text-muted-foreground/60">· Target: {goal.target_value} {goal.target_unit}</span>
                        )}
                        {(!goal.target_value || !goal.target_unit) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-mono ml-1">⚠ unmeasurable</span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  </button>

                  {/* Expanded card */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 border-t border-border/20 pt-4">
                      {/* Action bar */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setChatGoal(goal)}
                          className="text-[11px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all font-medium"
                          style={{ borderColor: `${neon.solid}44`, color: neon.solid, background: `${neon.solid}08` }}>
                          <MessageCircle className="w-3.5 h-3.5" /> Fine-tune with AI
                        </button>
                        <button onClick={() => startEditing(goal)}
                          className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => setDeleteConfirmGoal(goal.id!)}
                          className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                        <button onClick={() => handleChangeGoalStatus(goal.id!, 'achieved')}
                          className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-primary transition-colors">
                          <Trophy className="w-3 h-3" /> Achieved
                        </button>
                        <button onClick={() => handleChangeGoalStatus(goal.id!, 'paused')}
                          className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                          <Pause className="w-3 h-3" /> Stop Tracking
                        </button>
                      </div>

                      {/* Inline Edit Form */}
                      {isEditing && (
                        <div className="space-y-2 p-3 rounded-lg bg-secondary/20 border border-primary/20" onClick={e => e.stopPropagation()}>
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Title</label>
                            <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50" />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">{editForm.baseline_label || 'Baseline'}</label>
                              <input type="number" step="any" value={editForm.baseline_value} onChange={e => setEditForm(f => ({ ...f, baseline_value: e.target.value }))}
                                placeholder="—" className="w-full px-2 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50" />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">{editForm.target_label || 'Target'}</label>
                              <input type="number" step="any" value={editForm.target_value} onChange={e => setEditForm(f => ({ ...f, target_value: e.target.value }))}
                                placeholder="—" className="w-full px-2 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50" />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Unit</label>
                              <input value={editForm.target_unit} onChange={e => setEditForm(f => ({ ...f, target_unit: e.target.value }))}
                                placeholder="e.g. lbs, %" className="w-full px-2 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Baseline Label</label>
                              <input value={editForm.baseline_label} onChange={e => setEditForm(f => ({ ...f, baseline_label: e.target.value }))}
                                placeholder="Baseline" className="w-full px-2 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50" />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Target Label</label>
                              <input value={editForm.target_label} onChange={e => setEditForm(f => ({ ...f, target_label: e.target.value }))}
                                placeholder="Target" className="w-full px-2 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50" />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" /> Baseline Date
                            </label>
                            <input type="date" value={editForm.baseline_date} onChange={e => setEditForm(f => ({ ...f, baseline_date: e.target.value }))}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" /> Achievement Date
                            </label>
                            <input type="date" value={editForm.target_date} onChange={e => setEditForm(f => ({ ...f, target_date: e.target.value }))}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Notes</label>
                            <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                              placeholder="Additional context..." rows={2}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveEdit(goal.id!)} className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Save Changes</button>
                            <button onClick={() => setEditingGoalId(null)} className="px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground text-xs">Cancel</button>
                          </div>
                        </div>
                      )}

                      {/* ── Neon Gauges Row ── */}
                      <div className="flex items-center justify-around">
                        <NeonGauge
                          value={goal.baseline_value ?? 0}
                          max={goal.target_value ?? 100}
                          label={goal.baseline_label || 'Baseline'}
                          color={`${neon.solid}88`}
                          unit={goal.target_unit ?? undefined}
                        />
                        <NeonGauge
                          value={goal.current_value ?? goal.baseline_value ?? 0}
                          max={goal.target_value ?? 100}
                          label="Current"
                          color={neon.solid}
                          unit={goal.target_unit ?? undefined}
                        />
                        <NeonGauge
                          value={goal.target_value ?? 0}
                          max={goal.target_value ?? 100}
                          label={goal.target_label || 'Target'}
                          color={`${neon.solid}66`}
                          unit={goal.target_unit ?? undefined}
                        />
                      </div>

                      {/* ── Progress + Time Bars ── */}
                      <div className="space-y-2">
                        <NeonProgressBar progress={progress ?? 0} color={neon.solid} label="Goal Progress" />
                        {goal.target_date && (
                          <NeonProgressBar
                            progress={timeProgress}
                            color={behindSchedule ? 'hsl(var(--destructive))' : 'hsl(var(--neon-amber))'}
                            label={behindSchedule ? '⚠ Behind Schedule — Time Elapsed' : 'Time Elapsed'}
                          />
                        )}
                      </div>

                      {/* ── Neon Trend Chart ── */}
                      {chartData.length >= 2 ? (
                        <div className="h-40 rounded-lg bg-secondary/10 border border-border/20 p-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <defs>
                                <linearGradient id={`neon-grad-${goal.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={neon.solid} stopOpacity={0.35} />
                                  <stop offset="95%" stopColor={neon.solid} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={32} domain={['auto', 'auto']} />
                              <Tooltip contentStyle={{
                                background: 'hsl(var(--card))', border: `1px solid ${neon.solid}44`,
                                borderRadius: '8px', fontSize: '11px', boxShadow: `0 0 12px ${neon.solid}22`,
                              }} />
                              <Area type="monotone" dataKey="value" stroke={neon.solid} strokeWidth={2.5}
                                fill={`url(#neon-grad-${goal.id})`}
                                dot={{ r: 3, fill: neon.solid, strokeWidth: 0 }}
                                activeDot={{ r: 5, fill: neon.solid, stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                                style={{ filter: `drop-shadow(0 0 4px ${neon.solid}66)` }} />
                              {goal.target_value != null && (
                                <ReferenceLine y={goal.target_value} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={1} label={{ value: 'Target', position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                              )}
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-24 rounded-lg bg-secondary/10 border border-dashed border-border/30 flex items-center justify-center">
                          <span className="text-[10px] text-muted-foreground">Log readings to see neon trend chart</span>
                        </div>
                      )}

                      {/* ── Reading History with Timestamps ── */}
                      {goalReadings.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Reading History ({goalReadings.length} entries)
                          </p>
                          <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                            {goalReadings.slice().reverse().map(r => {
                              const isEditingReading = editingReadingId === r.id;
                              if (isEditingReading) {
                                return (
                                  <div key={r.id} className="px-3 py-2 rounded-lg bg-secondary/30 border border-primary/30 space-y-2">
                                    <div className="grid grid-cols-3 gap-2">
                                      <div>
                                        <label className="text-[8px] text-muted-foreground uppercase">Date</label>
                                        <input type="date" value={editReadingForm.reading_date}
                                          onChange={e => setEditReadingForm(f => ({ ...f, reading_date: e.target.value }))}
                                          className="w-full px-1.5 py-1 rounded border border-border/50 bg-secondary text-[11px] text-foreground focus:outline-none focus:border-primary/50" />
                                      </div>
                                      <div>
                                        <label className="text-[8px] text-muted-foreground uppercase">Value</label>
                                        <input type="number" step="any" value={editReadingForm.value}
                                          onChange={e => setEditReadingForm(f => ({ ...f, value: e.target.value }))}
                                          className="w-full px-1.5 py-1 rounded border border-border/50 bg-secondary text-[11px] text-foreground focus:outline-none focus:border-primary/50" />
                                      </div>
                                      <div>
                                        <label className="text-[8px] text-muted-foreground uppercase">Unit</label>
                                        <input value={editReadingForm.unit}
                                          onChange={e => setEditReadingForm(f => ({ ...f, unit: e.target.value }))}
                                          className="w-full px-1.5 py-1 rounded border border-border/50 bg-secondary text-[11px] text-foreground focus:outline-none focus:border-primary/50" />
                                      </div>
                                    </div>
                                    <div className="flex gap-1.5">
                                      <button onClick={async () => {
                                        await updateReading(r.id, goal.id!, {
                                          value: parseFloat(editReadingForm.value),
                                          unit: editReadingForm.unit,
                                          reading_date: editReadingForm.reading_date,
                                        });
                                        setEditingReadingId(null);
                                        toast.success('Reading updated');
                                      }} className="flex-1 py-1 rounded bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center gap-1">
                                        <Check className="w-3 h-3" /> Save
                                      </button>
                                      <button onClick={() => setEditingReadingId(null)} className="px-2 py-1 rounded bg-secondary text-muted-foreground text-[10px]">Cancel</button>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div key={r.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-secondary/20 border border-border/15 group">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: neon.solid, boxShadow: `0 0 4px ${neon.solid}` }} />
                                    <span className="text-muted-foreground font-mono text-[10px]">
                                      {new Date(r.reading_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold" style={{ color: neon.solid }}>{r.value} {r.unit}</span>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => {
                                        setEditingReadingId(r.id);
                                        setEditReadingForm({ value: String(r.value), unit: r.unit, reading_date: r.reading_date });
                                      }} className="p-0.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground">
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button onClick={async () => {
                                        await deleteReading(r.id, goal.id!);
                                        toast.success('Reading deleted');
                                      }} className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── Log Reading ── */}
                      {isAdding ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input type="number" step="any" value={newReadingValue} onChange={e => setNewReadingValue(e.target.value)}
                              placeholder={goal.target_unit || 'Value'} autoFocus
                              className="flex-1 px-2.5 py-2 rounded-lg border border-border/50 bg-secondary text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50" />
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">{goal.target_unit || ''}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-muted-foreground mb-0.5 block">Date (optional, defaults to today)</label>
                              <input type="date" value={newReadingDate} onChange={e => setNewReadingDate(e.target.value)}
                                max={new Date().toISOString().split('T')[0]}
                                className="w-full px-2.5 py-2 rounded-lg border border-border/50 bg-secondary text-sm text-foreground focus:outline-none focus:border-primary/50" />
                            </div>
                            <button onClick={() => handleAddReading(goal.id!)} disabled={!newReadingValue}
                              className="px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40 transition-all mt-4"
                              style={{ background: neon.solid, color: 'hsl(var(--card))' }}>Save</button>
                            <button onClick={() => { setAddReadingGoal(null); setNewReadingValue(''); setNewReadingDate(''); }}
                              className="px-2 py-2 rounded-lg bg-secondary text-muted-foreground text-xs mt-4">✕</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddReadingGoal(goal.id!); setNewReadingUnit(goal.target_unit || ''); }}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-dashed transition-all text-xs font-medium"
                          style={{ borderColor: `${neon.solid}44`, color: neon.solid, background: `${neon.solid}08` }}>
                          <Plus className="w-3.5 h-3.5" />
                          Log New Reading
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

      {/* ── Achievements & Past Goals ── */}
      {inactiveGoals.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowAchievements(!showAchievements)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/30 border border-border/20 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <span className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-primary" />
              Past Goals & Achievements ({inactiveGoals.length})
            </span>
            {showAchievements ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showAchievements && (
            <div className="space-y-2 mt-2">
              {inactiveGoals.map(goal => {
                const GoalIcon = getGoalIcon(goal.goal_type);
                const neon = NEON_COLORS[goal.goal_type] || NEON_COLORS.custom;
                const statusLabel = goal.status === 'achieved' ? '🏆 Achieved' : goal.status === 'paused' ? '⏸ Paused' : '📦 Archived';
                return (
                  <div key={goal.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-card border border-border/20 opacity-75 hover:opacity-100 transition-opacity">
                    <GoalIcon className="w-4 h-4 flex-shrink-0" style={{ color: neon.solid }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{goal.title}</p>
                      <p className="text-[10px] text-muted-foreground">{statusLabel}</p>
                    </div>
                    <button onClick={() => handleReactivateGoal(goal.id!)}
                      className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0">
                      <RotateCcw className="w-3 h-3" /> Reactivate
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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

      {/* Goal AI Chat */}
      {chatGoal && (
        <GoalCardChat
          open={!!chatGoal}
          onOpenChange={(o) => { if (!o) { setChatGoal(null); onRefreshGoals(); } }}
          goal={chatGoal}
          onUpdateGoal={onUpdateGoal}
        />
      )}

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

      {/* Celebration Overlay */}
      {celebrateGoal && (
        <GoalCelebration
          open={!!celebrateGoal}
          goal={celebrateGoal}
          onClose={() => setCelebrateGoal(null)}
          onSetNewTarget={() => {
            setCelebrateGoal(null);
            startEditing(celebrateGoal);
          }}
          onArchieve={() => {
            handleChangeGoalStatus(celebrateGoal.id!, 'achieved');
            setCelebrateGoal(null);
          }}
          onKeepTracking={() => setCelebrateGoal(null)}
        />
      )}
    </div>
  );
};

export default OutcomesView;
