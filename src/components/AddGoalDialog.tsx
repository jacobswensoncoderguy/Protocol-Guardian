import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Target, Sparkles, ChevronRight, Calendar as CalendarIcon, ArrowLeft, Info, MessageCircle, Loader2, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import DatePickerInput from '@/components/DatePickerInput';

import { getGoalIcon, GOAL_TYPE_LUCIDE_ICONS } from '@/lib/goalIcons';
import { UserGoal } from '@/hooks/useGoals';

/* ─── Category → smart metric presets ─── */
interface MetricPreset {
  label: string;
  unit: string;
  example?: string;
}

const GOAL_CATEGORIES: {
  key: string;
  label: string;
  description: string;
  metrics: MetricPreset[];
  subGoalHints: string[];
}[] = [
  {
    key: 'muscle_gain',
    label: 'Muscle Gain',
    description: 'Lean mass, strength, and hypertrophy targets',
    metrics: [
      { label: 'Lean mass (lbs)', unit: 'lbs', example: '+15' },
      { label: 'Lean mass (%)', unit: '%', example: '+8' },
      { label: 'Bench press (lbs)', unit: 'lbs', example: '315' },
      { label: 'Squat (lbs)', unit: 'lbs', example: '405' },
      { label: 'Arm circumference (in)', unit: 'in', example: '18' },
    ],
    subGoalHints: ['Add 15 lbs lean mass in 6 months', 'Increase bench press by 50 lbs', 'Gain 2 inches on arms'],
  },
  {
    key: 'fat_loss',
    label: 'Fat Loss',
    description: 'Body fat percentage, weight, and composition',
    metrics: [
      { label: 'Body fat %', unit: '%', example: '12' },
      { label: 'Weight (lbs)', unit: 'lbs', example: '185' },
      { label: 'Waist (in)', unit: 'in', example: '32' },
      { label: 'Pounds to lose', unit: 'lbs', example: '-20' },
    ],
    subGoalHints: ['Drop to 12% body fat', 'Lose 20 lbs in 4 months', 'Reduce waist to 32 inches'],
  },
  {
    key: 'cardiovascular',
    label: 'Cardiovascular',
    description: 'Heart health, blood pressure, and endurance',
    metrics: [
      { label: 'Resting HR (bpm)', unit: 'bpm', example: '55' },
      { label: 'Systolic BP (mmHg)', unit: 'mmHg', example: '120' },
      { label: 'Diastolic BP (mmHg)', unit: 'mmHg', example: '75' },
      { label: 'VO2 max (mL/kg/min)', unit: 'mL/kg/min', example: '50' },
      { label: 'LDL cholesterol (mg/dL)', unit: 'mg/dL', example: '90' },
    ],
    subGoalHints: ['Get resting HR under 60 bpm', 'Normalize BP to 120/75', 'Improve VO2 max to 50+'],
  },
  {
    key: 'hormonal',
    label: 'Hormonal Balance',
    description: 'Testosterone, estrogen, thyroid, cortisol, and more',
    metrics: [
      { label: 'Total Testosterone (ng/dL)', unit: 'ng/dL', example: '900' },
      { label: 'Free Testosterone (pg/mL)', unit: 'pg/mL', example: '25' },
      { label: 'Estradiol (pg/mL)', unit: 'pg/mL', example: '25' },
      { label: 'IGF-1 (ng/mL)', unit: 'ng/mL', example: '300' },
      { label: 'TSH (mIU/L)', unit: 'mIU/L', example: '2.0' },
      { label: 'Cortisol AM (μg/dL)', unit: 'μg/dL', example: '15' },
      { label: 'SHBG (nmol/L)', unit: 'nmol/L', example: '35' },
      { label: 'Prolactin (ng/mL)', unit: 'ng/mL', example: '8' },
    ],
    subGoalHints: ['Optimize total T to 800-1100 ng/dL', 'Keep estradiol in 20-30 pg/mL range', 'Increase IGF-1 above 250 ng/mL', 'Normalize TSH to 1.5-2.5'],
  },
  {
    key: 'cognitive',
    label: 'Cognitive Performance',
    description: 'Focus, memory, mental clarity, and neuroprotection',
    metrics: [
      { label: 'Focus score (1-10)', unit: 'score', example: '8' },
      { label: 'Sleep quality (1-10)', unit: 'score', example: '9' },
      { label: 'Reaction time (ms)', unit: 'ms', example: '200' },
    ],
    subGoalHints: ['Improve sustained focus to 4+ hours', 'Reduce brain fog episodes', 'Enhance working memory'],
  },
  {
    key: 'recovery',
    label: 'Recovery & Healing',
    description: 'Tissue repair, inflammation, and injury recovery',
    metrics: [
      { label: 'Pain level (1-10)', unit: 'score', example: '2' },
      { label: 'CRP (mg/L)', unit: 'mg/L', example: '0.5' },
      { label: 'Recovery rating (1-10)', unit: 'score', example: '9' },
      { label: 'ROM improvement (°)', unit: '°', example: '15' },
    ],
    subGoalHints: ['Reduce joint pain to 2/10', 'Get CRP under 1.0 mg/L', 'Full ROM recovery post-surgery'],
  },
  {
    key: 'longevity',
    label: 'Longevity & Anti-Aging',
    description: 'NAD+, telomeres, biological age, and oxidative stress',
    metrics: [
      { label: 'Biological age (years)', unit: 'years', example: '35' },
      { label: 'NAD+ levels (μM)', unit: 'μM', example: '40' },
      { label: 'HbA1c (%)', unit: '%', example: '5.0' },
      { label: 'Fasting glucose (mg/dL)', unit: 'mg/dL', example: '85' },
    ],
    subGoalHints: ['Reduce biological age by 5 years', 'Optimize fasting glucose to 80-90', 'Maintain HbA1c below 5.2'],
  },
  {
    key: 'libido',
    label: 'Libido & Sexual Health',
    description: 'Drive, performance, and vascular health',
    metrics: [
      { label: 'Libido rating (1-10)', unit: 'score', example: '9' },
      { label: 'Performance score (1-10)', unit: 'score', example: '9' },
    ],
    subGoalHints: ['Improve libido to consistent 8+/10', 'Optimize vascular function for performance'],
  },
  {
    key: 'sleep',
    label: 'Sleep Quality',
    description: 'Duration, deep sleep, and recovery',
    metrics: [
      { label: 'Hours per night', unit: 'hrs', example: '8' },
      { label: 'Deep sleep (min)', unit: 'min', example: '90' },
      { label: 'Sleep score (1-100)', unit: 'score', example: '85' },
      { label: 'REM (min)', unit: 'min', example: '120' },
    ],
    subGoalHints: ['Get 7.5+ hours consistently', 'Increase deep sleep to 90+ min', 'Improve HRV during sleep'],
  },
];

