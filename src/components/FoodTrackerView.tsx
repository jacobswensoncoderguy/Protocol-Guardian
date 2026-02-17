import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, Utensils, Apple, Coffee, Moon, Sun, Trash2, Star, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface Meal {
  id: string;
  meal_type: string;
  meal_date: string;
  meal_time: string | null;
  notes: string | null;
}

interface FoodEntry {
  id: string;
  meal_id: string;
  food_name: string;
  brand: string | null;
  serving_size: number | null;
  serving_unit: string;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  source: string;
}

interface NutritionTargets {
  calories_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  fiber_target_g: number;
  diet_type: string;
}

const MEAL_ICONS: Record<string, React.ElementType> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Apple,
};

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

const DEFAULT_TARGETS: NutritionTargets = {
  calories_target: 2000,
  protein_target_g: 150,
  carbs_target_g: 200,
  fat_target_g: 65,
  fiber_target_g: 30,
  diet_type: 'custom',
};

const FoodTrackerView = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [meals, setMeals] = useState<Meal[]>([]);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [targets, setTargets] = useState<NutritionTargets>(DEFAULT_TARGETS);
  const [loading, setLoading] = useState(true);
  const [showAddFood, setShowAddFood] = useState(false);
  const [activeMealType, setActiveMealType] = useState('breakfast');
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set(MEAL_ORDER));

  // Add food form state
  const [foodName, setFoodName] = useState('');
  const [servingSize, setServingSize] = useState('100');
  const [servingUnit, setServingUnit] = useState('g');
  const [servings, setServings] = useState('1');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [mealsRes, targetsRes] = await Promise.all([
      supabase.from('meals').select('*').eq('user_id', user.id).eq('meal_date', selectedDate),
      supabase.from('nutrition_targets').select('*').eq('user_id', user.id).single(),
    ]);

    const mealsList = (mealsRes.data || []) as unknown as Meal[];
    setMeals(mealsList);

    if (targetsRes.data) setTargets(targetsRes.data as unknown as NutritionTargets);

    if (mealsList.length > 0) {
      const mealIds = mealsList.map(m => m.id);
      const { data: foodData } = await supabase
        .from('food_entries')
        .select('*')
        .in('meal_id', mealIds);
      setEntries((foodData || []) as unknown as FoodEntry[]);
    } else {
      setEntries([]);
    }

    setLoading(false);
  }, [user, selectedDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dailyTotals = useMemo(() => {
    return entries.reduce(
      (acc, e) => ({
        calories: acc.calories + (e.calories || 0) * e.servings,
        protein: acc.protein + (e.protein_g || 0) * e.servings,
        carbs: acc.carbs + (e.carbs_g || 0) * e.servings,
        fat: acc.fat + (e.fat_g || 0) * e.servings,
        fiber: acc.fiber + (e.fiber_g || 0) * e.servings,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );
  }, [entries]);

  const mealTotals = useMemo(() => {
    const map: Record<string, { calories: number; protein: number; carbs: number; fat: number; count: number }> = {};
    meals.forEach(m => {
      const mealEntries = entries.filter(e => e.meal_id === m.id);
      map[m.meal_type] = mealEntries.reduce(
        (acc, e) => ({
          calories: acc.calories + (e.calories || 0) * e.servings,
          protein: acc.protein + (e.protein_g || 0) * e.servings,
          carbs: acc.carbs + (e.carbs_g || 0) * e.servings,
          fat: acc.fat + (e.fat_g || 0) * e.servings,
          count: acc.count + 1,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 }
      );
    });
    return map;
  }, [meals, entries]);

  const getOrCreateMeal = async (mealType: string): Promise<string | null> => {
    if (!user) return null;
    const existing = meals.find(m => m.meal_type === mealType);
    if (existing) return existing.id;

    const { data, error } = await supabase.from('meals').insert({
      user_id: user.id,
      meal_type: mealType,
      meal_date: selectedDate,
    }).select().single();

    if (error) { toast.error('Failed to create meal'); return null; }
    const meal = data as unknown as Meal;
    setMeals(prev => [...prev, meal]);
    return meal.id;
  };

  const handleAddFood = async () => {
    if (!foodName.trim() || !user) return;

    const mealId = await getOrCreateMeal(activeMealType);
    if (!mealId) return;

    const { data, error } = await supabase.from('food_entries').insert({
      user_id: user.id,
      meal_id: mealId,
      food_name: foodName.trim(),
      serving_size: parseFloat(servingSize) || 100,
      serving_unit: servingUnit,
      servings: parseFloat(servings) || 1,
      calories: parseFloat(calories) || 0,
      protein_g: parseFloat(protein) || 0,
      carbs_g: parseFloat(carbs) || 0,
      fat_g: parseFloat(fat) || 0,
      fiber_g: parseFloat(fiber) || 0,
      source: 'manual',
    }).select().single();

    if (error) { toast.error('Failed to add food'); return; }
    setEntries(prev => [...prev, data as unknown as FoodEntry]);
    toast.success(`Added ${foodName}`);
    resetForm();
    setShowAddFood(false);
  };

  const handleDeleteEntry = async (id: string) => {
    await supabase.from('food_entries').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const resetForm = () => {
    setFoodName(''); setServingSize('100'); setServingUnit('g'); setServings('1');
    setCalories(''); setProtein(''); setCarbs(''); setFat(''); setFiber('');
  };

  const toggleMeal = (type: string) => {
    setExpandedMeals(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const MacroRing = ({ label, current, target, color }: { label: string; current: number; target: number; color: string }) => {
    const pct = Math.min((current / target) * 100, 100);
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
            <circle cx="28" cy="28" r="24" fill="none" stroke={color} strokeWidth="4"
              strokeDasharray={`${pct * 1.508} 150.8`} strokeLinecap="round" className="transition-all duration-500" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-foreground">{Math.round(current)}</span>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
        <span className="text-[9px] text-muted-foreground">/ {target}g</span>
      </div>
    );
  };

  const dateLabel = selectedDate === format(new Date(), 'yyyy-MM-dd') ? 'Today' :
    format(parseISO(selectedDate), 'EEE, MMM d');

  return (
    <div className="space-y-4">
      {/* Date selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">{dateLabel}</h2>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-auto h-8 text-xs"
        />
      </div>

      {/* Daily summary card */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-2xl font-bold text-foreground">{Math.round(dailyTotals.calories)}</div>
              <div className="text-xs text-muted-foreground">of {targets.calories_target} cal</div>
            </div>
            <div className="flex gap-3">
              <MacroRing label="Protein" current={dailyTotals.protein} target={targets.protein_target_g} color="hsl(var(--primary))" />
              <MacroRing label="Carbs" current={dailyTotals.carbs} target={targets.carbs_target_g} color="hsl(var(--accent))" />
              <MacroRing label="Fat" current={dailyTotals.fat} target={targets.fat_target_g} color="hsl(var(--status-warning))" />
            </div>
          </div>
          <Progress value={(dailyTotals.calories / targets.calories_target) * 100} className="h-2" />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">{Math.round(targets.calories_target - dailyTotals.calories)} cal remaining</span>
            <span className="text-[10px] text-muted-foreground">Fiber: {Math.round(dailyTotals.fiber)}g / {targets.fiber_target_g}g</span>
          </div>
        </CardContent>
      </Card>

      {/* Meal sections */}
      {MEAL_ORDER.map(mealType => {
        const Icon = MEAL_ICONS[mealType];
        const totals = mealTotals[mealType];
        const mealEntries = entries.filter(e => {
          const meal = meals.find(m => m.id === e.meal_id);
          return meal?.meal_type === mealType;
        });
        const isExpanded = expandedMeals.has(mealType);

        return (
          <Card key={mealType} className="border-border/50">
            <CardHeader className="p-3 pb-0">
              <div className="flex items-center justify-between">
                <button onClick={() => toggleMeal(mealType)} className="flex items-center gap-2 flex-1">
                  <Icon className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm capitalize">{mealType}</CardTitle>
                  {totals && <Badge variant="secondary" className="text-[10px] h-5">{Math.round(totals.calories)} cal</Badge>}
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto" />}
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-primary"
                  onClick={() => { setActiveMealType(mealType); setShowAddFood(true); }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="p-3 pt-2">
                {mealEntries.length === 0 ? (
                  <button
                    onClick={() => { setActiveMealType(mealType); setShowAddFood(true); }}
                    className="w-full py-4 border border-dashed border-border/60 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add food
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    {mealEntries.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-secondary/50 group">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-foreground truncate">{entry.food_name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {entry.servings > 1 ? `${entry.servings} × ` : ''}{entry.serving_size}{entry.serving_unit}
                            {' · '}P {Math.round(entry.protein_g * entry.servings)}g · C {Math.round(entry.carbs_g * entry.servings)}g · F {Math.round(entry.fat_g * entry.servings)}g
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{Math.round(entry.calories * entry.servings)}</span>
                          <button onClick={() => handleDeleteEntry(entry.id)} className="opacity-0 group-hover:opacity-100 sm:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Add food dialog */}
      <Dialog open={showAddFood} onOpenChange={setShowAddFood}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Utensils className="w-4 h-4 text-primary" />
              Add to {activeMealType}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Food name (e.g., Chicken breast)"
              value={foodName}
              onChange={e => setFoodName(e.target.value)}
              autoFocus
            />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Serving" value={servingSize} onChange={e => setServingSize(e.target.value)} type="number" className="text-sm" />
              <Select value={servingUnit} onValueChange={setServingUnit}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="oz">oz</SelectItem>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="cup">cup</SelectItem>
                  <SelectItem value="tbsp">tbsp</SelectItem>
                  <SelectItem value="piece">piece</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Qty" value={servings} onChange={e => setServings(e.target.value)} type="number" className="text-sm" />
            </div>

            <div className="border-t border-border/50 pt-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Nutrition per serving</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Input placeholder="Calories" value={calories} onChange={e => setCalories(e.target.value)} type="number" className="text-sm pr-8" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">cal</span>
                </div>
                <div className="relative">
                  <Input placeholder="Protein" value={protein} onChange={e => setProtein(e.target.value)} type="number" className="text-sm pr-6" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">g</span>
                </div>
                <div className="relative">
                  <Input placeholder="Carbs" value={carbs} onChange={e => setCarbs(e.target.value)} type="number" className="text-sm pr-6" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">g</span>
                </div>
                <div className="relative">
                  <Input placeholder="Fat" value={fat} onChange={e => setFat(e.target.value)} type="number" className="text-sm pr-6" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">g</span>
                </div>
                <div className="relative">
                  <Input placeholder="Fiber" value={fiber} onChange={e => setFiber(e.target.value)} type="number" className="text-sm pr-6" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">g</span>
                </div>
              </div>
            </div>

            <Button onClick={handleAddFood} disabled={!foodName.trim()} className="w-full">
              Add Food
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FoodTrackerView;
