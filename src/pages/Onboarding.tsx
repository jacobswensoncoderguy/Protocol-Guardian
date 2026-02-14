import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CheckCircle, Circle, Loader2, Zap } from 'lucide-react';

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

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const { user } = useAuth();
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

  const toggleCompound = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === library.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(library.map(c => c.id)));
    }
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
    .map(cat => ({
      category: cat,
      items: library.filter(c => c.category === cat),
    }))
    .filter(g => g.items.length > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-4 py-4">
        <div className="container mx-auto max-w-lg">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold">
              <span className="text-gradient-cyan">Build Your Protocol</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Select the compounds you want to track. You can add or remove them later.
          </p>
        </div>
      </header>

      <main className="container mx-auto max-w-lg px-4 py-4 pb-24">
        <button
          onClick={selectAll}
          className="text-xs text-primary mb-3 hover:underline"
        >
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
      </main>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border/50 px-4 py-3">
        <div className="container mx-auto max-w-lg">
          <button
            onClick={handleSave}
            disabled={selected.size === 0 || saving}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                Start Tracking {selected.size > 0 && `(${selected.size})`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