interface AddGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateGoal: (goal: Omit<UserGoal, 'id' | 'status'>) => Promise<void>;
  existingGoals: UserGoal[];
}

type Step = 'category' | 'configure' | 'interview';

const AddGoalDialog = ({ open, onOpenChange, onCreateGoal, existingGoals }: AddGoalDialogProps) => {
  const [step, setStep] = useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = useState<typeof GOAL_CATEGORIES[0] | null>(null);
  const [customCategory, setCustomCategory] = useState('');

  // Configure step state
  const [title, setTitle] = useState('');
  const [selectedMetric, setSelectedMetric] = useState<MetricPreset | null>(null);
  const [customUnit, setCustomUnit] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [baselineValue, setBaselineValue] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(2);
  const [saving, setSaving] = useState(false);

  // Interview step state
  const [interviewMessages, setInterviewMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [interviewInput, setInterviewInput] = useState('');
  const [interviewStreaming, setInterviewStreaming] = useState(false);
  const [interviewCount, setInterviewCount] = useState(0);
  const interviewRef = useRef<HTMLDivElement>(null);
  const interviewStarted = useRef(false);

  const resetForm = () => {
    setStep('category');
    setSelectedCategory(null);
    setCustomCategory('');
    setTitle('');
    setSelectedMetric(null);
    setCustomUnit('');
    setTargetValue('');
    setBaselineValue('');
    setTargetDate('');
    setDescription('');
    setPriority(2);
    setInterviewMessages([]);
    setInterviewInput('');
    setInterviewCount(0);
    interviewStarted.current = false;
  };

  const handleCategorySelect = (cat: typeof GOAL_CATEGORIES[0]) => {
    setSelectedCategory(cat);
    setStep('configure');
  };

  const handleCustomCategory = () => {
    if (!customCategory.trim()) return;
    setSelectedCategory({
      key: 'custom',
      label: customCategory.trim(),
      description: 'Custom goal',
      metrics: [
        { label: 'Custom value', unit: 'units' },
        { label: 'Score (1-10)', unit: 'score' },
        { label: 'Percentage', unit: '%' },
      ],
      subGoalHints: [],
    });
    setStep('configure');
  };

  const handleMetricSelect = (metric: MetricPreset) => {
    setSelectedMetric(metric);
    if (!title) {
      // Auto-fill title from metric
      setTitle(metric.label.replace(/\s*\(.*\)/, ''));
    }
  };

  const handleGoToInterview = () => {
    if (!selectedCategory || !title.trim()) return;
    setStep('interview');
  };

  // Start interview when entering interview step
  useEffect(() => {
    if (step === 'interview' && !interviewStarted.current && interviewMessages.length === 0) {
      interviewStarted.current = true;
      const intro = `I'm setting up a new ${selectedCategory?.label} goal: "${title}". Baseline: ${baselineValue || 'unknown'}, Target: ${targetValue || 'unknown'} ${selectedMetric?.unit || customUnit || ''}. Help me refine this to be specific and achievable.`;
      const userMsg = { role: 'user' as const, content: intro };
      setInterviewMessages([userMsg]);
      sendInterviewMsg([userMsg]);
    }
  }, [step]);

  useEffect(() => {
    interviewRef.current?.scrollTo({ top: interviewRef.current.scrollHeight, behavior: 'smooth' });
  }, [interviewMessages]);

  const sendInterviewMsg = useCallback(async (msgHistory: { role: 'user' | 'assistant'; content: string }[]) => {
    setInterviewStreaming(true);
    let content = '';
    let toolCallArgs = '';
    let inToolCall = false;
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/goal-refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: msgHistory, goal: { title, goal_type: selectedCategory?.key, baseline_value: baselineValue ? parseFloat(baselineValue) : null, target_value: targetValue ? parseFloat(targetValue) : null, target_unit: selectedMetric?.unit || customUnit || null } }),
      });
      if (!resp.ok || !resp.body) throw new Error('Stream failed');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.tool_calls) { inToolCall = true; const tc = delta.tool_calls[0]; if (tc?.function?.arguments) toolCallArgs += tc.function.arguments; continue; }
            const c = delta?.content;
            if (c && !inToolCall) {
              content += c;
              setInterviewMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') return prev.map((m, i) => i === prev.length - 1 ? { ...m, content } : m);
                return [...prev, { role: 'assistant', content }];
              });
            }
          } catch {}
        }
      }
      if (inToolCall && toolCallArgs) {
        try {
          const parsed = JSON.parse(toolCallArgs);
          if (parsed.updates) {
            if (parsed.updates.title) setTitle(parsed.updates.title);
            if (parsed.updates.target_value != null) setTargetValue(String(parsed.updates.target_value));
            if (parsed.updates.baseline_value != null) setBaselineValue(String(parsed.updates.baseline_value));
            if (parsed.updates.target_unit) setCustomUnit(parsed.updates.target_unit);
            if (parsed.updates.target_date) setTargetDate(parsed.updates.target_date);
            if (parsed.updates.description) setDescription(parsed.updates.description);
          }
        } catch {}
      }
    } catch (e) {
      console.error('Interview error:', e);
      setInterviewMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble connecting. You can create the goal as-is.' }]);
    } finally {
      setInterviewStreaming(false);
    }
  }, [title, selectedCategory, baselineValue, targetValue, selectedMetric, customUnit]);

  const handleInterviewSend = () => {
    if (!interviewInput.trim() || interviewStreaming) return;
    const userMsg = { role: 'user' as const, content: interviewInput.trim() };
    const newHistory = [...interviewMessages, userMsg];
    setInterviewMessages(newHistory);
    setInterviewInput('');
    setInterviewCount(c => c + 1);
    sendInterviewMsg(newHistory);
  };

  const handleSave = async () => {
    if (!selectedCategory || !title.trim()) return;
    setSaving(true);
    try {
      await onCreateGoal({
        goal_type: selectedCategory.key,
        title: title.trim(),
        description: description.trim() || undefined,
        body_area: getBodyArea(selectedCategory.key),
        target_value: targetValue ? parseFloat(targetValue) : undefined,
        target_unit: selectedMetric?.unit || customUnit || undefined,
        baseline_value: baselineValue ? parseFloat(baselineValue) : undefined,
        target_date: targetDate || undefined,
        priority,
      });
      resetForm();
      onOpenChange(false);
    } catch (e) {
      console.error('Failed to create goal:', e);
    } finally {
      setSaving(false);
    }
  };

  const getBodyArea = (goalType: string): string | undefined => {
    const map: Record<string, string> = {
      muscle_gain: 'musculoskeletal',
      fat_loss: 'metabolic',
      cardiovascular: 'cardiovascular',
      hormonal: 'hormonal',
      cognitive: 'cognitive',
      recovery: 'musculoskeletal',
      longevity: 'metabolic',
      libido: 'hormonal',
      sleep: 'cognitive',
    };
    return map[goalType];
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            {(step === 'configure' || step === 'interview') && (
              <button onClick={() => step === 'interview' ? setStep('configure') : setStep('category')} className="p-0.5 rounded hover:bg-secondary transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <Plus className="w-4 h-4 text-primary" />
            {step === 'category' ? 'Add New Goal' : step === 'interview' ? 'Fine-tune with AI' : `${selectedCategory?.label}`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin">
          {step === 'category' ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">Choose a category or create your own:</p>

              {GOAL_CATEGORIES.map(cat => {
                const Icon = getGoalIcon(cat.key);
                const existingCount = existingGoals.filter(g => g.goal_type === cat.key && g.status === 'active').length;
                return (
                  <button
                    key={cat.key}
                    onClick={() => handleCategorySelect(cat)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{cat.label}</span>
                        {existingCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono">{existingCount} active</span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{cat.description}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0" />
                  </button>
                );
              })}

              {/* Custom "Other" option */}
              <div className="border border-dashed border-border/60 rounded-lg p-3 space-y-2 mt-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Other / Custom</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={customCategory}
                    onChange={e => setCustomCategory(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCustomCategory()}
                    placeholder="e.g. Gut Health, Skin Quality, Mobility..."
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                  />
                  <button
                    onClick={handleCustomCategory}
                    disabled={!customCategory.trim()}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40"
                  >
                    Go
                  </button>
                </div>
              </div>
            </div>
          ) : step === 'configure' && selectedCategory ? (
            <div className="space-y-4">
              {/* Sub-goal hints */}
              {selectedCategory.subGoalHints.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Suggested Goals
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCategory.subGoalHints.map((hint, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setTitle(hint);
                          // Try to extract a number and unit from the hint
                          const numMatch = hint.match(/([\d.]+)\s*(lbs?|%|ng\/dL|pg\/mL|bpm|mg\/dL|hours?|min|score)/i);
                          if (numMatch) {
                            setTargetValue(numMatch[1]);
                            const matchedMetric = selectedCategory.metrics.find(m => m.unit.toLowerCase() === numMatch[2].toLowerCase());
                            if (matchedMetric) setSelectedMetric(matchedMetric);
                          }
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Goal Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="What do you want to achieve?"
                  className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                  autoFocus
                />
              </div>

              {/* Metric selection */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  How will you measure it?
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {selectedCategory.metrics.map((metric, i) => (
                    <button
                      key={i}
                      onClick={() => handleMetricSelect(metric)}
                      className={`text-left px-2.5 py-2 rounded-lg border text-xs transition-all ${
                        selectedMetric?.label === metric.label
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/50 bg-card hover:border-primary/30 text-foreground'
                      }`}
                    >
                      <span className="font-medium block">{metric.label}</span>
                      {metric.example && (
                        <span className="text-[10px] text-muted-foreground">e.g. {metric.example}</span>
                      )}
                    </button>
                  ))}
                  {/* Custom unit */}
                  <button
                    onClick={() => { setSelectedMetric(null); setCustomUnit(''); }}
                    className={`text-left px-2.5 py-2 rounded-lg border text-xs transition-all ${
                      selectedMetric === null && customUnit !== undefined
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-dashed border-border/50 bg-card hover:border-primary/30'
                    } text-muted-foreground`}
                  >
                    <span className="font-medium block text-foreground">Custom unit</span>
                    <span className="text-[10px]">Define your own</span>
                  </button>
                </div>
                {!selectedMetric && (
                  <input
                    value={customUnit}
                    onChange={e => setCustomUnit(e.target.value)}
                    placeholder="e.g. reps, sets, hours, nmol/L..."
                    className="w-full mt-2 px-3 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                  />
                )}
              </div>

              {/* Baseline + Target values */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Current / Baseline
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="any"
                      value={baselineValue}
                      onChange={e => setBaselineValue(e.target.value)}
                      placeholder="Now"
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                    />
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{selectedMetric?.unit || customUnit || ''}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Target
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="any"
                      value={targetValue}
                      onChange={e => setTargetValue(e.target.value)}
                      placeholder="Goal"
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                    />
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{selectedMetric?.unit || customUnit || ''}</span>
                  </div>
                </div>
              </div>

              {/* Target Date */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  Target Date (deadline)
                </label>
                <DatePickerInput
                  value={targetDate}
                  onChange={setTargetDate}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full text-sm"
                />
                {targetDate && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {Math.ceil((new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days from now
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Additional context, strategy, or notes..."
                  rows={2}
                  className="w-full px-3 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Priority
                </label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        priority === p
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border/50 bg-card text-muted-foreground hover:border-primary/30'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">1 = highest priority</p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleGoToInterview}
                  disabled={!title.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm disabled:opacity-40 transition-all hover:opacity-90"
                  style={{ background: 'hsl(var(--neon-cyan))', color: 'hsl(var(--card))' }}
                >
                  <MessageCircle className="w-4 h-4" /> Fine-tune with AI
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-40 transition-all hover:opacity-90"
                >
                  {saving ? 'Creating...' : 'Create Now'}
                </button>
              </div>
            </div>
          ) : step === 'interview' ? (
            /* ── AI Interview Step ── */
            <div className="flex flex-col h-[55vh]">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15 mb-3">
                <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground">
                  AI is helping you refine <strong className="text-foreground">{title}</strong> into a specific, measurable goal. Chat to adjust targets.
                </p>
              </div>

              <div ref={interviewRef} className="flex-1 overflow-y-auto space-y-3 mb-3 scrollbar-thin">
                {interviewMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border border-border/50 text-foreground'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm prose-invert max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : msg.content}
                    </div>
                  </div>
                ))}
                {interviewStreaming && interviewMessages[interviewMessages.length - 1]?.role !== 'assistant' && (
                  <div className="flex justify-start">
                    <div className="bg-card border border-border/50 rounded-lg px-3 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <input
                  value={interviewInput}
                  onChange={e => setInterviewInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleInterviewSend()}
                  placeholder="Tell AI what to adjust..."
                  disabled={interviewStreaming}
                  className="flex-1 px-3 py-2 rounded-lg border border-border/50 bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 disabled:opacity-50"
                />
                <button onClick={handleInterviewSend} disabled={interviewStreaming || !interviewInput.trim()}
                  className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 transition-all">
                  <Send className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 rounded-lg font-medium text-sm disabled:opacity-40 transition-all hover:opacity-90"
                style={{ background: 'hsl(var(--neon-cyan))', color: 'hsl(var(--card))' }}
              >
                {saving ? 'Creating...' : '✓ Create Goal with Refined Targets'}
              </button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddGoalDialog;
