import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGoals } from '@/hooks/useGoals';
import { useProfile } from '@/hooks/useProfile';
import { CheckCircle, Circle, Loader2, Zap, Target, ArrowLeft, User } from 'lucide-react';
import GoalInterview, { OnboardingResponse } from '@/components/GoalInterview';
import GoalAIChat, { ExtractedGoal } from '@/components/GoalAIChat';
import bodyMaleImg from '@/assets/body-male.jpeg';
import bodyFemaleImg from '@/assets/body-female.jpeg';

interface LibraryCompound {
  id: string;
  name: string;
  category: string;
  unit_size: number;
  unit_label: string;
  unit_price: number;
  kit_price: number | null;
  dose_per_use: number;
  dose_label: string;
  bacstat_per_vial: number | null;
  recon_volume: number | null;
  doses_per_day: number;
  days_per_week: number;
  timing_note: string | null;
  cycling_note: string | null;
  cycle_on_days: number | null;
  cycle_off_days: number | null;
  cycle_start_date: string | null;
  current_quantity: number;
  purchase_date: string | null;
  reorder_quantity: number;
  notes: string | null;
}

const categoryLabels: Record<string, string> = {
  peptide: 'Peptides',
  'injectable-oil': 'Injectable Oils',
  oral: 'Oral Supplements',
  powder: 'Powders',
};

const categoryOrder = ['peptide', 'injectable-oil', 'oral', 'powder'];

