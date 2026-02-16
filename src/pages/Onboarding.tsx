import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGoals } from '@/hooks/useGoals';
import { useProfile } from '@/hooks/useProfile';
import { CheckCircle, Circle, Loader2, Zap, Target, User, ChevronDown, ChevronRight, Plus } from 'lucide-react';
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
  prescription: 'Prescription Medications',
  holistic: 'Holistic Compounds',
  'essential-oil': 'Essential Oils',
  'alternative-medicine': 'Alternative Medicines',
  vitamin: 'Vitamins & Minerals',
  adaptogen: 'Adaptogens',
  probiotic: 'Probiotics & Gut Health',
  nootropic: 'Nootropics',
  topical: 'Topicals & Creams',
};

const categoryOrder = [
  'peptide', 'injectable-oil', 'oral', 'powder',
  'prescription', 'holistic', 'essential-oil', 'alternative-medicine',
  'vitamin', 'adaptogen', 'probiotic', 'nootropic', 'topical',
];

const categoryDescriptions: Record<string, string> = {
  peptide: 'Injectable peptides for recovery, growth, and optimization',
  'injectable-oil': 'Hormone and therapeutic injectable compounds',
  oral: 'Oral supplements, capsules, and tablets',
  powder: 'Powdered supplements and drink mixes',
  prescription: 'Doctor-prescribed medications and treatments',
  holistic: 'Natural whole-body wellness compounds',
  'essential-oil': 'Therapeutic aromatherapy and topical oils',
  'alternative-medicine': 'Traditional and complementary medicine compounds',
  vitamin: 'Essential vitamins and mineral supplements',
  adaptogen: 'Stress-modulating herbs and compounds',
  probiotic: 'Gut health and microbiome support',
  nootropic: 'Cognitive enhancers and brain health supplements',
  topical: 'Creams, gels, and transdermal applications',
};

type OnboardingPhase = 'gender' | 'goals' | 'ai-chat' | 'compounds';

interface OnboardingProps {
  onComplete: () => void;
}

interface CustomCompoundForm {
  name: string;
  category: string;
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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [addingCustom, setAddingCustom] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');

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

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleAddCustomCompound = (category: string) => {
    if (!customName.trim()) return;
    const customId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newCompound: LibraryCompound = {
      id: customId,
      name: customName.trim(),
      category,
      unit_size: 1,
      unit_label: category === 'peptide' ? 'mg vial' : category === 'oral' ? 'caps' : 'units',
      unit_price: 0,
      kit_price: null,
      dose_per_use: 1,
      dose_label: category === 'peptide' ? 'IU' : 'caps',
      bacstat_per_vial: category === 'peptide' ? 200 : null,
      recon_volume: category === 'peptide' ? 2 : null,
      doses_per_day: 1,
      days_per_week: 7,
      timing_note: null,
      cycling_note: null,
      cycle_on_days: null,
      cycle_off_days: null,
      cycle_start_date: null,
      current_quantity: 1,
      purchase_date: null,
      reorder_quantity: 1,
      notes: null,
    };
    setLibrary(prev => [...prev, newCompound]);
    setSelected(prev => new Set(prev).add(customId));
    setCustomName('');
    setAddingCustom(null);
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

  // Group compounds by category - include all categories even if empty
  const grouped = categoryOrder.map(cat => ({
    category: cat,
    items: library.filter(c => c.category === cat),
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

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
          <GoalInterview onComplete={handleInterviewComplete} gender={selectedGender} />
        )}

        {phase === 'ai-chat' && interviewResponses && (
          <GoalAIChat
            structuredResponses={interviewResponses}
            onGoalsExtracted={handleGoalsExtracted}
            onSkip={handleSkipAI}
            gender={selectedGender}
          />
        )}

        {phase === 'compounds' && (
          <>
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-foreground">Build Your Protocol</h2>
              <p className="text-sm text-muted-foreground">Tap a category to expand. Select compounds or add your own.</p>
            </div>

            <div className="space-y-2">
              {grouped.map(group => {
                const isExpanded = expandedCategories.has(group.category);
                const selectedCount = group.items.filter(c => selected.has(c.id)).length;
                const hasItems = group.items.length > 0;

                return (
                  <div key={group.category} className="border border-border/50 rounded-lg overflow-hidden">
                    {/* Category header */}
                    <button
                      onClick={() => toggleCategory(group.category)}
                      className="w-full flex items-center justify-between px-3 py-3 bg-card hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        <div className="text-left min-w-0">
                          <span className="text-sm font-semibold text-foreground block">{categoryLabels[group.category]}</span>
                          <span className="text-[10px] text-muted-foreground">{categoryDescriptions[group.category]}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {selectedCount > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                            {selectedCount}
                          </span>
                        )}
                        {hasItems && (
                          <span className="text-[10px] text-muted-foreground">{group.items.length}</span>
                        )}
                      </div>
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-border/30 px-2 py-2 space-y-1">
                        {hasItems && (
                          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider px-1 mb-1 font-semibold">
                            Suggested Compounds
                          </p>
                        )}
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

                        {/* Add custom compound */}
                        {addingCustom === group.category ? (
                          <div className="flex items-center gap-2 px-2 py-1.5">
                            <input
                              type="text"
                              value={customName}
                              onChange={e => setCustomName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleAddCustomCompound(group.category)}
                              placeholder="Compound name..."
                              autoFocus
                              className="flex-1 px-2 py-1.5 rounded-md border border-border/50 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                            />
                            <button
                              onClick={() => handleAddCustomCompound(group.category)}
                              disabled={!customName.trim()}
                              className="px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => { setAddingCustom(null); setCustomName(''); }}
                              className="px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAddingCustom(group.category); setCustomName(''); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors text-left"
                          >
                            <Plus className="w-4 h-4" />
                            <span className="text-xs">Add custom {categoryLabels[group.category]?.toLowerCase() || 'compound'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

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
