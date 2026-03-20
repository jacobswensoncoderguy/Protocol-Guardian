import React, { useState } from 'react';
import { Plus, Dumbbell, Clock, Flame, Heart, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkouts, WorkoutSession, WorkoutSet } from '@/hooks/useWorkouts';
import ClickableCard from '@/components/ClickableCard';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';

interface WorkoutTrackerViewProps {
  userId?: string;
}

const WORKOUT_TYPES = ['push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'cardio', 'custom'] as const;

const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio'] as const;

const MUSCLE_COLORS: Record<string, string> = {
  chest: 'hsl(var(--neon-cyan))',
  back: 'hsl(var(--neon-green))',
  shoulders: 'hsl(var(--neon-amber))',
  legs: 'hsl(var(--neon-magenta))',
  arms: 'hsl(var(--neon-violet))',
  core: 'hsl(var(--primary))',
  cardio: 'hsl(var(--destructive))',
};

interface ExerciseRow {
  name: string;
  muscleGroup: string;
  sets: number;
  reps: number;
  weight: number;
}

const WorkoutTrackerView: React.FC<WorkoutTrackerViewProps> = ({ userId }) => {
  const { sessions, loading, addSession, addSets, weeklyWorkoutCount, weeklyVolume, thisWeekSessions } = useWorkouts(userId);
  const [showManualLog, setShowManualLog] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionSets, setSessionSets] = useState<Record<string, WorkoutSet[]>>({});
  const { fetchSetsForSession } = useWorkouts(userId);

  // Manual log form state
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formType, setFormType] = useState<string>('push');
  const [formDuration, setFormDuration] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [exercises, setExercises] = useState<ExerciseRow[]>([
    { name: '', muscleGroup: 'chest', sets: 3, reps: 10, weight: 0 },
  ]);

  const handleAddExercise = () => {
    setExercises(prev => [...prev, { name: '', muscleGroup: 'chest', sets: 3, reps: 10, weight: 0 }]);
  };

  const handleExerciseChange = (idx: number, field: keyof ExerciseRow, value: string | number) => {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const handleSaveWorkout = async () => {
    if (!userId) return;
    const totalVolume = exercises.reduce((sum, e) => sum + (e.sets * e.reps * e.weight), 0);

    const sessionId = await addSession({
      user_id: userId,
      session_date: formDate,
      workout_type: formType,
      program_name: formName || `${formType.replace('_', ' ')} Day`,
      source: 'manual',
      external_id: null,
      duration_minutes: formDuration ? parseInt(formDuration) : null,
      total_volume_lbs: totalVolume || null,
      calories_burned: null,
      avg_heart_rate: null,
      hrv_post_workout: null,
      notes: formNotes || null,
    });

    if (sessionId) {
      const setsToInsert = exercises
        .filter(e => e.name.trim())
        .flatMap((e, eIdx) =>
          Array.from({ length: e.sets }, (_, sIdx) => ({
            session_id: sessionId,
            user_id: userId,
            exercise_name: e.name,
            muscle_group: e.muscleGroup,
            set_number: sIdx + 1,
            reps: e.reps,
            weight_lbs: e.weight,
            is_personal_record: false,
            rpe: null,
          }))
        );
      await addSets(setsToInsert);
      toast.success('Workout logged!');
      setShowManualLog(false);
      setFormName('');
      setFormDuration('');
      setFormNotes('');
      setExercises([{ name: '', muscleGroup: 'chest', sets: 3, reps: 10, weight: 0 }]);
    }
  };

  const toggleExpand = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      return;
    }
    setExpandedSession(sessionId);
    if (!sessionSets[sessionId]) {
      const sets = await fetchSetsForSession(sessionId);
      setSessionSets(prev => ({ ...prev, [sessionId]: sets }));
    }
  };

  // Weekly muscle volume chart data
  const muscleVolume = MUSCLE_GROUPS.map(mg => {
    // Estimate sets from this week's sessions (simplified - would need actual sets data)
    return { name: mg, sets: Math.floor(Math.random() * 15) + 2 }; // placeholder
  });

  return (
    <div className="space-y-4">
      {/* Source Connection Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['Apple Health', 'Hevy', 'Strava'].map(source => (
          <button
            key={source}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border/50 bg-card whitespace-nowrap hover:border-primary/30 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
            {source}
            <span className="text-[9px] text-muted-foreground">Connect</span>
          </button>
        ))}
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-3 gap-2">
        <ClickableCard className="p-3 text-center" showArrow={false}>
          <p className="text-lg font-mono font-bold text-foreground">{weeklyWorkoutCount}</p>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Sessions</p>
        </ClickableCard>
        <ClickableCard className="p-3 text-center" showArrow={false}>
          <p className="text-lg font-mono font-bold text-foreground">{weeklyVolume > 0 ? `${(weeklyVolume / 1000).toFixed(1)}k` : '—'}</p>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Volume (lbs)</p>
        </ClickableCard>
        <ClickableCard className="p-3 text-center" showArrow={false}>
          <p className="text-lg font-mono font-bold text-foreground">—</p>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">PRs</p>
        </ClickableCard>
      </div>

      {/* Manual Log Button */}
      <Button
        onClick={() => setShowManualLog(!showManualLog)}
        variant="outline"
        className="w-full gap-2"
      >
        <Plus className="w-4 h-4" />
        {showManualLog ? 'Cancel' : 'Log Workout Manually'}
      </Button>

      {/* Manual Log Form */}
      {showManualLog && (
        <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3 animate-in slide-in-from-top-2">
          <Input
            placeholder="Session name (e.g. Push Day)"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            className="text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="text-sm" />
            <Select value={formType} onValueChange={setFormType}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WORKOUT_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            placeholder="Duration (minutes)"
            value={formDuration}
            onChange={e => setFormDuration(e.target.value)}
            className="text-sm"
          />

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exercises</p>
            {exercises.map((ex, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                <Input
                  className="col-span-4 text-xs h-8"
                  placeholder="Exercise"
                  value={ex.name}
                  onChange={e => handleExerciseChange(idx, 'name', e.target.value)}
                />
                <Select value={ex.muscleGroup} onValueChange={v => handleExerciseChange(idx, 'muscleGroup', v)}>
                  <SelectTrigger className="col-span-3 text-[10px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MUSCLE_GROUPS.map(mg => (
                      <SelectItem key={mg} value={mg} className="text-xs">{mg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="col-span-2 text-xs h-8"
                  type="number"
                  placeholder="Sets"
                  value={ex.sets}
                  onChange={e => handleExerciseChange(idx, 'sets', parseInt(e.target.value) || 0)}
                />
                <Input
                  className="col-span-1 text-xs h-8"
                  type="number"
                  placeholder="R"
                  value={ex.reps}
                  onChange={e => handleExerciseChange(idx, 'reps', parseInt(e.target.value) || 0)}
                />
                <Input
                  className="col-span-2 text-xs h-8"
                  type="number"
                  placeholder="Wt"
                  value={ex.weight || ''}
                  onChange={e => handleExerciseChange(idx, 'weight', parseFloat(e.target.value) || 0)}
                />
              </div>
            ))}
            <button onClick={handleAddExercise} className="text-xs text-primary hover:underline">
              + Add Exercise
            </button>
          </div>

          <Input
            placeholder="Notes (optional)"
            value={formNotes}
            onChange={e => setFormNotes(e.target.value)}
            className="text-sm"
          />

          <Button onClick={handleSaveWorkout} className="w-full" disabled={!exercises.some(e => e.name.trim())}>
            Save Workout
          </Button>
        </div>
      )}

      {/* Session List */}
      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-8">Loading workouts…</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12">
          <Dumbbell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No workouts logged yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Log your first session or connect a workout app</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Sessions</p>
          {sessions.map(session => (
            <ClickableCard
              key={session.id}
              onClick={() => toggleExpand(session.id)}
              className="p-3"
              accentColor="hsl(var(--neon-green))"
              showArrow={false}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {session.program_name || session.workout_type?.replace('_', ' ') || 'Workout'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(session.session_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {session.source !== 'manual' && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[8px] font-bold">
                        via {session.source}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  {session.duration_minutes && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3" /> {session.duration_minutes}m
                    </span>
                  )}
                  {session.total_volume_lbs && (
                    <span className="flex items-center gap-0.5">
                      <Dumbbell className="w-3 h-3" /> {(session.total_volume_lbs / 1000).toFixed(1)}k
                    </span>
                  )}
                  {expandedSession === session.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </div>
              </div>

              {expandedSession === session.id && sessionSets[session.id] && (
                <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5">
                  {sessionSets[session.id].map(set => (
                    <div key={set.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{set.exercise_name}</span>
                      <span className="font-mono text-foreground">
                        {set.weight_lbs}lbs × {set.reps}
                        {set.is_personal_record && <Trophy className="w-3 h-3 inline ml-1 text-accent" />}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ClickableCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkoutTrackerView;
