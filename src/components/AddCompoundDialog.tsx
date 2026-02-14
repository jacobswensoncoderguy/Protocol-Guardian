import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Compound, CompoundCategory } from '@/data/compounds';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, ArrowLeft, Loader2, ChevronRight } from 'lucide-react';

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

interface FormState {
  currentQuantity: string;
  unitSize: string;
  unitPrice: string;
  kitPrice: string;
  dosePerUse: string;
  dosesPerDay: string;
  daysPerWeek: string;
  timingNote: string;
  bacstatPerVial: string;
  reconVolume: string;
  cycleOnDays: string;
  cycleOffDays: string;
  cycleStartDate: string;
  reorderQuantity: string;
  notes: string;
}

interface AddCompoundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCompoundIds: string[];
  onAdd: (compound: Compound) => void;
}

const AddCompoundDialog = ({ open, onOpenChange, existingCompoundIds, onAdd }: AddCompoundDialogProps) => {
  const [library, setLibrary] = useState<LibraryCompound[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LibraryCompound | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    async function fetch() {
      setLoading(true);
      const { data, error } = await supabase.from('compounds').select('*').order('name');
      if (!error && data) setLibrary(data as LibraryCompound[]);
      setLoading(false);
    }
    fetch();
  }, [open]);

  // Filter out already-added compounds by name
  const existingNames = useMemo(() => new Set(existingCompoundIds), [existingCompoundIds]);

  const available = useMemo(() => {
    return library.filter(c => !existingNames.has(c.name));
  }, [library, existingNames]);

  const filtered = useMemo(() => {
    if (!search) return available;
    const q = search.toLowerCase();
    return available.filter(c => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [available, search]);

  const grouped = categoryOrder
    .map(cat => ({ category: cat, items: filtered.filter(c => c.category === cat) }))
    .filter(g => g.items.length > 0);

  const selectCompound = (c: LibraryCompound) => {
    setSelected(c);
    const isPeptide = c.category === 'peptide';
    setForm({
      currentQuantity: c.current_quantity.toString(),
      unitSize: c.unit_size.toString(),
      unitPrice: c.unit_price.toString(),
      kitPrice: (c.kit_price || 0).toString(),
      dosePerUse: c.dose_per_use.toString(),
      dosesPerDay: c.doses_per_day.toString(),
      daysPerWeek: c.days_per_week.toString(),
      timingNote: c.timing_note || '',
      bacstatPerVial: (c.bacstat_per_vial || (isPeptide ? 200 : 0)).toString(),
      reconVolume: (c.recon_volume || (isPeptide ? 2 : 0)).toString(),
      cycleOnDays: (c.cycle_on_days || '').toString(),
      cycleOffDays: (c.cycle_off_days || '').toString(),
      cycleStartDate: c.cycle_start_date || new Date().toISOString().split('T')[0],
      reorderQuantity: c.reorder_quantity.toString(),
      notes: c.notes || '',
    });
  };

  const goBack = () => {
    setSelected(null);
    setForm(null);
  };

  const handleSave = () => {
    if (!selected || !form) return;
    const isPeptide = selected.category === 'peptide';

    const qty = parseFloat(form.currentQuantity);
    const size = parseFloat(form.unitSize);
    const dose = parseFloat(form.dosePerUse);
    const price = parseFloat(form.unitPrice);
    const kit = parseFloat(form.kitPrice);
    const dpd = parseFloat(form.dosesPerDay);
    const dpw = parseFloat(form.daysPerWeek);
    const reorder = parseInt(form.reorderQuantity);

    if ([qty, size, dose, price, dpd, dpw, reorder].some(v => isNaN(v) || v < 0)) return;
    if (isPeptide && (isNaN(kit) || kit < 0)) return;

    const compound: Compound = {
      id: selected.id,
      name: selected.name,
      category: selected.category as CompoundCategory,
      unitSize: size,
      unitLabel: selected.unit_label,
      unitPrice: price,
      kitPrice: isPeptide ? kit : undefined,
      dosePerUse: dose,
      doseLabel: selected.dose_label,
      bacstatPerVial: isPeptide ? parseFloat(form.bacstatPerVial) || 200 : undefined,
      reconVolume: isPeptide ? parseFloat(form.reconVolume) || 2 : undefined,
      dosesPerDay: dpd,
      daysPerWeek: dpw,
      timingNote: form.timingNote || undefined,
      cyclingNote: selected.cycling_note || undefined,
      currentQuantity: qty,
      purchaseDate: '',
      reorderQuantity: reorder,
      notes: form.notes || undefined,
      cycleOnDays: form.cycleOnDays ? parseInt(form.cycleOnDays) || undefined : undefined,
      cycleOffDays: form.cycleOffDays ? parseInt(form.cycleOffDays) || undefined : undefined,
      cycleStartDate: form.cycleStartDate || undefined,
    };

    setSaving(true);
    onAdd(compound);
    setSaving(false);
    setSelected(null);
    setForm(null);
    setSearch('');
    onOpenChange(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelected(null);
      setForm(null);
      setSearch('');
    }
    onOpenChange(open);
  };

  const isPeptide = selected?.category === 'peptide';
  const isOil = selected?.category === 'injectable-oil';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            {selected ? (
              <>
                <button onClick={goBack} className="p-1 rounded hover:bg-secondary transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span>Configure {selected.name}</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 text-primary" />
                Add from Library
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          // Pick list view
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="relative mb-3 sticky top-0 bg-background pt-1 pb-2 z-10">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search compounds..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-secondary border border-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {available.length === 0 ? 'All compounds are already in your protocol!' : 'No matching compounds found.'}
              </p>
            ) : (
              <div className="space-y-3">
                {grouped.map(group => (
                  <div key={group.category}>
                    <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      {categoryLabels[group.category]}
                    </h4>
                    <div className="space-y-1">
                      {group.items.map(c => (
                        <button
                          key={c.id}
                          onClick={() => selectCompound(c)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50 bg-card hover:bg-secondary/50 transition-all text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-foreground">{c.name}</span>
                            {c.timing_note && (
                              <p className="text-[10px] text-muted-foreground truncate">{c.timing_note}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {c.dose_per_use} {c.dose_label}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Configuration form
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <p className="text-[11px] text-muted-foreground mb-3">
              Customize the defaults below for your protocol, then save.
            </p>

            <div className="space-y-2.5">
              <SectionLabel>Inventory</SectionLabel>
              <FormRow label={isPeptide ? 'Vials on Hand' : 'Qty on Hand'} value={form!.currentQuantity}
                onChange={v => setForm(f => f ? { ...f, currentQuantity: v } : f)} type="number" />
              <FormRow label="Unit Size" value={form!.unitSize} suffix={isPeptide ? 'mg/vial' : selected.unit_label}
                onChange={v => setForm(f => f ? { ...f, unitSize: v } : f)} type="number" />
              <FormRow label={isPeptide ? 'Reorder (kits)' : 'Reorder Qty'} value={form!.reorderQuantity}
                onChange={v => setForm(f => f ? { ...f, reorderQuantity: v } : f)} type="number" />

              <SectionLabel>Dosing</SectionLabel>
              <FormRow label="Dose/Use" value={form!.dosePerUse} suffix={selected.dose_label}
                onChange={v => setForm(f => f ? { ...f, dosePerUse: v } : f)} type="number" />
              <FormRow label="Doses/Day" value={form!.dosesPerDay}
                onChange={v => setForm(f => f ? { ...f, dosesPerDay: v } : f)} type="number" />
              <FormRow label="Days/Week" value={form!.daysPerWeek}
                onChange={v => setForm(f => f ? { ...f, daysPerWeek: v } : f)} type="number" />
              <FormRow label="Timing" value={form!.timingNote}
                onChange={v => setForm(f => f ? { ...f, timingNote: v } : f)} type="text" />

              {isPeptide && (
                <>
                  <SectionLabel>Reconstitution</SectionLabel>
                  <FormRow label="BAC Water" value={form!.bacstatPerVial} suffix="IU/vial"
                    onChange={v => setForm(f => f ? { ...f, bacstatPerVial: v } : f)} type="number" />
                  <FormRow label="Volume" value={form!.reconVolume} suffix="mL"
                    onChange={v => setForm(f => f ? { ...f, reconVolume: v } : f)} type="number" />
                </>
              )}

              <SectionLabel>Pricing</SectionLabel>
              {isPeptide ? (
                <FormRow label="Kit Price" value={form!.kitPrice} prefix="$" suffix="/kit (10 vials)"
                  onChange={v => setForm(f => f ? { ...f, kitPrice: v } : f)} type="number" />
              ) : (
                <FormRow label="Unit Price" value={form!.unitPrice} prefix="$" suffix={`/${isOil ? 'vial' : 'bottle'}`}
                  onChange={v => setForm(f => f ? { ...f, unitPrice: v } : f)} type="number" />
              )}

              <SectionLabel>Cycling (optional)</SectionLabel>
              <FormRow label="Days ON" value={form!.cycleOnDays}
                onChange={v => setForm(f => f ? { ...f, cycleOnDays: v } : f)} type="number" placeholder="e.g. 42" />
              <FormRow label="Days OFF" value={form!.cycleOffDays}
                onChange={v => setForm(f => f ? { ...f, cycleOffDays: v } : f)} type="number" placeholder="e.g. 21" />
              {(form!.cycleOnDays && form!.cycleOffDays) && (
                <FormRow label="Cycle Start" value={form!.cycleStartDate}
                  onChange={v => setForm(f => f ? { ...f, cycleStartDate: v } : f)} type="date" />
              )}

              <SectionLabel>Notes (optional)</SectionLabel>
              <textarea
                value={form!.notes}
                onChange={e => setForm(f => f ? { ...f, notes: e.target.value } : f)}
                placeholder="Any notes about this compound..."
                className="w-full bg-secondary border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none h-16"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full mt-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add to Protocol
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// --- Helpers ---

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-semibold text-primary uppercase tracking-wider pt-2 border-t border-border/30">
    {children}
  </p>
);

const FormRow = ({ label, value, onChange, type, prefix, suffix, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type: string;
  prefix?: string; suffix?: string; placeholder?: string;
}) => (
  <div className="flex items-center gap-2 text-[11px]">
    <span className="text-muted-foreground w-20 flex-shrink-0 text-right">{label}</span>
    <div className="flex items-center gap-1 flex-1">
      {prefix && <span className="text-muted-foreground">{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-secondary border border-border/50 rounded px-2 py-1.5 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
      {suffix && <span className="text-muted-foreground text-[10px] whitespace-nowrap">{suffix}</span>}
    </div>
  </div>
);

export default AddCompoundDialog;
