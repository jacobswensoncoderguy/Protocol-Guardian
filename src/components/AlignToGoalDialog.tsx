import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Target, Plus, Link2, Loader2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UserGoal } from '@/hooks/useGoals';
import { toast } from 'sonner';
import DatePickerInput from '@/components/DatePickerInput';

interface Biomarker {
  name: string;
  value: number;
  unit: string;
  status: string;
  category: string;
  relevant_goal_types?: string[];
}

interface AlignToGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  uploadId: string;
  uploadLabel: string;
  uploadDate: string;
  biomarkers: Biomarker[];
  goals: UserGoal[];
  onGoalAligned: () => void;
  onCreateGoal?: (goals: Omit<UserGoal, 'id' | 'status'>[]) => Promise<void>;
}

const GOAL_TYPE_OPTIONS = [
  { value: 'hormonal', label: 'Hormonal' },
  { value: 'muscle_gain', label: 'Muscle Gain' },
  { value: 'fat_loss', label: 'Fat Loss' },
  { value: 'cardiovascular', label: 'Cardiovascular' },
  { value: 'cognitive', label: 'Cognitive' },
  { value: 'longevity', label: 'Longevity' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'libido', label: 'Libido' },
  { value: 'custom', label: 'Custom' },
];

export default function AlignToGoalDialog({
  open,
  onOpenChange,
  userId,
  uploadId,
  uploadLabel,
  uploadDate,
  biomarkers,
  goals,
  onGoalAligned,
  onCreateGoal,
}: AlignToGoalDialogProps) {
  const [mode, setMode] = useState<'choose' | 'existing' | 'new'>('choose');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [selectedMarkers, setSelectedMarkers] = useState<Set<string>>(
    new Set(biomarkers.filter(b => b.status !== 'normal').map(b => b.name))
  );
  const [saving, setSaving] = useState(false);
  const [showMarkers, setShowMarkers] = useState(false);

  // New goal form
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalType, setNewGoalType] = useState('hormonal');
  const [newGoalUnit, setNewGoalUnit] = useState('');
  const [newGoalBaseline, setNewGoalBaseline] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalDate, setNewGoalDate] = useState('');

  const activeGoals = goals.filter(g => g.status === 'active');

  const toggleMarker = (name: string) => {
    const next = new Set(selectedMarkers);
    next.has(name) ? next.delete(name) : next.add(name);
    setSelectedMarkers(next);
  };

  const handleAlignToExisting = async () => {
    if (!selectedGoalId || !userId) return;
    const goal = goals.find(g => g.id === selectedGoalId);
    if (!goal) return;

    setSaving(true);
    try {
      // Find markers to link
      const markersToLink = biomarkers.filter(b => selectedMarkers.has(b.name));
      if (markersToLink.length === 0) {
        toast.error('Select at least one marker to align');
        return;
      }

      // Pick best marker match for this goal (unit match, or first selected)
      const bestMarker =
        markersToLink.find(b => goal.target_unit && b.unit.toLowerCase() === goal.target_unit.toLowerCase()) ||
        markersToLink[0];

      // Insert a goal reading
      const { error: readingError } = await supabase.from('user_goal_readings').insert({
        user_id: userId,
        user_goal_id: selectedGoalId,
        value: bestMarker.value,
        unit: bestMarker.unit,
        reading_date: uploadDate,
        notes: `${bestMarker.name} from ${uploadLabel} (${bestMarker.status})`,
        source: 'labs',
      });
      if (readingError) throw readingError;

      // Update goal current_value
      await (supabase as any)
        .from('user_goals')
        .update({ current_value: bestMarker.value })
        .eq('id', selectedGoalId);

      // Link the upload record to the goal
      await supabase.from('user_goal_uploads').update({ user_goal_id: selectedGoalId }).eq('id', uploadId);

      toast.success(`Linked "${bestMarker.name}" → "${goal.title}" · Progress updated`);
      onGoalAligned();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to align');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndAlign = async () => {
    if (!newGoalTitle.trim() || !userId || !onCreateGoal) return;
    setSaving(true);
    try {
      const markersToLink = biomarkers.filter(b => selectedMarkers.has(b.name));
      const bestMarker = markersToLink[0];

      // Create the goal
      await onCreateGoal([{
        goal_type: newGoalType,
        title: newGoalTitle.trim(),
        description: `Aligned from lab record: ${uploadLabel}`,
        target_unit: newGoalUnit || bestMarker?.unit || '',
        baseline_value: newGoalBaseline ? parseFloat(newGoalBaseline) : bestMarker?.value,
        target_value: newGoalTarget ? parseFloat(newGoalTarget) : undefined,
        current_value: bestMarker?.value,
        target_date: newGoalDate || undefined,
        baseline_date: uploadDate,
        baseline_label: 'Lab Baseline',
        target_label: 'Target',
        priority: 2,
      }]);

      // Fetch fresh goals to get the new ID
      const { data: freshGoals } = await (supabase as any)
        .from('user_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('title', newGoalTitle.trim())
        .order('created_at', { ascending: false })
        .limit(1);

      const newGoal = freshGoals?.[0];
      if (newGoal && bestMarker) {
        // Add baseline reading
        await supabase.from('user_goal_readings').insert({
          user_id: userId,
          user_goal_id: newGoal.id,
          value: bestMarker.value,
          unit: bestMarker.unit,
          reading_date: uploadDate,
          notes: `Baseline from ${uploadLabel}`,
          source: 'labs',
        });
        // Link upload
        await supabase.from('user_goal_uploads').update({ user_goal_id: newGoal.id }).eq('id', uploadId);
      }

      toast.success(`Goal "${newGoalTitle}" created and aligned to ${uploadLabel}`);
      onGoalAligned();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create goal');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setMode('choose');
      setSelectedGoalId('');
      setShowMarkers(false);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm max-h-[88vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground text-sm">
            <Link2 className="w-4 h-4 text-primary" />
            Align Lab to a Goal
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-1">
          Connect <span className="font-medium text-foreground">"{uploadLabel}"</span> to a health goal to update progress meters, trend lines, and timelines.
        </p>

        {/* ── Mode Select ── */}
        {mode === 'choose' && (
          <div className="space-y-2 pt-1">
            <button
              onClick={() => setMode('existing')}
              disabled={activeGoals.length === 0}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border/50 bg-secondary/20 hover:bg-secondary/40 transition-colors text-left disabled:opacity-40"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Target className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Assign to Existing Goal</p>
                <p className="text-xs text-muted-foreground">{activeGoals.length} active goal{activeGoals.length !== 1 ? 's' : ''}</p>
              </div>
            </button>

            <button
              onClick={() => setMode('new')}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Plus className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Create New Goal</p>
                <p className="text-xs text-muted-foreground">Use this lab as the baseline</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Assign to Existing ── */}
        {mode === 'existing' && (
          <div className="space-y-3 pt-1">
            <button onClick={() => setMode('choose')} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              ← Back
            </button>

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Select Goal</p>
              {activeGoals.map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGoalId(g.id!)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors text-left ${
                    selectedGoalId === g.id
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-border/40 bg-secondary/20 hover:bg-secondary/40'
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold text-foreground">{g.title}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{g.goal_type.replace(/_/g, ' ')} {g.target_unit ? `· ${g.target_unit}` : ''}</p>
                  </div>
                  {selectedGoalId === g.id && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
                </button>
              ))}
            </div>

            {/* Marker selector */}
            <div>
              <button
                onClick={() => setShowMarkers(v => !v)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                {showMarkers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Choose markers ({selectedMarkers.size} selected)
              </button>
              {showMarkers && (
                <div className="mt-2 max-h-44 overflow-y-auto space-y-1 pr-1">
                  {biomarkers.map(b => (
                    <label key={b.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/30 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMarkers.has(b.name)}
                        onChange={() => toggleMarker(b.name)}
                        className="rounded accent-primary"
                      />
                      <span className="text-xs text-foreground flex-1">{b.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{b.value} {b.unit}</span>
                      <span className={`text-[10px] ${b.status === 'normal' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {b.status === 'normal' ? '✓' : '⚠'}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleAlignToExisting}
              disabled={!selectedGoalId || saving}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              Align to Goal
            </button>
          </div>
        )}

        {/* ── Create New Goal ── */}
        {mode === 'new' && (
          <div className="space-y-3 pt-1">
            <button onClick={() => setMode('choose')} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              ← Back
            </button>

            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">New Goal Details</p>

              <input
                type="text"
                placeholder="Goal name (e.g. Optimize Testosterone)"
                value={newGoalTitle}
                onChange={e => setNewGoalTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
              />

              <select
                value={newGoalType}
                onChange={e => setNewGoalType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary/30 text-sm text-foreground focus:outline-none focus:border-primary/50"
              >
                {GOAL_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Baseline value"
                  value={newGoalBaseline}
                  onChange={e => setNewGoalBaseline(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border/50 bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                />
                <input
                  type="text"
                  placeholder="Target value"
                  value={newGoalTarget}
                  onChange={e => setNewGoalTarget(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border/50 bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Unit (e.g. ng/dL)"
                  value={newGoalUnit}
                  onChange={e => setNewGoalUnit(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border/50 bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                />
                <DatePickerInput
                  value={newGoalDate}
                  onChange={setNewGoalDate}
                  placeholder="Target date"
                  className="text-sm"
                />
              </div>

              {/* Marker selector for new goal */}
              <div>
                <button
                  onClick={() => setShowMarkers(v => !v)}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  {showMarkers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Primary marker ({selectedMarkers.size} selected)
                </button>
                {showMarkers && (
                  <div className="mt-2 max-h-36 overflow-y-auto space-y-1 pr-1">
                    {biomarkers.map(b => (
                      <label key={b.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/30 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedMarkers.has(b.name)}
                          onChange={() => toggleMarker(b.name)}
                          className="rounded accent-primary"
                        />
                        <span className="text-xs text-foreground flex-1">{b.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{b.value} {b.unit}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleCreateAndAlign}
              disabled={!newGoalTitle.trim() || saving}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create Goal & Align
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
