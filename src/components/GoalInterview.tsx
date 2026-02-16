import { useState } from 'react';
import { Target, Activity, Brain, Heart, Moon, Flame, Dumbbell, Zap, ChevronRight, ChevronLeft, Sparkles, MessageCircle, Droplets, ScanLine, Camera, BarChart3, BookOpen, PlusCircle } from 'lucide-react';

export interface OnboardingResponse {
  primaryGoals: string[];
  bodyFocus: string[];
  experience: string;
  healthConcerns: string[];
  timeline: string;
  commitmentLevel: string;
  trackingPreferences: string[];
  currentMetrics: Record<string, string>;
}

interface GoalInterviewProps {
  onComplete: (responses: OnboardingResponse) => void;
  gender?: string | null;
}

const GOAL_OPTIONS_MALE = [
  { id: 'muscle_gain', label: 'Build Muscle', icon: Dumbbell, color: 'text-emerald-400' },
  { id: 'fat_loss', label: 'Lose Fat', icon: Flame, color: 'text-orange-400' },
  { id: 'cardiovascular', label: 'Heart Health', icon: Heart, color: 'text-red-400' },
  { id: 'cognitive', label: 'Cognitive Performance', icon: Brain, color: 'text-violet-400' },
  { id: 'hormonal', label: 'Hormone Optimization', icon: Activity, color: 'text-cyan-400' },
  { id: 'longevity', label: 'Longevity & Anti-Aging', icon: Zap, color: 'text-yellow-400' },
  { id: 'recovery', label: 'Recovery & Healing', icon: Target, color: 'text-green-400' },
  { id: 'sleep', label: 'Sleep Quality', icon: Moon, color: 'text-indigo-400' },
  { id: 'libido', label: 'Libido & Sexual Health', icon: Sparkles, color: 'text-pink-400' },
];

const GOAL_OPTIONS_FEMALE = [
  { id: 'body_composition', label: 'Body Composition', icon: Dumbbell, color: 'text-emerald-400' },
  { id: 'fat_loss', label: 'Lose Fat', icon: Flame, color: 'text-orange-400' },
  { id: 'cardiovascular', label: 'Heart Health', icon: Heart, color: 'text-red-400' },
  { id: 'cognitive', label: 'Cognitive Performance', icon: Brain, color: 'text-violet-400' },
  { id: 'hormonal_balance', label: 'Hormonal Balance', icon: Activity, color: 'text-cyan-400' },
  { id: 'longevity', label: 'Longevity & Anti-Aging', icon: Zap, color: 'text-yellow-400' },
  { id: 'recovery', label: 'Recovery & Healing', icon: Target, color: 'text-green-400' },
  { id: 'sleep', label: 'Sleep Quality', icon: Moon, color: 'text-indigo-400' },
  { id: 'skin_hair', label: 'Skin & Hair Health', icon: Sparkles, color: 'text-pink-400' },
  { id: 'fertility', label: 'Fertility & Cycle Health', icon: Heart, color: 'text-rose-400' },
  { id: 'stress', label: 'Stress & Mood Support', icon: Brain, color: 'text-amber-400' },
];

const BODY_AREAS = [
  { id: 'arms', label: 'Arms' },
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'legs', label: 'Legs' },
  { id: 'core', label: 'Core / Abs' },
  { id: 'full_body', label: 'Full Body' },
];

const EXPERIENCE_OPTIONS = [
  { id: 'beginner', label: 'New to biohacking', description: 'Just starting to explore supplements and protocols' },
  { id: 'intermediate', label: 'Some experience', description: '1-2 years with peptides or advanced supplementation' },
  { id: 'advanced', label: 'Experienced', description: '3+ years, familiar with cycling, stacking, and bloodwork' },
];

