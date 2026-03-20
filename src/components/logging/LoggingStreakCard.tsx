import React, { useState, useEffect } from 'react';
import { Flame, Utensils, Activity, Dumbbell, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ClickableCard from '@/components/ClickableCard';

interface LoggingStreakCardProps {
  userId?: string;
}

const LoggingStreakCard: React.FC<LoggingStreakCardProps> = ({ userId }) => {
  const [streak, setStreak] = useState(0);
  const [weekStats, setWeekStats] = useState({ checkins: 0, meals: 0, workouts: 0, symptoms: 0 });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      // Compute streak from daily_checkins
      const { data: checkins } = await supabase
        .from('daily_checkins')
        .select('checkin_date')
        .eq('user_id', userId)
        .order('checkin_date', { ascending: false })
        .limit(60);

      if (cancelled) return;

      let currentStreak = 0;
      if (checkins && checkins.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let checkDate = new Date(today);

        // If today isn't checked yet, start from yesterday
        const latestDate = new Date(checkins[0].checkin_date);
        latestDate.setHours(0, 0, 0, 0);
        if (latestDate.getTime() < today.getTime()) {
          checkDate.setDate(checkDate.getDate() - 1);
        }

        const dateSet = new Set(checkins.map(c => c.checkin_date));
        while (dateSet.has(checkDate.toISOString().split('T')[0])) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
      setStreak(currentStreak);

      // Week stats
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekStr = weekAgo.toISOString().split('T')[0];

      const [checkinRes, mealRes, workoutRes, symptomRes] = await Promise.all([
        supabase.from('daily_checkins').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('checkin_date', weekStr),
        supabase.from('meals').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('meal_date', weekStr),
        supabase.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('session_date', weekStr),
        supabase.from('symptom_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('log_date', weekStr),
      ]);

      if (cancelled) return;
      setWeekStats({
        checkins: checkinRes.count ?? 0,
        meals: mealRes.count ?? 0,
        workouts: workoutRes.count ?? 0,
        symptoms: symptomRes.count ?? 0,
      });
    };

    load();
    return () => { cancelled = true; };
  }, [userId]);

  const stats = [
    { icon: Activity, label: 'Check-ins', value: weekStats.checkins, color: 'text-primary' },
    { icon: Utensils, label: 'Meals', value: weekStats.meals, color: 'text-[hsl(var(--neon-amber))]' },
    { icon: Dumbbell, label: 'Workouts', value: weekStats.workouts, color: 'text-[hsl(var(--neon-green))]' },
    { icon: FlaskConical, label: 'Symptoms', value: weekStats.symptoms, color: 'text-[hsl(var(--neon-violet))]' },
  ];

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className={`w-4 h-4 ${streak >= 7 ? 'text-[hsl(var(--neon-amber))]' : streak >= 3 ? 'text-primary' : 'text-muted-foreground'}`} />
          <div>
            <p className="text-xs font-bold text-foreground">Logging Streak</p>
            <p className="text-[9px] text-muted-foreground">Based on daily check-ins</p>
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-black font-mono ${streak >= 7 ? 'text-[hsl(var(--neon-amber))]' : streak >= 3 ? 'text-primary' : 'text-foreground'}`}>
            {streak}
          </span>
          <span className="text-[9px] text-muted-foreground">days</span>
        </div>
      </div>

      {/* Streak bar visual */}
      <div className="flex gap-1 mb-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-all ${
              i < Math.min(streak, 7)
                ? streak >= 7
                  ? 'bg-[hsl(var(--neon-amber))]'
                  : 'bg-primary'
                : 'bg-secondary/50'
            }`}
            style={i < Math.min(streak, 7) ? {
              boxShadow: streak >= 7 ? '0 0 4px hsl(var(--neon-amber) / 0.5)' : '0 0 4px hsl(var(--primary) / 0.3)',
            } : undefined}
          />
        ))}
      </div>

      {/* Week stats */}
      <p className="text-[8px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">This Week</p>
      <div className="grid grid-cols-4 gap-1.5">
        {stats.map(s => (
          <div key={s.label} className="flex flex-col items-center p-1.5 rounded-lg bg-secondary/30 border border-border/20">
            <s.icon className={`w-3 h-3 ${s.color} mb-0.5`} />
            <span className="text-xs font-bold font-mono text-foreground">{s.value}</span>
            <span className="text-[6px] text-muted-foreground uppercase">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoggingStreakCard;
