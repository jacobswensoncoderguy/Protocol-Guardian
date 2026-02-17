import { useState, useEffect, useMemo } from 'react';
import { format, subDays, parseISO, eachDayOfInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Flame, Beef, Wheat, Droplets } from 'lucide-react';

interface DayNutrition {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface NutritionTargets {
  calories_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  fiber_target_g: number;
}

const DEFAULT_TARGETS: NutritionTargets = {
  calories_target: 2000,
  protein_target_g: 150,
  carbs_target_g: 200,
  fat_target_g: 65,
  fiber_target_g: 30,
};

const TrendIcon = ({ value, target }: { value: number; target: number }) => {
  const pct = value / target;
  if (pct >= 0.95) return <TrendingUp className="w-3.5 h-3.5 text-status-good" />;
  if (pct >= 0.7) return <Minus className="w-3.5 h-3.5 text-status-warning" />;
  return <TrendingDown className="w-3.5 h-3.5 text-status-critical" />;
};

const WeeklyNutritionView = () => {
  const { user } = useAuth();
  const [weekData, setWeekData] = useState<DayNutrition[]>([]);
  const [targets, setTargets] = useState<NutritionTargets>(DEFAULT_TARGETS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchWeekData = async () => {
      setLoading(true);
      const today = new Date();
      const sevenDaysAgo = subDays(today, 6);
      const dateRange = eachDayOfInterval({ start: sevenDaysAgo, end: today });

      const [mealsRes, targetsRes] = await Promise.all([
        supabase.from('meals').select('id, meal_date').eq('user_id', user.id)
          .gte('meal_date', format(sevenDaysAgo, 'yyyy-MM-dd'))
          .lte('meal_date', format(today, 'yyyy-MM-dd')),
        supabase.from('nutrition_targets').select('*').eq('user_id', user.id).single(),
      ]);

      if (targetsRes.data) setTargets(targetsRes.data as unknown as NutritionTargets);

      const meals = mealsRes.data || [];
      if (meals.length === 0) {
        setWeekData(dateRange.map(d => ({ date: format(d, 'yyyy-MM-dd'), calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })));
        setLoading(false);
        return;
      }

      const mealIds = meals.map((m: any) => m.id);
      const { data: entries } = await supabase.from('food_entries').select('*').in('meal_id', mealIds);

      const dayMap: Record<string, DayNutrition> = {};
      dateRange.forEach(d => {
        dayMap[format(d, 'yyyy-MM-dd')] = { date: format(d, 'yyyy-MM-dd'), calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
      });

      (entries || []).forEach((entry: any) => {
        const meal = meals.find((m: any) => m.id === entry.meal_id);
        if (!meal) return;
        const day = dayMap[meal.meal_date];
        if (!day) return;
        day.calories += (entry.calories || 0) * entry.servings;
        day.protein += (entry.protein_g || 0) * entry.servings;
        day.carbs += (entry.carbs_g || 0) * entry.servings;
        day.fat += (entry.fat_g || 0) * entry.servings;
        day.fiber += (entry.fiber_g || 0) * entry.servings;
      });

      setWeekData(Object.values(dayMap));
      setLoading(false);
    };

    fetchWeekData();
  }, [user]);

  const averages = useMemo(() => {
    const loggedDays = weekData.filter(d => d.calories > 0);
    if (loggedDays.length === 0) return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, daysLogged: 0 };
    return {
      calories: Math.round(loggedDays.reduce((s, d) => s + d.calories, 0) / loggedDays.length),
      protein: Math.round(loggedDays.reduce((s, d) => s + d.protein, 0) / loggedDays.length),
      carbs: Math.round(loggedDays.reduce((s, d) => s + d.carbs, 0) / loggedDays.length),
      fat: Math.round(loggedDays.reduce((s, d) => s + d.fat, 0) / loggedDays.length),
      fiber: Math.round(loggedDays.reduce((s, d) => s + d.fiber, 0) / loggedDays.length),
      daysLogged: loggedDays.length,
    };
  }, [weekData]);

