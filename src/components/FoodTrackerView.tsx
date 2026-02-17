import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Plus, Utensils, Apple, Coffee, Moon, Sun, Trash2, ChevronDown, ChevronUp, Camera, Loader2, Settings, Sparkles, Barcode, X, Search, Clock, Star, ScanLine, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import WeeklyNutritionView from './WeeklyNutritionView';

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

// Diet framework presets
const DIET_PRESETS: Record<string, { label: string; description: string; targets: Partial<NutritionTargets> }> = {
  custom: { label: 'Custom', description: 'Your own targets', targets: {} },
  performance: { label: 'Performance', description: 'High protein, balanced macros for athletes', targets: { calories_target: 2800, protein_target_g: 220, carbs_target_g: 300, fat_target_g: 80, fiber_target_g: 35 } },
  keto: { label: 'Keto', description: 'High fat, very low carb (<50g/day)', targets: { calories_target: 2000, protein_target_g: 140, carbs_target_g: 30, fat_target_g: 155, fiber_target_g: 25 } },
  carnivore: { label: 'Carnivore', description: 'Animal-based, zero carb protocol', targets: { calories_target: 2200, protein_target_g: 200, carbs_target_g: 5, fat_target_g: 160, fiber_target_g: 0 } },
  mediterranean: { label: 'Mediterranean', description: 'Balanced, heart-healthy with olive oil & fish', targets: { calories_target: 2000, protein_target_g: 120, carbs_target_g: 250, fat_target_g: 70, fiber_target_g: 40 } },
  vegan: { label: 'Vegan', description: 'Plant-based, high fiber protocol', targets: { calories_target: 1900, protein_target_g: 100, carbs_target_g: 280, fat_target_g: 55, fiber_target_g: 45 } },
  paleo: { label: 'Paleo', description: 'Whole foods, no grains or dairy', targets: { calories_target: 2100, protein_target_g: 160, carbs_target_g: 150, fat_target_g: 100, fiber_target_g: 35 } },
  highprotein: { label: 'High Protein', description: 'Optimized for muscle retention & recomp', targets: { calories_target: 2400, protein_target_g: 240, carbs_target_g: 200, fat_target_g: 70, fiber_target_g: 30 } },
};