const HEALTH_CONCERNS_MALE = [
  { id: 'insulin_resistance', label: 'Insulin Resistance' },
  { id: 'inflammation', label: 'Chronic Inflammation' },
  { id: 'joint_pain', label: 'Joint Pain' },
  { id: 'low_testosterone', label: 'Low Testosterone' },
  { id: 'thyroid', label: 'Thyroid Issues' },
  { id: 'gut_health', label: 'Gut Health' },
  { id: 'anxiety', label: 'Anxiety / Stress' },
  { id: 'none', label: 'None of the above' },
];

const HEALTH_CONCERNS_FEMALE = [
  { id: 'insulin_resistance', label: 'Insulin Resistance' },
  { id: 'inflammation', label: 'Chronic Inflammation' },
  { id: 'joint_pain', label: 'Joint Pain' },
  { id: 'hormonal_imbalance', label: 'Hormonal Imbalance' },
  { id: 'pcos', label: 'PCOS' },
  { id: 'perimenopause', label: 'Perimenopause / Menopause' },
  { id: 'thyroid', label: 'Thyroid Issues' },
  { id: 'gut_health', label: 'Gut Health' },
  { id: 'anxiety', label: 'Anxiety / Stress' },
  { id: 'bone_density', label: 'Bone Density' },
  { id: 'none', label: 'None of the above' },
];

const TIMELINE_OPTIONS = [
  { id: '3months', label: '3 months', description: 'Quick wins and immediate improvements' },
  { id: '6months', label: '6 months', description: 'Meaningful body recomposition and health markers' },
  { id: '12months', label: '12 months', description: 'Comprehensive transformation' },
  { id: 'ongoing', label: 'Ongoing', description: 'Long-term optimization with no end date' },
];

const TRACKING_PREFS = [
  { id: 'bloodwork', label: 'Bloodwork Panels', icon: Droplets },
  { id: 'dexa', label: 'DEXA / InBody Scans', icon: ScanLine },
  { id: 'photos', label: 'Progress Photos', icon: Camera },
  { id: 'performance', label: 'Performance Metrics', icon: BarChart3 },
  { id: 'subjective', label: 'Subjective Journals', icon: BookOpen },
];

type Step = { title: string; subtitle: string };

const STEPS: Step[] = [
  { title: 'What are your goals?', subtitle: 'Select all that apply' },
  { title: 'Body focus areas', subtitle: 'Where do you want to see changes?' },
  { title: 'Experience level', subtitle: 'How familiar are you with biohacking?' },
  { title: 'Health considerations', subtitle: 'Any conditions to factor in?' },
  { title: 'Target timeline', subtitle: 'How quickly do you want results?' },
  { title: 'How will you track?', subtitle: 'Select your preferred evidence types' },
  { title: 'Current baseline', subtitle: 'Optional starting measurements' },
];