  const chartData = weekData.map(d => ({
    day: format(parseISO(d.date), 'EEE'),
    calories: Math.round(d.calories),
    protein: Math.round(d.protein),
    carbs: Math.round(d.carbs),
    fat: Math.round(d.fat),
    isToday: d.date === format(new Date(), 'yyyy-MM-dd'),
  }));

  if (loading) {
    return <div className="h-48 flex items-center justify-center"><span className="text-sm text-muted-foreground">Loading weekly data…</span></div>;
  }

  const MacroStatCard = ({ label, icon: Icon, avg, target, unit = 'g', color }: {
    label: string; icon: React.ElementType; avg: number; target: number; unit?: string; color: string;
  }) => {
    const pct = Math.min((avg / target) * 100, 120);
    return (
      <Card className="border-border/50">
        <CardContent className="p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon className="w-3.5 h-3.5" style={{ color }} />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-foreground">{avg}</span>
            <span className="text-[10px] text-muted-foreground">{unit}</span>
          </div>
          <div className="text-[9px] text-muted-foreground mb-1.5">avg · target {target}{unit}</div>
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] text-muted-foreground">{Math.round(pct)}% of goal</span>
            <TrendIcon value={avg} target={target} />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">7-Day Summary</h3>
          <p className="text-[10px] text-muted-foreground">{averages.daysLogged}/7 days logged</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-foreground">{averages.calories}</div>
          <div className="text-[10px] text-muted-foreground">avg cal/day</div>
        </div>
      </div>

      {/* Calorie bar chart */}
      <Card className="border-border/50">
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-status-warning" />
            Daily Calories vs Target
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                formatter={(val: number) => [`${Math.round(val)} cal`, 'Calories']}
              />
              <ReferenceLine y={targets.calories_target} stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeWidth={1.5} label={{ value: 'Goal', position: 'right', fontSize: 9, fill: 'hsl(var(--primary))' }} />
              <Bar dataKey="calories" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.isToday ? 'hsl(var(--primary))' : entry.calories >= targets.calories_target * 0.9 ? 'hsl(var(--status-good))' : entry.calories > 0 ? 'hsl(var(--status-warning))' : 'hsl(var(--border))'} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Macro grid */}
      <div className="grid grid-cols-2 gap-2">
        <MacroStatCard label="Protein" icon={Beef} avg={averages.protein} target={targets.protein_target_g} color="hsl(var(--primary))" />
        <MacroStatCard label="Carbs" icon={Wheat} avg={averages.carbs} target={targets.carbs_target_g} color="hsl(var(--accent))" />
        <MacroStatCard label="Fat" icon={Droplets} avg={averages.fat} target={targets.fat_target_g} color="hsl(var(--status-warning))" />
        <MacroStatCard label="Fiber" icon={Flame} avg={averages.fiber} target={targets.fiber_target_g} color="hsl(var(--status-good))" />
      </div>

      {/* Macro stacked bar trend */}
      <Card className="border-border/50">
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-xs text-muted-foreground font-medium">Macro Breakdown by Day</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
              />
              <Bar dataKey="protein" stackId="a" fill="hsl(var(--primary))" fillOpacity={0.9} radius={[0,0,0,0]} />
              <Bar dataKey="carbs" stackId="a" fill="hsl(var(--accent))" fillOpacity={0.7} />
              <Bar dataKey="fat" stackId="a" fill="hsl(var(--status-warning))" fillOpacity={0.7} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-3 mt-1">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary" /><span className="text-[9px] text-muted-foreground">Protein</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-accent" /><span className="text-[9px] text-muted-foreground">Carbs</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--status-warning))' }} /><span className="text-[9px] text-muted-foreground">Fat</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WeeklyNutritionView;