const FoodTrackerView = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [meals, setMeals] = useState<Meal[]>([]);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [targets, setTargets] = useState<NutritionTargets>(DEFAULT_TARGETS);
  const [loading, setLoading] = useState(true);
  const [showAddFood, setShowAddFood] = useState(false);
  const [showTargets, setShowTargets] = useState(false);
  const [activeMealType, setActiveMealType] = useState('breakfast');
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set(MEAL_ORDER));
  const [foodTab, setFoodTab] = useState('today');

  // AI scanning state
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live barcode scanner state
  const [showLiveScanner, setShowLiveScanner] = useState(false);
  const [liveScannerLoading, setLiveScannerLoading] = useState(false);
  const [liveScannerError, setLiveScannerError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const scanCancelledRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<MediaStream | null>(null);
  const scanAnimRef = useRef<number | null>(null);

  // Barcode lookup state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [productImage, setProductImage] = useState<string | null>(null);

  // Name search state (Open Food Facts)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Saved / recent foods
  const [savedFoods, setSavedFoods] = useState<any[]>([]);
  const [savedFoodsLoading, setSavedFoodsLoading] = useState(false);

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

  // Targets form state
  const [targetCalories, setTargetCalories] = useState('');
  const [targetProtein, setTargetProtein] = useState('');
  const [targetCarbs, setTargetCarbs] = useState('');
  const [targetFat, setTargetFat] = useState('');
  const [targetFiber, setTargetFiber] = useState('');
  const [selectedDiet, setSelectedDiet] = useState('custom');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [mealsRes, targetsRes] = await Promise.all([
      supabase.from('meals').select('*').eq('user_id', user.id).eq('meal_date', selectedDate),
      supabase.from('nutrition_targets').select('*').eq('user_id', user.id).single(),
    ]);

    const mealsList = (mealsRes.data || []) as unknown as Meal[];
    setMeals(mealsList);

    if (targetsRes.data) {
      const t = targetsRes.data as unknown as NutritionTargets;
      setTargets(t);
      setTargetCalories(String(t.calories_target));
      setTargetProtein(String(t.protein_target_g));
      setTargetCarbs(String(t.carbs_target_g));
      setTargetFat(String(t.fat_target_g));
      setTargetFiber(String(t.fiber_target_g));
      setSelectedDiet(t.diet_type || 'custom');
    }

    if (mealsList.length > 0) {
      const mealIds = mealsList.map(m => m.id);
      const { data: foodData } = await supabase.from('food_entries').select('*').in('meal_id', mealIds);
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
      source: scanResult ? (scanResult.notes?.includes('Open Food Facts') ? 'barcode' : 'ai_scan') : 'manual',
    }).select().single();

    if (error) { toast.error('Failed to add food'); return; }
    setEntries(prev => [...prev, data as unknown as FoodEntry]);
    toast.success(`Added ${foodName}`);
    // Upsert into saved_foods for the recent foods panel
    await upsertSavedFood({
      food_name: foodName.trim(),
      serving_size: parseFloat(servingSize) || 100,
      serving_unit: servingUnit,
      calories: parseFloat(calories) || 0,
      protein_g: parseFloat(protein) || 0,
      carbs_g: parseFloat(carbs) || 0,
      fat_g: parseFloat(fat) || 0,
      fiber_g: parseFloat(fiber) || 0,
    });
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
    setScanResult(null); setBarcodeInput(''); setShowBarcodeInput(false);
    setProductImage(null);
    setSearchQuery(''); setSearchResults([]); setShowSearchResults(false);
  };

  // Stop live scanner — cancels RAF loop and releases camera stream
  const stopLiveScanner = useCallback(() => {
    scanCancelledRef.current = true; // kill the tick loop immediately
    if (scanAnimRef.current !== null) {
      cancelAnimationFrame(scanAnimRef.current);
      scanAnimRef.current = null;
    }
    if (scannerControlsRef.current) {
      try { scannerControlsRef.current.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
      scannerControlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setShowLiveScanner(false);
    setLiveScannerLoading(false);
    setLiveScannerError(null);
  }, []);

  // Lookup barcode from Open Food Facts (with UPC fallback) and fill form
  const lookupAndFillBarcode = useCallback(async (barcode: string) => {
    stopLiveScanner();
    setBarcodeLoading(true);
    setProductImage(null);
    try {
      // 1️⃣ Try Open Food Facts first
      const offRes = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,brands,nutriments,serving_quantity,serving_quantity_unit,image_front_small_url`
      );
      const offJson = await offRes.json();

      if (offJson.status === 1 && offJson.product) {
        const p = offJson.product;
        const n = p.nutriments || {};
        const servQty = p.serving_quantity ? parseFloat(p.serving_quantity) : 100;
        const factor = servQty / 100;
        setFoodName(p.product_name || '');
        setServingSize(String(servQty));
        setServingUnit(p.serving_quantity_unit || 'g');
        setCalories(String(Math.round((n['energy-kcal_100g'] ?? 0) * factor)));
        setProtein(String(Math.round((n.proteins_100g ?? 0) * factor)));
        setCarbs(String(Math.round((n.carbohydrates_100g ?? 0) * factor)));
        setFat(String(Math.round((n.fat_100g ?? 0) * factor)));
        setFiber(String(Math.round((n.fiber_100g ?? 0) * factor)));
        const brand = p.brands ? ` (${p.brands.split(',')[0].trim()})` : '';
        if (p.image_front_small_url) setProductImage(p.image_front_small_url);
        setScanResult({ confidence: 'high', notes: `Open Food Facts${p.brands ? ' · ' + p.brands.split(',')[0].trim() : ''}` });
        toast.success(`Found: ${p.product_name}${brand}`, { description: '✓ Nutrition pre-filled from barcode.' });
        setBarcodeLoading(false);
        return;
      }

      // 2️⃣ Fallback: UPC Item DB (covers US products like Mountain Dew)
      const upcRes = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
      const upcJson = await upcRes.json();
      const item = upcJson?.items?.[0];

      if (item) {
        const name = item.title || item.brand || 'Unknown Product';
        setFoodName(name);
        if (item.brand) setServingUnit('serving');
        // UPC Item DB has nutrition in some entries
        if (item.ean && item.nutritional_info) {
          const ni = item.nutritional_info;
          setCalories(String(ni.calories ?? ''));
          setProtein(String(ni.protein ?? ''));
          setCarbs(String(ni.total_carbohydrate ?? ''));
          setFat(String(ni.total_fat ?? ''));
        }
        // UPC Item DB may return product images
        const img = item.images?.[0];
        if (img) setProductImage(img);
        setScanResult({ confidence: 'medium', notes: `UPC ItemDB · ${item.brand || ''}` });
        toast.success(`Found: ${name}`, { description: 'Product identified — fill in nutrition if needed.' });
        setBarcodeLoading(false);
        return;
      }

      // 3️⃣ Nothing found
      toast.error('Product not found', { description: `Barcode ${barcode} not in database. Enter nutrition manually.` });
    } catch {
      toast.error('Barcode lookup failed', { description: 'Check your connection and try again.' });
    }
    setBarcodeLoading(false);
  }, [stopLiveScanner]);

  // Toggle torch/flashlight on the active camera track
  const toggleTorch = useCallback(async () => {
    if (!scannerControlsRef.current) return;
    const track = scannerControlsRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
      setTorchOn(t => !t);
    } catch {
      toast.error('Torch not supported on this device');
    }
  }, [torchOn]);

  // Start live barcode scanner — flips flag; useEffect handles init once video mounts
  const startLiveScanner = useCallback(() => {
    setShowLiveScanner(true);
    setLiveScannerLoading(true);
    setLiveScannerError(null);
  }, []);

  // Initialize scanner: getUserMedia → canvas frame loop → ZXing decode
  useEffect(() => {
    if (!showLiveScanner) return;
    // Reset the shared cancel ref so the new session can run
    scanCancelledRef.current = false;

    const initScanner = async () => {
      // Poll until videoRef is mounted (conditional render)
      let video = videoRef.current;
      let attempts = 0;
      while (!video && attempts < 20) {
        await new Promise(r => setTimeout(r, 50));
        video = videoRef.current;
        attempts++;
      }
      if (scanCancelledRef.current || !video) {
        setLiveScannerError('Camera element not found.');
        setLiveScannerLoading(false);
        return;
      }

      try {
        // mediaDevices is unavailable in sandboxed iframes (e.g. editor preview)
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setLiveScannerError('Camera not available in this environment. Please open the app in a browser tab directly.');
          setLiveScannerLoading(false);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (scanCancelledRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        scannerControlsRef.current = stream;
        video.srcObject = stream;
        await video.play();
        if (scanCancelledRef.current) return;
        setLiveScannerLoading(false);

        const codeReader = new BrowserMultiFormatReader();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Require the same barcode 3 consecutive times to prevent false fires
        let lastBarcode = '';
        let confirmCount = 0;
        const CONFIRM_NEEDED = 3;

        const tick = () => {
          // Use the shared ref so stopLiveScanner can kill this loop synchronously
          if (scanCancelledRef.current || !ctx || !videoRef.current) return;
          const v = videoRef.current;
          if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth > 0) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            try {
              const result = codeReader.decodeFromCanvas(canvas);
              if (result) {
                const text = result.getText();
                if (text === lastBarcode) {
                  confirmCount++;
                } else {
                  lastBarcode = text;
                  confirmCount = 1;
                }
                if (confirmCount >= CONFIRM_NEEDED && !scanCancelledRef.current) {
                  lookupAndFillBarcode(text);
                  return; // stop loop
                }
              } else {
                // No result — reset confirmation streak
                lastBarcode = '';
                confirmCount = 0;
              }
            } catch {
              // NotFoundException on every empty frame — expected, reset streak
              lastBarcode = '';
              confirmCount = 0;
            }
          }
          scanAnimRef.current = requestAnimationFrame(tick);
        };
        scanAnimRef.current = requestAnimationFrame(tick);
      } catch (e: any) {
        if (scanCancelledRef.current) return;
        const msg = e?.name === 'NotAllowedError' || e?.message?.includes('Permission') || e?.name === 'NotFoundError'
          ? 'Camera permission denied. Please allow camera access and try again.'
          : `Could not access camera: ${e?.message || 'unknown error'}`;
        setLiveScannerError(msg);
        setLiveScannerLoading(false);
      }
    };

    initScanner();

    return () => { scanCancelledRef.current = true; };
  }, [showLiveScanner, lookupAndFillBarcode]);

  // Fetch saved/recent foods from the database
  const fetchSavedFoods = useCallback(async () => {
    if (!user) return;
    setSavedFoodsLoading(true);
    const { data } = await supabase
      .from('saved_foods')
      .select('*')
      .eq('user_id', user.id)
      .order('use_count', { ascending: false })
      .limit(10);
    setSavedFoods(data || []);
    setSavedFoodsLoading(false);
  }, [user]);

  // Open Food Facts name search
  const handleNameSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    setFoodName(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,brands,nutriments,serving_quantity,serving_quantity_unit,image_small_url`
        );
        const json = await res.json();
        const products = (json.products || []).filter((p: any) => p.product_name && p.nutriments);
        setSearchResults(products);
        setShowSearchResults(products.length > 0);
      } catch {
        setSearchResults([]);
        setShowSearchResults(false);
      }
      setSearchLoading(false);
    }, 400);
  }, []);

  const applyOFFProduct = (p: any) => {
    const n = p.nutriments || {};
    const servQty = p.serving_quantity ? parseFloat(p.serving_quantity) : 100;
    const factor = servQty / 100;
    setFoodName(p.product_name || '');
    setServingSize(String(servQty));
    setServingUnit(p.serving_quantity_unit || 'g');
    setCalories(String(Math.round((n['energy-kcal_100g'] ?? 0) * factor)));
    setProtein(String(Math.round((n.proteins_100g ?? 0) * factor)));
    setCarbs(String(Math.round((n.carbohydrates_100g ?? 0) * factor)));
    setFat(String(Math.round((n.fat_100g ?? 0) * factor)));
    setFiber(String(Math.round((n.fiber_100g ?? 0) * factor)));
    const brand = p.brands ? ` (${p.brands.split(',')[0].trim()})` : '';
    setScanResult({ confidence: 'high', notes: `Open Food Facts${p.brands ? ' · ' + p.brands.split(',')[0].trim() : ''}` });
    toast.success(`Selected: ${p.product_name}${brand}`, { description: 'Nutrition pre-filled — verify before saving.' });
    setShowSearchResults(false);
    setSearchQuery(p.product_name || '');
  };

  const applySavedFood = (f: any) => {
    setFoodName(f.food_name || '');
    setServingSize(String(f.serving_size || 100));
    setServingUnit(f.serving_unit || 'g');
    setCalories(String(f.calories || ''));
    setProtein(String(f.protein_g || ''));
    setCarbs(String(f.carbs_g || ''));
    setFat(String(f.fat_g || ''));
    setFiber(String(f.fiber_g || ''));
    setScanResult(null);
    toast.success(`Loaded: ${f.food_name}`, { description: 'Adjust servings if needed.' });
  };

  // Increment use_count when adding a food (upsert to saved_foods)
  const upsertSavedFood = useCallback(async (entry: {
    food_name: string; serving_size: number; serving_unit: string;
    calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number;
  }) => {
    if (!user) return;
    const existing = savedFoods.find(f => f.food_name.toLowerCase() === entry.food_name.toLowerCase());
    if (existing) {
      await supabase.from('saved_foods').update({ use_count: (existing.use_count || 0) + 1 }).eq('id', existing.id);
    } else {
      await supabase.from('saved_foods').insert({ ...entry, user_id: user.id, use_count: 1 });
    }
  }, [user, savedFoods]);

  // Open Food Facts barcode lookup
  const handleBarcodeLookup = async () => {
    const code = barcodeInput.trim();
    if (!code) return;
    setBarcodeLoading(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}?fields=product_name,brands,nutriments,serving_quantity,serving_quantity_unit`);
      const json = await res.json();
      if (json.status !== 1 || !json.product) {
        toast.error('Product not found', { description: 'Try a different barcode or enter nutrition manually.' });
        setBarcodeLoading(false);
        return;
      }
      const p = json.product;
      const n = p.nutriments || {};
      const servQty = p.serving_quantity ? parseFloat(p.serving_quantity) : 100;
      const factor = servQty / 100;

      setFoodName(p.product_name || '');
      setServingSize(String(servQty));
      setServingUnit(p.serving_quantity_unit || 'g');
      setCalories(String(Math.round((n['energy-kcal_100g'] ?? 0) * factor)));
      setProtein(String(Math.round((n.proteins_100g ?? 0) * factor)));
      setCarbs(String(Math.round((n.carbohydrates_100g ?? 0) * factor)));
      setFat(String(Math.round((n.fat_100g ?? 0) * factor)));
      setFiber(String(Math.round((n.fiber_100g ?? 0) * factor)));

      const brand = p.brands ? ` (${p.brands.split(',')[0].trim()})` : '';
      toast.success(`Found: ${p.product_name}${brand}`, { description: 'Nutrition populated — verify before saving.' });
      setScanResult({ confidence: 'high', notes: `Open Food Facts${p.brands ? ' · ' + p.brands.split(',')[0].trim() : ''}` });
      setShowBarcodeInput(false);
    } catch {
      toast.error('Barcode lookup failed', { description: 'Check your connection and try again.' });
    }
    setBarcodeLoading(false);
  };

  const toggleMeal = (type: string) => {
    setExpandedMeals(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  // Camera: first try barcode decode, then fall back to AI image analysis
  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    try {
      // Step 1: Try to decode a barcode from the image using ZXing
      let barcodeDetected: string | null = null;
      let imgUrl: string | null = null;
      try {
        imgUrl = URL.createObjectURL(file);
        const imgEl = new Image();
        imgEl.crossOrigin = 'anonymous';
        await new Promise<void>((res, rej) => {
          imgEl.onload = () => res();
          imgEl.onerror = () => rej(new Error('img load failed'));
          imgEl.src = imgUrl!;
        });
        const codeReader = new BrowserMultiFormatReader();
        const result = await codeReader.decodeFromImageElement(imgEl);
        barcodeDetected = result.getText();
      } catch {
        // No barcode found — proceed to AI image analysis
      } finally {
        if (imgUrl) URL.revokeObjectURL(imgUrl);
      }

      if (barcodeDetected) {
        // Step 2a: Barcode found — look it up on Open Food Facts
        toast.info(`Barcode detected: ${barcodeDetected}`, { description: 'Looking up product…' });
        const res = await fetch(
          `https://world.openfoodfacts.org/api/v2/product/${barcodeDetected}?fields=product_name,brands,nutriments,serving_quantity,serving_quantity_unit`
        );
        const json = await res.json();
        if (json.status !== 1 || !json.product) {
          toast.error('Product not found in database', { description: 'Try entering nutrition manually.' });
          setScanning(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
        const p = json.product;
        const n = p.nutriments || {};
        const servQty = p.serving_quantity ? parseFloat(p.serving_quantity) : 100;
        const factor = servQty / 100;
        setFoodName(p.product_name || '');
        setServingSize(String(servQty));
        setServingUnit(p.serving_quantity_unit || 'g');
        setCalories(String(Math.round((n['energy-kcal_100g'] ?? 0) * factor)));
        setProtein(String(Math.round((n.proteins_100g ?? 0) * factor)));
        setCarbs(String(Math.round((n.carbohydrates_100g ?? 0) * factor)));
        setFat(String(Math.round((n.fat_100g ?? 0) * factor)));
        setFiber(String(Math.round((n.fiber_100g ?? 0) * factor)));
        const brand = p.brands ? ` (${p.brands.split(',')[0].trim()})` : '';
        setScanResult({ confidence: 'high', notes: `Open Food Facts${p.brands ? ' · ' + p.brands.split(',')[0].trim() : ''}` });
        toast.success(`Found: ${p.product_name}${brand}`, { description: '✓ Nutrition pre-filled from barcode.' });
      } else {
        // Step 2b: No barcode — send to AI for food/label analysis
        const reader = new FileReader();
        reader.readAsDataURL(file);
        await new Promise<void>((resolve) => {
          reader.onload = async () => {
            const base64 = reader.result as string;
            const { data, error } = await supabase.functions.invoke('parse-food-image', {
              body: { imageBase64: base64 },
            });

            if (error || data?.error) {
              toast.error(data?.error || 'Failed to analyze image');
              resolve();
              return;
            }

            const result = data.result;
            setScanResult(result);
            setFoodName(result.food_name || '');
            setServingSize(String(result.serving_size || 100));
            setServingUnit(result.serving_unit || 'g');
            setCalories(String(Math.round(result.calories || 0)));
            setProtein(String(Math.round(result.protein_g || 0)));
            setCarbs(String(Math.round(result.carbs_g || 0)));
            setFat(String(Math.round(result.fat_g || 0)));
            setFiber(String(Math.round(result.fiber_g || 0)));

            const confidenceMsg = result.confidence === 'high'
              ? '✓ High confidence'
              : result.confidence === 'medium'
              ? '⚠ Medium confidence — please verify'
              : '⚠ Low confidence — please verify values';
            toast.success(`Scanned: ${result.food_name}`, { description: confidenceMsg });
            resolve();
          };
        });
      }
    } catch {
      toast.error('Failed to scan image');
    }

    setScanning(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Diet preset application
  const applyDietPreset = (dietKey: string) => {
    setSelectedDiet(dietKey);
    const preset = DIET_PRESETS[dietKey];
    if (!preset?.targets || dietKey === 'custom') return;
    const t = preset.targets;
    if (t.calories_target) setTargetCalories(String(t.calories_target));
    if (t.protein_target_g) setTargetProtein(String(t.protein_target_g));
    if (t.carbs_target_g) setTargetCarbs(String(t.carbs_target_g));
    if (t.fat_target_g) setTargetFat(String(t.fat_target_g));
    if (t.fiber_target_g !== undefined) setTargetFiber(String(t.fiber_target_g));
  };

  const handleSaveTargets = async () => {
    if (!user) return;
    const newTargets = {
      calories_target: parseInt(targetCalories) || 2000,
      protein_target_g: parseInt(targetProtein) || 150,
      carbs_target_g: parseInt(targetCarbs) || 200,
      fat_target_g: parseInt(targetFat) || 65,
      fiber_target_g: parseInt(targetFiber) || 30,
      diet_type: selectedDiet,
    };

    const { data: existing } = await supabase.from('nutrition_targets').select('id').eq('user_id', user.id).single();
    if (existing) {
      await supabase.from('nutrition_targets').update(newTargets).eq('user_id', user.id);
    } else {
      await supabase.from('nutrition_targets').insert({ ...newTargets, user_id: user.id });
    }

    setTargets({ ...newTargets, diet_type: selectedDiet });
    toast.success('Nutrition targets saved');
    setShowTargets(false);
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
      {/* Sub-tabs */}
      <Tabs value={foodTab} onValueChange={setFoodTab} className="w-full">
        <TabsList className="w-full bg-card/80 border border-border/60 h-9 p-0.5 gap-0.5">
          <TabsTrigger value="today" className="flex-1 text-[10px] font-semibold rounded data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Today
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1 text-[10px] font-semibold rounded data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            7-Day Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4 mt-3">
          {/* Date selector */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">{dateLabel}</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowTargets(true)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <Settings className="w-4 h-4" />
              </button>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto h-8 text-xs"
              />
            </div>
          </div>

          {/* Daily summary card */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-2xl font-bold text-foreground">{Math.round(dailyTotals.calories)}</div>
                  <div className="text-xs text-muted-foreground">of {targets.calories_target} cal</div>
                  {targets.diet_type && targets.diet_type !== 'custom' && (
                    <Badge variant="secondary" className="text-[9px] h-4 mt-0.5">{DIET_PRESETS[targets.diet_type]?.label || targets.diet_type}</Badge>
                  )}
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
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-foreground truncate">{entry.food_name}</span>
                                {entry.source === 'ai_scan' && <Sparkles className="w-2.5 h-2.5 text-primary flex-shrink-0" />}
                                {entry.source === 'barcode' && <Barcode className="w-2.5 h-2.5 text-accent flex-shrink-0" />}
                              </div>
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
        </TabsContent>

        <TabsContent value="weekly" className="mt-3">
          <WeeklyNutritionView />
        </TabsContent>
      </Tabs>

      {/* Hidden file input for camera/gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageCapture}
        className="hidden"
      />

      {/* Add food dialog */}
      <Dialog open={showAddFood} onOpenChange={(open) => {
        setShowAddFood(open);
        if (open) fetchSavedFoods();
        if (!open) { resetForm(); stopLiveScanner(); }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Utensils className="w-4 h-4 text-primary" />
              Add to {activeMealType}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">

            {/* Saved / Recent foods panel */}
            {savedFoods.length > 0 && !searchQuery && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Recent & Saved</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {savedFoods.map(f => (
                    <button
                      key={f.id}
                      onClick={() => applySavedFood(f)}
                      className="flex items-center gap-1 px-2 py-1 rounded-full border border-border/60 bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 transition-colors text-[11px] text-foreground max-w-[160px]"
                    >
                      {(f.use_count || 0) >= 3 && <Star className="w-2.5 h-2.5 text-primary flex-shrink-0" />}
                      <span className="truncate">{f.food_name}</span>
                      <span className="text-muted-foreground flex-shrink-0">{Math.round(f.calories)}c</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input method buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="gap-2 border-primary/40 text-primary hover:bg-primary/5"
                onClick={startLiveScanner}
                disabled={scanning || barcodeLoading}
              >
                <ScanLine className="w-4 h-4" />
                Live Barcode Scan
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-accent/40 text-accent hover:bg-accent/5"
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning || barcodeLoading}
              >
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {scanning ? 'Scanning…' : 'Photo / AI Scan'}
              </Button>
            </div>

            {/* Live barcode scanner modal */}
            {showLiveScanner && (
              <div className="relative rounded-xl overflow-hidden border border-primary/40 bg-black">
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                  {/* Scanner crosshair */}
                  <div className="w-52 h-32 border-2 border-primary rounded-lg opacity-80">
                    <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-primary rounded-tl" />
                    <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-primary rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-primary rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-primary rounded-br" />
                    {/* Scanning line animation */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/80 animate-bounce" style={{ animationDuration: '1.5s' }} />
                  </div>
                </div>
                <video
                  ref={videoRef}
                  className="w-full h-48 object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                {liveScannerLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20 gap-2">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    <span className="text-xs text-white">Starting camera…</span>
                  </div>
                )}
                {liveScannerError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 gap-2 p-4">
                    <span className="text-xs text-destructive text-center">{liveScannerError}</span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-3 py-2 bg-black/50">
                  <span className="text-[10px] text-white/70">Point at a barcode</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleTorch}
                      className={`p-1 rounded-full transition-colors ${torchOn ? 'text-yellow-300 bg-yellow-300/20' : 'text-white/60 hover:text-white'}`}
                      title="Toggle flashlight"
                    >
                      <Zap className="w-4 h-4" fill={torchOn ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={stopLiveScanner} className="text-white/80 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Manual barcode entry fallback — always visible */}
            <div className="flex gap-2 items-center">
              <div className="flex-1 relative">
                <Barcode className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Or type barcode (UPC)…"
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && barcodeInput.trim() && lookupAndFillBarcode(barcodeInput.trim())}
                  className="h-8 text-sm pl-8"
                  inputMode="numeric"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 border-accent/40 text-accent hover:bg-accent/5 flex-shrink-0"
                onClick={() => lookupAndFillBarcode(barcodeInput.trim())}
                disabled={barcodeLoading || !barcodeInput.trim()}
              >
                {barcodeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Look up'}
              </Button>
            </div>

            {scanResult && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 overflow-hidden">
                {/* Header row: image + source + scan again */}
                <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                  {productImage ? (
                    <img
                      src={productImage}
                      alt="Product"
                      className="w-10 h-10 rounded object-cover flex-shrink-0 border border-border/40 bg-muted"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded flex-shrink-0 border border-border/40 bg-muted flex items-center justify-center">
                      {scanResult.notes?.includes('Open Food Facts') || scanResult.notes?.includes('UPC')
                        ? <Barcode className="w-4 h-4 text-muted-foreground" />
                        : <Sparkles className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-primary leading-tight">
                      {scanResult.notes?.includes('Open Food Facts') ? 'Open Food Facts' : scanResult.notes?.includes('UPC') ? 'UPC ItemDB' : 'AI scanned'}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{scanResult.notes || `Confidence: ${scanResult.confidence}`}</p>
                  </div>
                  <button
                    onClick={() => {
                      setScanResult(null);
                      setProductImage(null);
                      setFoodName(''); setCalories(''); setProtein(''); setCarbs(''); setFat(''); setFiber('');
                      startLiveScanner();
                    }}
                    className="flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary border border-primary/30 hover:border-primary/60 rounded px-1.5 py-0.5 flex-shrink-0 transition-colors"
                  >
                    <ScanLine className="w-3 h-3" />
                    Scan again
                  </button>
                </div>
                {/* Macro mini-table */}
                {(calories || protein || carbs || fat) && (
                  <div className="grid grid-cols-4 divide-x divide-border/30 border-t border-border/20 mx-3 mb-2 rounded-sm overflow-hidden">
                    {[
                      { label: 'Cal', value: calories, unit: 'kcal' },
                      { label: 'Protein', value: protein, unit: 'g' },
                      { label: 'Carbs', value: carbs, unit: 'g' },
                      { label: 'Fat', value: fat, unit: 'g' },
                    ].map(({ label, value, unit }) => (
                      <div key={label} className="flex flex-col items-center py-1.5 bg-background/40">
                        <span className="text-[11px] font-semibold text-foreground leading-none">{value || '—'}{value ? <span className="text-[9px] font-normal text-muted-foreground">{unit}</span> : ''}</span>
                        <span className="text-[9px] text-muted-foreground mt-0.5">{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="relative flex items-center gap-2">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-[10px] text-muted-foreground">or search by name</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* Food name search input with live suggestions */}
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                {searchLoading && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground animate-spin" />
                )}
                <Input
                  placeholder="Search food (e.g., greek yogurt)…"
                  value={searchQuery || foodName}
                  onChange={e => handleNameSearch(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                  onBlur={() => setTimeout(() => setShowSearchResults(false), 150)}
                  className="pl-8 pr-8"
                  autoFocus={!scanning}
                />
              </div>

              {/* Search results dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                  {searchResults.map((p, i) => {
                    const n = p.nutriments || {};
                    const servQty = p.serving_quantity ? parseFloat(p.serving_quantity) : 100;
                    const factor = servQty / 100;
                    const kcal = Math.round((n['energy-kcal_100g'] ?? 0) * factor);
                    const prot = Math.round((n.proteins_100g ?? 0) * factor);
                    const brand = p.brands ? p.brands.split(',')[0].trim() : '';
                    return (
                      <button
                        key={i}
                        onMouseDown={() => applyOFFProduct(p)}
                        className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-secondary/60 transition-colors text-left border-b border-border/30 last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{p.product_name}</div>
                          {brand && <div className="text-[10px] text-muted-foreground">{brand}</div>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs font-semibold text-foreground">{kcal} cal</div>
                          <div className="text-[9px] text-muted-foreground">P {prot}g · {servQty}{p.serving_quantity_unit || 'g'}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

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

      {/* Nutrition targets dialog */}
      <Dialog open={showTargets} onOpenChange={setShowTargets}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Settings className="w-4 h-4 text-primary" />
              Nutrition Targets
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Diet presets */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Diet Framework</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(DIET_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => applyDietPreset(key)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      selectedDiet === key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 hover:border-border hover:bg-secondary/50 text-muted-foreground'
                    }`}
                  >
                    <div className="text-xs font-semibold">{preset.label}</div>
                    <div className="text-[9px] mt-0.5 opacity-80">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border/50 pt-3">
              <p className="text-xs font-semibold text-foreground mb-2">Custom Targets</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <label className="text-[10px] text-muted-foreground mb-1 block">Calories</label>
                  <Input value={targetCalories} onChange={e => { setTargetCalories(e.target.value); setSelectedDiet('custom'); }} type="number" className="text-sm pr-8" />
                  <span className="absolute right-2 bottom-2 text-[10px] text-muted-foreground">cal</span>
                </div>
                <div className="relative">
                  <label className="text-[10px] text-muted-foreground mb-1 block">Protein</label>
                  <Input value={targetProtein} onChange={e => { setTargetProtein(e.target.value); setSelectedDiet('custom'); }} type="number" className="text-sm pr-6" />
                  <span className="absolute right-2 bottom-2 text-[10px] text-muted-foreground">g</span>
                </div>
                <div className="relative">
                  <label className="text-[10px] text-muted-foreground mb-1 block">Carbs</label>
                  <Input value={targetCarbs} onChange={e => { setTargetCarbs(e.target.value); setSelectedDiet('custom'); }} type="number" className="text-sm pr-6" />
                  <span className="absolute right-2 bottom-2 text-[10px] text-muted-foreground">g</span>
                </div>
                <div className="relative">
                  <label className="text-[10px] text-muted-foreground mb-1 block">Fat</label>
                  <Input value={targetFat} onChange={e => { setTargetFat(e.target.value); setSelectedDiet('custom'); }} type="number" className="text-sm pr-6" />
                  <span className="absolute right-2 bottom-2 text-[10px] text-muted-foreground">g</span>
                </div>
                <div className="relative">
                  <label className="text-[10px] text-muted-foreground mb-1 block">Fiber</label>
                  <Input value={targetFiber} onChange={e => { setTargetFiber(e.target.value); setSelectedDiet('custom'); }} type="number" className="text-sm pr-6" />
                  <span className="absolute right-2 bottom-2 text-[10px] text-muted-foreground">g</span>
                </div>
              </div>
            </div>

            <Button onClick={handleSaveTargets} className="w-full">Save Targets</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FoodTrackerView;