type OnboardingPhase = 'gender' | 'goals' | 'ai-chat' | 'compounds';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const { user } = useAuth();
  const { createGoals, saveOnboarding } = useGoals(user?.id);
  const { updateProfile } = useProfile(user?.id);
  const [phase, setPhase] = useState<OnboardingPhase>('gender');
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [interviewResponses, setInterviewResponses] = useState<OnboardingResponse | null>(null);
  const [library, setLibrary] = useState<LibraryCompound[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchLibrary() {
      const { data, error } = await supabase
        .from('compounds')
        .select('*')
        .order('name');
      if (!error && data) {
        setLibrary(data as LibraryCompound[]);
      }
      setLoading(false);
    }
    fetchLibrary();
  }, []);

  const handleGenderSelect = async (gender: string) => {
    setSelectedGender(gender);
    await updateProfile({ gender });
    setPhase('goals');
  };

  const handleInterviewComplete = (responses: OnboardingResponse) => {
    setInterviewResponses(responses);
    setPhase('ai-chat');
  };

  const handleGoalsExtracted = async (goals: ExtractedGoal[]) => {
    await createGoals(goals);
    if (interviewResponses) {
      await saveOnboarding(interviewResponses as unknown as Record<string, unknown>);
    }
    setPhase('compounds');
  };

  const handleSkipAI = async () => {
    // Create basic goals from structured responses
    if (interviewResponses) {
      const basicGoals = interviewResponses.primaryGoals.map((gt, i) => ({
        goal_type: gt,
        title: gt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        priority: i < 2 ? 1 : 2,
      }));
      await createGoals(basicGoals);
      await saveOnboarding(interviewResponses as unknown as Record<string, unknown>);
    }
    setPhase('compounds');
  };

  const toggleCompound = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === library.length) setSelected(new Set());
    else setSelected(new Set(library.map(c => c.id)));
  };

  const handleSave = async () => {
    if (!user || selected.size === 0) return;
    setSaving(true);

    const rows = library
      .filter(c => selected.has(c.id))
      .map(c => ({
        user_id: user.id,
        compound_id: c.id,
        name: c.name,
        category: c.category,
        unit_size: c.unit_size,
        unit_label: c.unit_label,
        unit_price: c.unit_price,
        kit_price: c.kit_price,
        dose_per_use: c.dose_per_use,
        dose_label: c.dose_label,
        bacstat_per_vial: c.bacstat_per_vial,
        recon_volume: c.recon_volume,
        doses_per_day: c.doses_per_day,
        days_per_week: c.days_per_week,
        timing_note: c.timing_note,
        cycling_note: c.cycling_note,
        cycle_on_days: c.cycle_on_days,
        cycle_off_days: c.cycle_off_days,
        cycle_start_date: c.cycle_start_date,
        current_quantity: c.current_quantity,
        purchase_date: c.purchase_date,
        reorder_quantity: c.reorder_quantity,
        notes: c.notes,
      }));

    const { error } = await supabase.from('user_compounds').insert(rows);
    if (error) {
      console.error('Failed to save compounds:', error);
      setSaving(false);
      return;
    }
    onComplete();
  };

  const grouped = categoryOrder
    .map(cat => ({ category: cat, items: library.filter(c => c.category === cat) }))
    .filter(g => g.items.length > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Phase indicators
  const phases = [
    { key: 'gender', label: 'Profile', icon: User },
    { key: 'goals', label: 'Goals', icon: Target },
    { key: 'ai-chat', label: 'Refine', icon: Zap },
    { key: 'compounds', label: 'Protocol', icon: CheckCircle },
  ];
  const phaseIndex = phases.findIndex(p => p.key === phase);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-4 py-4">
        <div className="container mx-auto max-w-lg">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold">
              <span className="text-gradient-cyan">SUPERHUMAN</span>
              <span className="text-muted-foreground font-medium ml-1.5">Setup</span>
            </h1>
          </div>

          {/* Phase progress */}
          <div className="flex items-center gap-2">
            {phases.map((p, i) => {
              const Icon = p.icon;
              const isActive = i === phaseIndex;
              const isDone = i < phaseIndex;
              return (
                <div key={p.key} className="flex items-center gap-1.5 flex-1">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                    isActive ? 'bg-primary/15 text-primary' : isDone ? 'text-primary/60' : 'text-muted-foreground/40'
                  }`}>
                    <Icon className="w-3.5 h-3.5" />
                    {p.label}
                  </div>
                  {i < phases.length - 1 && (
                    <div className={`flex-1 h-px ${isDone ? 'bg-primary/40' : 'bg-border/30'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-lg px-4 py-4 pb-24">
        {phase === 'gender' && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-foreground">Select Your Profile</h2>
              <p className="text-sm text-muted-foreground">This personalizes your protocol coverage analysis</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'male', label: 'Male', img: bodyMaleImg },
                { id: 'female', label: 'Female', img: bodyFemaleImg },
              ].map(option => (
                <button
                  key={option.id}
                  onClick={() => handleGenderSelect(option.id)}
                  className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all hover:border-primary/50 ${
                    selectedGender === option.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border/50 bg-card'
                  }`}
                >
                  <div className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-secondary/30">
                    <img src={option.img} alt={option.label} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'goals' && (
          <GoalInterview onComplete={handleInterviewComplete} />
        )}

        {phase === 'ai-chat' && interviewResponses && (
          <GoalAIChat
            structuredResponses={interviewResponses}
            onGoalsExtracted={handleGoalsExtracted}
            onSkip={handleSkipAI}
          />
        )}

        {phase === 'compounds' && (
          <>
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-foreground">Build Your Protocol</h2>
              <p className="text-sm text-muted-foreground">Select compounds to track. You can add or remove them later.</p>
            </div>

            <button onClick={selectAll} className="text-xs text-primary mb-3 hover:underline">
              {selected.size === library.length ? 'Deselect All' : 'Select All'}
            </button>

            <div className="space-y-4">
              {grouped.map(group => (
                <div key={group.category}>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    {categoryLabels[group.category] || group.category}
                  </h3>
                  <div className="space-y-1">
                    {group.items.map(compound => (
                      <button
                        key={compound.id}
                        onClick={() => toggleCompound(compound.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                          selected.has(compound.id)
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-card border-border/50 hover:bg-secondary/50'
                        }`}
                      >
                        {selected.has(compound.id) ? (
                          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-foreground">{compound.name}</span>
                          {compound.timing_note && (
                            <p className="text-[10px] text-muted-foreground truncate">{compound.timing_note}</p>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {compound.dose_per_use} {compound.dose_label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Fixed bottom bar for compounds phase */}
      {phase === 'compounds' && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border/50 px-4 py-3">
          <div className="container mx-auto max-w-lg">
            <button
              onClick={handleSave}
              disabled={selected.size === 0 || saving}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Setting up...</>
              ) : (
                <>Start Tracking {selected.size > 0 && `(${selected.size})`}</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Onboarding;