const GoalInterview = ({ onComplete, gender }: GoalInterviewProps) => {
  const isFemale = gender === 'female';
  const goalOptions = isFemale ? GOAL_OPTIONS_FEMALE : GOAL_OPTIONS_MALE;
  const healthConcerns = isFemale ? HEALTH_CONCERNS_FEMALE : HEALTH_CONCERNS_MALE;

  const baselineMetrics = isFemale
    ? [
        { key: 'weight', label: 'Body Weight', placeholder: 'e.g. 135 lbs' },
        { key: 'bodyFat', label: 'Body Fat %', placeholder: 'e.g. 24%' },
        { key: 'leanMass', label: 'Lean Mass', placeholder: 'e.g. 103 lbs' },
        { key: 'estradiol', label: 'Estradiol (E2)', placeholder: 'e.g. 150 pg/mL' },
        { key: 'progesterone', label: 'Progesterone', placeholder: 'e.g. 12 ng/mL' },
      ]
    : [
        { key: 'weight', label: 'Body Weight', placeholder: 'e.g. 185 lbs' },
        { key: 'bodyFat', label: 'Body Fat %', placeholder: 'e.g. 18%' },
        { key: 'leanMass', label: 'Lean Mass', placeholder: 'e.g. 152 lbs' },
        { key: 'testosterone', label: 'Total Testosterone', placeholder: 'e.g. 650 ng/dL' },
      ];

  const [step, setStep] = useState(0);
  const [customConcern, setCustomConcern] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [responses, setResponses] = useState<OnboardingResponse>({
    primaryGoals: [],
    bodyFocus: [],
    experience: '',
    healthConcerns: [],
    timeline: '',
    commitmentLevel: 'moderate',
    trackingPreferences: [],
    currentMetrics: {},
  });

  const toggleMulti = (key: keyof OnboardingResponse, value: string) => {
    setResponses(prev => {
      const arr = prev[key] as string[];
      const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
      return { ...prev, [key]: next };
    });
  };

  const setSingle = (key: keyof OnboardingResponse, value: string) => {
    setResponses(prev => ({ ...prev, [key]: value }));
  };

  const setMetric = (key: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      currentMetrics: { ...prev.currentMetrics, [key]: value },
    }));
  };

  const canProceed = () => {
    switch (step) {
      case 0: return responses.primaryGoals.length > 0;
      case 1: return true;
      case 2: return responses.experience !== '';
      case 3: return true;
      case 4: return responses.timeline !== '';
      case 5: return true;
      case 6: return true;
      default: return true;
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onComplete(responses);
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="grid grid-cols-1 gap-2">
            {goalOptions.map(g => {
              const Icon = g.icon;
              const selected = responses.primaryGoals.includes(g.id);
              return (
                <button key={g.id} onClick={() => toggleMulti('primaryGoals', g.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${selected ? 'bg-primary/10 border-primary/40' : 'bg-card border-border/50 hover:bg-secondary/50'}`}>
                  <Icon className={`w-5 h-5 ${selected ? 'text-primary' : g.color}`} />
                  <span className="text-sm font-medium">{g.label}</span>
                </button>
              );
            })}
          </div>
        );
      case 1:
        return (
          <div className="grid grid-cols-2 gap-2">
            {BODY_AREAS.map(a => {
              const selected = responses.bodyFocus.includes(a.id);
              return (
                <button key={a.id} onClick={() => toggleMulti('bodyFocus', a.id)}
                  className={`px-4 py-3 rounded-lg border transition-all text-sm font-medium ${selected ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-card border-border/50 hover:bg-secondary/50 text-foreground'}`}>
                  {a.label}
                </button>
              );
            })}
          </div>
        );
      case 2:
        return (
          <div className="space-y-2">
            {EXPERIENCE_OPTIONS.map(o => {
              const selected = responses.experience === o.id;
              return (
                <button key={o.id} onClick={() => setSingle('experience', o.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${selected ? 'bg-primary/10 border-primary/40' : 'bg-card border-border/50 hover:bg-secondary/50'}`}>
                  <span className="text-sm font-medium block">{o.label}</span>
                  <span className="text-xs text-muted-foreground">{o.description}</span>
                </button>
              );
            })}
          </div>
        );
      case 3:
        return (
          <>
          <div className="grid grid-cols-2 gap-2">
            {healthConcerns.map(c => {
              const selected = responses.healthConcerns.includes(c.id);
              return (
                <button key={c.id} onClick={() => toggleMulti('healthConcerns', c.id)}
                  className={`px-3 py-2.5 rounded-lg border transition-all text-xs font-medium ${selected ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-card border-border/50 hover:bg-secondary/50 text-foreground'}`}>
                  {c.label}
                </button>
              );
            })}
            <button
              onClick={() => setShowCustomInput(!showCustomInput)}
              className={`px-3 py-2.5 rounded-lg border transition-all text-xs font-medium flex items-center justify-center gap-1 ${showCustomInput ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-card border-border/50 hover:bg-secondary/50 text-foreground'}`}>
              <PlusCircle className="w-3.5 h-3.5" /> Other
            </button>
          </div>
          {showCustomInput && (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={customConcern}
                onChange={e => setCustomConcern(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && customConcern.trim()) {
                    const id = `custom_${customConcern.trim().toLowerCase().replace(/\s+/g, '_')}`;
                    if (!responses.healthConcerns.includes(id)) {
                      toggleMulti('healthConcerns', id);
                    }
                    setCustomConcern('');
                  }
                }}
                placeholder="Type your health concern and press Enter..."
                autoFocus
                className="w-full px-3 py-2 rounded-lg border border-border/50 bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
              />
              {responses.healthConcerns
                .filter(c => c.startsWith('custom_'))
                .map(c => (
                  <div key={c} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/30">
                    <span className="text-xs text-primary font-medium flex-1">{c.replace('custom_', '').replace(/_/g, ' ')}</span>
                    <button onClick={() => toggleMulti('healthConcerns', c)} className="text-muted-foreground hover:text-destructive">
                      <PlusCircle className="w-3 h-3 rotate-45" />
                    </button>
                  </div>
                ))}
            </div>
          )}
          </>
        );
      case 4:
        return (
          <div className="space-y-2">
            {TIMELINE_OPTIONS.map(t => {
              const selected = responses.timeline === t.id;
              return (
                <button key={t.id} onClick={() => setSingle('timeline', t.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${selected ? 'bg-primary/10 border-primary/40' : 'bg-card border-border/50 hover:bg-secondary/50'}`}>
                  <span className="text-sm font-medium block">{t.label}</span>
                  <span className="text-xs text-muted-foreground">{t.description}</span>
                </button>
              );
            })}
          </div>
        );
      case 5:
        return (
          <div className="grid grid-cols-1 gap-2">
            {TRACKING_PREFS.map(p => {
              const Icon = p.icon;
              const selected = responses.trackingPreferences.includes(p.id);
              return (
                <button key={p.id} onClick={() => toggleMulti('trackingPreferences', p.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left text-sm font-medium ${selected ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-card border-border/50 hover:bg-secondary/50 text-foreground'}`}>
                  <Icon className={`w-4 h-4 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                  {p.label}
                </button>
              );
            })}
          </div>
        );
      case 6:
        return (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground mb-3">Enter any current numbers you know, or mark as N/A. These become your baseline for tracking progress.</p>
            {baselineMetrics.map(m => {
              const isNA = responses.currentMetrics[m.key] === 'N/A';
              return (
                <div key={m.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-muted-foreground">{m.label}</label>
                    <button
                      onClick={() => setMetric(m.key, isNA ? '' : 'N/A')}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-all ${isNA ? 'bg-muted border-border text-foreground font-medium' : 'border-border/30 text-muted-foreground/60 hover:text-muted-foreground hover:border-border/50'}`}
                    >
                      {isNA ? '✓ N/A' : "Don't know"}
                    </button>
                  </div>
                  {!isNA && (
                    <input
                      type="text"
                      value={responses.currentMetrics[m.key] || ''}
                      onChange={e => setMetric(m.key, e.target.value)}
                      placeholder={m.placeholder}
                      className="w-full px-3 py-2 rounded-lg border border-border/50 bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 mb-2">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : i < step ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-border'}`} />
        ))}
      </div>

      <div className="text-center mb-4">
        <h2 className="text-lg font-bold text-foreground">{STEPS[step].title}</h2>
        <p className="text-sm text-muted-foreground">{STEPS[step].subtitle}</p>
      </div>

      <div className="max-h-[50vh] overflow-y-auto pb-2 scrollbar-thin">
        {renderStep()}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={prev} disabled={step === 0}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={next} disabled={!canProceed()}
          className="flex items-center gap-1 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 transition-all hover:opacity-90">
          {step === STEPS.length - 1 ? (
            <>
              <ChevronRight className="w-4 h-4" /> Refine Goals with AI
            </>
          ) : (
            <>
              Next <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default GoalInterview;
