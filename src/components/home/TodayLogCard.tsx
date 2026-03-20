import React, { useState } from 'react';
import { Check, Utensils, Dumbbell, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TodayLogCardProps {
  userId?: string;
  hasCheckedIn?: boolean;
  caloriesLogged?: number;
  caloriesTarget?: number;
  workoutStatus?: 'synced' | 'none' | 'detected';
  workoutLabel?: string;
  labStatus?: string;
  onCheckinComplete?: () => void;
  onNavigate?: (subTab: string) => void;
}

const TodayLogCard: React.FC<TodayLogCardProps> = ({
  userId, hasCheckedIn = false, caloriesLogged = 0, caloriesTarget = 2800,
  workoutStatus = 'none', workoutLabel, labStatus = 'Up to date',
  onCheckinComplete, onNavigate,
}) => {
  const [energy, setEnergy] = useState(3);
  const [mood, setMood] = useState(3);
  const [sleep, setSleep] = useState(3);
  const [pain, setPain] = useState(2);
  const [saving, setSaving] = useState(false);

  const pendingCount = [
    !hasCheckedIn,
    caloriesLogged === 0,
    workoutStatus === 'none',
  ].filter(Boolean).length;

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const handleSaveCheckin = async () => {
    if (!userId) return;
    setSaving(true);
    const todayStr = today.toISOString().split('T')[0];
    const { error } = await supabase.from('daily_checkins').upsert({
      user_id: userId,
      checkin_date: todayStr,
      energy_score: energy,
      mood_score: mood,
      sleep_score: sleep,
      pain_score: pain,
    }, { onConflict: 'user_id,checkin_date' });

    setSaving(false);
    if (error) {
      toast.error('Failed to save check-in');
    } else {
      toast.success('Check-in saved!');
      onCheckinComplete?.();
    }
  };

  const emojiScale = (value: number, type: 'positive' | 'pain') => {
    const positive = ['😫', '😐', '🙂', '😊', '🤩'];
    const painArr = ['😌', '🙂', '😐', '😣', '😫'];
    const arr = type === 'pain' ? painArr : positive;
    return arr[Math.min(value - 1, 4)];
  };

  return (
    <div className="rounded-[14px] border border-border/50 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground">Today · {dateLabel}</p>
        </div>
        {pendingCount > 0 && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[hsl(var(--neon-amber))]/15 text-[hsl(var(--neon-amber))]">
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Status rows */}
      <div className="space-y-2">
        {/* Check-in */}
        <div className="flex items-center gap-2">
          <span className="text-sm">😐</span>
          <span className="text-[10px] text-muted-foreground w-16">Check-in</span>
          {hasCheckedIn ? (
            <span className="text-[9px] font-bold text-[hsl(var(--neon-green))] flex items-center gap-1">
              <Check className="w-3 h-3" /> DONE
            </span>
          ) : (
            <span className="text-[9px] font-bold text-[hsl(var(--neon-amber))]">PENDING</span>
          )}
        </div>

        {/* Inline check-in sliders */}
        {!hasCheckedIn && (
          <div className="bg-secondary/30 rounded-xl p-3 space-y-2.5">
            {[
              { label: 'Energy', val: energy, set: setEnergy, type: 'positive' as const },
              { label: 'Mood', val: mood, set: setMood, type: 'positive' as const },
              { label: 'Sleep', val: sleep, set: setSleep, type: 'positive' as const },
              { label: 'Pain', val: pain, set: setPain, type: 'pain' as const },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-10">{m.label}</span>
                <span className="text-sm">{emojiScale(m.val, m.type)}</span>
                <Slider
                  min={1} max={5} step={1}
                  value={[m.val]}
                  onValueChange={([v]) => m.set(v)}
                  className="flex-1"
                />
                <span className="text-[10px] font-mono text-foreground w-3 text-right">{m.val}</span>
              </div>
            ))}
            <Button size="sm" onClick={handleSaveCheckin} disabled={saving} className="w-full h-8 text-xs">
              {saving ? 'Saving…' : 'Save Check-in'}
            </Button>
          </div>
        )}

        {/* Nutrition */}
        <button onClick={() => onNavigate?.('food')} className="w-full flex items-center gap-2 hover:bg-secondary/20 rounded-lg p-1 -mx-1 transition-colors">
          <span className="text-sm">🍽</span>
          <span className="text-[10px] text-muted-foreground w-16">Nutrition</span>
          <div className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (caloriesLogged / caloriesTarget) * 100)}%` }} />
          </div>
          <span className="text-[9px] font-mono text-muted-foreground">{caloriesLogged} / {caloriesTarget}</span>
        </button>

        {/* Workout */}
        <button onClick={() => onNavigate?.('workout')} className="w-full flex items-center gap-2 hover:bg-secondary/20 rounded-lg p-1 -mx-1 transition-colors">
          <span className="text-sm">💪</span>
          <span className="text-[10px] text-muted-foreground w-16">Workout</span>
          <span className={`text-[9px] font-bold ${
            workoutStatus === 'synced' ? 'text-[hsl(var(--neon-green))]' : workoutStatus === 'detected' ? 'text-primary' : 'text-muted-foreground/50'
          }`}>
            {workoutStatus === 'synced' ? (workoutLabel || 'Synced') : workoutStatus === 'detected' ? 'Confirm?' : 'No workout logged'}
          </span>
        </button>

        {/* Labs */}
        <button onClick={() => onNavigate?.('labs')} className="w-full flex items-center gap-2 hover:bg-secondary/20 rounded-lg p-1 -mx-1 transition-colors">
          <span className="text-sm">🔬</span>
          <span className="text-[10px] text-muted-foreground w-16">Labs</span>
          <span className="text-[9px] text-muted-foreground">{labStatus}</span>
        </button>
      </div>
    </div>
  );
};

export default TodayLogCard;
