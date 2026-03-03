import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Compound, CompoundCategory } from '@/data/compounds';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, ArrowLeft, Loader2, ChevronRight, PenLine, ArrowUp, Sparkles, Calculator } from 'lucide-react';
import { searchCompoundLibrary, LibraryEntry, COMPOUND_LIBRARY } from '@/data/compoundLibrary';
import CompoundingCalculator from '@/components/CompoundingCalculator';
import DatePickerInput from '@/components/DatePickerInput';

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
  purchase_date: string | null;
}

const categoryLabels: Record<string, string> = {
  peptide: 'Peptides',
  'injectable-oil': 'Injectable Oils',
  oral: 'Oral Supplements',
  powder: 'Powders',
  prescription: 'Prescription',
  vitamin: 'Vitamins',
  holistic: 'Holistic',
  adaptogen: 'Adaptogens',
  nootropic: 'Nootropics',
  'essential-oil': 'Essential Oils',
  'alternative-medicine': 'Alternative Medicine',
  probiotic: 'Probiotics',
  topical: 'Topical',
};

const categoryOrder = ['peptide', 'injectable-oil', 'prescription', 'oral', 'powder', 'vitamin', 'holistic', 'adaptogen', 'nootropic', 'essential-oil', 'alternative-medicine', 'probiotic', 'topical'];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface FormState {
  currentQuantity: string;
  unitSize: string;
  unitPrice: string;
  kitPrice: string;
  dosePerUse: string;
  dosesPerDay: string;
  daysPerWeek: string;
  selectedDays: number[];
  timingNote: string;
  bacstatPerVial: string;
  reconVolume: string;
  cycleOnDays: string;
  cycleOffDays: string;
  cycleStartDate: string;
  reorderQuantity: string;
  reorderType: string;
  notes: string;
  vialSizeMl: string;
  purchaseDate: string;
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
  const [view, setView] = useState<'list' | 'custom' | 'configure'>('list');
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<string>('oral');
  const [customUnitLabel, setCustomUnitLabel] = useState('cap');
  const [customDoseLabel, setCustomDoseLabel] = useState('cap');
  const [showCalculator, setShowCalculator] = useState(false);

  // Library search results from the local comprehensive database
  const [libraryResults, setLibraryResults] = useState<LibraryEntry[]>([]);
  const [selectedLibraryEntry, setSelectedLibraryEntry] = useState<LibraryEntry | null>(null);

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

  // Search the comprehensive library when custom name changes
  useEffect(() => {
    if (view === 'custom' && customName.length >= 2) {
      const results = searchCompoundLibrary(customName, 8);
      // Filter out compounds already in protocol
      setLibraryResults(results.filter(r => !existingNames.has(r.name)));
    } else {
      setLibraryResults([]);
    }
  }, [customName, view, existingNames]);

  const selectLibraryEntry = (entry: LibraryEntry) => {
    setSelectedLibraryEntry(entry);
    setCustomName(entry.name);
    setCustomCategory(entry.category);
    if (entry.category === 'peptide') { setCustomUnitLabel('mg vial'); setCustomDoseLabel('IU'); }
    else if (entry.category === 'injectable-oil') { setCustomUnitLabel('mg/mL'); setCustomDoseLabel('mg'); }
    else if (entry.category === 'powder') { setCustomUnitLabel(entry.unitLabel); setCustomDoseLabel(entry.doseLabel); }
    else { setCustomUnitLabel(entry.unitLabel); setCustomDoseLabel(entry.doseLabel); }
    setLibraryResults([]);
  };

  const startCustom = () => {
    setView('custom');
    setSelectedLibraryEntry(null);
  };

  const confirmCustom = () => {
    if (!customName.trim()) return;
    const entry = selectedLibraryEntry;
    const isPeptide = customCategory === 'peptide';
    const isOil = customCategory === 'injectable-oil';

    // If we have a library match, use its data; otherwise use defaults
    setSelected({
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      category: customCategory,
      unit_size: entry?.unitSize ?? (isPeptide ? 10 : 1),
      unit_label: customUnitLabel,
      unit_price: entry?.unitPrice ?? 0,
      kit_price: entry?.kitPrice ?? null,
      dose_per_use: entry?.dosePerUse ?? 0,
      dose_label: customDoseLabel,
      bacstat_per_vial: entry?.bacstatPerVial ?? (isPeptide ? 200 : null),
      recon_volume: entry?.reconVolume ?? (isPeptide ? 2 : null),
      doses_per_day: entry?.dosesPerDay ?? 1,
      days_per_week: entry?.daysPerWeek ?? 7,
      timing_note: entry?.timingNote ?? null,
      cycling_note: null,
      cycle_on_days: entry?.cycleOnDays ?? null,
      cycle_off_days: entry?.cycleOffDays ?? null,
      cycle_start_date: null,
      current_quantity: 0,
      reorder_quantity: 1,
      notes: null,
      purchase_date: null,
    });

    const dpw = entry?.daysPerWeek ?? 7;
    let initDays: number[];
    if (dpw >= 7) initDays = [...ALL_DAYS];
    else if (dpw === 5) initDays = [1, 2, 3, 4, 5];
    else if (dpw === 3) initDays = [1, 3, 5];
    else if (dpw === 2) initDays = [2, 4];
    else if (dpw === 1) initDays = [1];
    else initDays = [...ALL_DAYS];

    setForm({
      currentQuantity: '0',
      unitSize: (entry?.unitSize ?? (isPeptide ? 10 : 1)).toString(),
      unitPrice: (entry?.unitPrice ?? 0).toString(),
      kitPrice: (entry?.kitPrice ?? 0).toString(),
      dosePerUse: (entry?.dosePerUse ?? 0).toString(),
      dosesPerDay: (entry?.dosesPerDay ?? 1).toString(),
      daysPerWeek: dpw.toString(),
      selectedDays: initDays,
      timingNote: entry?.timingNote ?? '',
      bacstatPerVial: (entry?.bacstatPerVial ?? (isPeptide ? 200 : 0)).toString(),
      reconVolume: (entry?.reconVolume ?? (isPeptide ? 2 : 0)).toString(),
      cycleOnDays: entry?.cycleOnDays?.toString() ?? '',
      cycleOffDays: entry?.cycleOffDays?.toString() ?? '',
      cycleStartDate: new Date().toISOString().split('T')[0],
      reorderQuantity: '1',
      reorderType: 'single',
      notes: '',
      vialSizeMl: (entry?.vialSizeMl ?? 10).toString(),
      purchaseDate: '',
    });
    setView('configure');
  };

  const selectCompound = (c: LibraryCompound) => {
    setSelected(c);
    setView('configure');
    const isPeptide = c.category === 'peptide';
    const dpw = c.days_per_week;
    let initDays: number[];
    if (dpw >= 7) initDays = [...ALL_DAYS];
    else if (dpw === 5) initDays = [1, 2, 3, 4, 5];
    else if (dpw === 3) initDays = [1, 3, 5];
    else if (dpw === 2) initDays = [2, 4];
    else if (dpw === 1) initDays = [1];
    else initDays = [...ALL_DAYS];

    setForm({
      currentQuantity: c.current_quantity.toString(),
      unitSize: c.unit_size.toString(),
      unitPrice: c.unit_price.toString(),
      kitPrice: (c.kit_price || 0).toString(),
      dosePerUse: c.dose_per_use.toString(),
      dosesPerDay: c.doses_per_day.toString(),
      daysPerWeek: dpw.toString(),
      selectedDays: initDays,
      timingNote: c.timing_note || '',
      bacstatPerVial: (c.bacstat_per_vial || (isPeptide ? 200 : 0)).toString(),
      reconVolume: (c.recon_volume || (isPeptide ? 2 : 0)).toString(),
      cycleOnDays: (c.cycle_on_days || '').toString(),
      cycleOffDays: (c.cycle_off_days || '').toString(),
      cycleStartDate: c.cycle_start_date || new Date().toISOString().split('T')[0],
      reorderQuantity: c.reorder_quantity.toString(),
      reorderType: 'single',
      notes: c.notes || '',
      vialSizeMl: '10',
      purchaseDate: c.purchase_date || '',
    });
  };

  const goBack = () => {
    if (view === 'configure' && customName) {
      setView('custom');
    } else {
      setView('list');
    }
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

    const isOil = selected.category === 'injectable-oil';
    let timingNote = form.timingNote || undefined;
    if (!timingNote && form.selectedDays.length > 0 && form.selectedDays.length < 7) {
      timingNote = form.selectedDays.map(d => DAY_FULL[d]).join('/');
    }

    const compound: Compound = {
      id: selected.id,
      name: selected.name,
      category: selected.category as CompoundCategory,
      unitSize: size,
      unitLabel: isOil ? 'mg/mL' : selected.unit_label,
      unitPrice: price,
      kitPrice: isPeptide ? kit : undefined,
      vialSizeMl: isOil ? (parseFloat(form.vialSizeMl) || 10) : undefined,
      dosePerUse: dose,
      doseLabel: selected.dose_label,
      bacstatPerVial: isPeptide ? parseFloat(form.bacstatPerVial) || 200 : undefined,
      reconVolume: isPeptide ? parseFloat(form.reconVolume) || 2 : undefined,
      dosesPerDay: dpd,
      daysPerWeek: dpw,
      timingNote,
      cyclingNote: selected.cycling_note || undefined,
      currentQuantity: qty,
      purchaseDate: form.purchaseDate || '',
      reorderQuantity: reorder,
      reorderType: (form.reorderType as 'single' | 'kit') || 'single',
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
    setView('list');
    setCustomName('');
    setCustomCategory('oral');
    setCustomUnitLabel('cap');
    setCustomDoseLabel('cap');
    setSelectedLibraryEntry(null);
    onOpenChange(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelected(null);
      setForm(null);
      setSearch('');
      setView('list');
      setCustomName('');
      setCustomCategory('oral');
      setCustomUnitLabel('cap');
      setCustomDoseLabel('cap');
      setSelectedLibraryEntry(null);
      setLibraryResults([]);
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
            {view === 'configure' && selected ? (
              <>
                <button onClick={goBack} className="p-1 rounded hover:bg-secondary transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span>Configure {selected.name}</span>
              </>
            ) : view === 'custom' ? (
              <>
                <button onClick={() => { setView('list'); setSelectedLibraryEntry(null); setLibraryResults([]); }} className="p-1 rounded hover:bg-secondary transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <PenLine className="w-4 h-4 text-primary" />
                Add New Compound
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 text-primary" />
                Add Compound
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {view === 'list' && (
          <div className="flex-1 overflow-y-auto px-4 pb-4" id="compound-library-scroll">
            <button
              onClick={startCustom}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 mb-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-primary text-sm font-medium"
            >
              <PenLine className="w-4 h-4" />
              Search & Add Any Compound
            </button>

            <div className="relative mb-3 sticky top-0 bg-background pt-1 pb-2 z-10">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search your library..."
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
                    {group.items.length > 3 && (
                      <button
                        onClick={() => document.getElementById('compound-library-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 mt-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ArrowUp className="w-3 h-3" />
                        Back to top
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'custom' && (
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <p className="text-[11px] text-muted-foreground mb-3">
              Start typing to search {COMPOUND_LIBRARY.length}+ compounds. Select a match to auto-fill, or enter a custom name.
            </p>
            <div className="space-y-2.5">
              <div className="relative">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Compound Name</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={customName}
                    onChange={e => { setCustomName(e.target.value); setSelectedLibraryEntry(null); }}
                    placeholder="Search compounds... e.g. BPC, Ashwagandha, Vitamin D"
                    maxLength={100}
                    autoFocus
                    className="w-full pl-8 pr-3 bg-secondary border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                {/* Search results dropdown */}
                {libraryResults.length > 0 && !selectedLibraryEntry && (
                  <div className="absolute z-20 w-full mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                    {libraryResults.map((entry, i) => (
                      <button
                        key={`${entry.name}-${i}`}
                        onClick={() => selectLibraryEntry(entry)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/60 transition-colors text-left border-b border-border/30 last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-foreground">{entry.name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              {categoryLabels[entry.category] || entry.category}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-mono">
                              {entry.dosePerUse} {entry.doseLabel} · {entry.dosesPerDay}x/day
                            </span>
                          </div>
                        </div>
                        <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Show selected library entry info */}
              {selectedLibraryEntry && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-[10px] text-foreground">
                    <span className="font-semibold text-primary">Auto-filled from library</span>
                    <p className="text-muted-foreground mt-0.5">
                      {selectedLibraryEntry.dosePerUse} {selectedLibraryEntry.doseLabel} · {selectedLibraryEntry.dosesPerDay}x/day · {selectedLibraryEntry.daysPerWeek}d/wk
                      {selectedLibraryEntry.timingNote && ` · ${selectedLibraryEntry.timingNote}`}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Category</label>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {categoryOrder.map(cat => (
                    <button
                      key={cat}
                      onClick={() => {
                        setCustomCategory(cat);
                        if (cat === 'peptide') { setCustomUnitLabel('mg vial'); setCustomDoseLabel('IU'); }
                        else if (cat === 'injectable-oil') { setCustomUnitLabel('mg/mL'); setCustomDoseLabel('mg'); }
                        else if (cat === 'powder') { setCustomUnitLabel('g'); setCustomDoseLabel('serving'); }
                        else { setCustomUnitLabel('cap'); setCustomDoseLabel('cap'); }
                      }}
                      className={`px-2.5 py-2 rounded-lg border text-[11px] font-medium transition-all ${
                        customCategory === cat
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'border-border/50 bg-card text-muted-foreground hover:bg-secondary/50'
                      }`}
                    >
                      {categoryLabels[cat]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Unit Label</label>
                  <input
                    type="text"
                    value={customUnitLabel}
                    onChange={e => setCustomUnitLabel(e.target.value)}
                    placeholder="e.g. cap, mL, mg"
                    maxLength={20}
                    className="w-full bg-secondary border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Dose Label</label>
                  <input
                    type="text"
                    value={customDoseLabel}
                    onChange={e => setCustomDoseLabel(e.target.value)}
                    placeholder="e.g. IU, cap, serving"
                    maxLength={20}
                    className="w-full bg-secondary border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={confirmCustom}
              disabled={!customName.trim()}
              className="w-full mt-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ChevronRight className="w-4 h-4" />
              {selectedLibraryEntry ? 'Review & Configure' : 'Configure Dosing & Pricing'}
            </button>
          </div>
        )}

        {view === 'configure' && selected && (
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <p className="text-[11px] text-muted-foreground mb-3">
              {selectedLibraryEntry ? 'Fields pre-filled from library. Verify and adjust for your protocol.' : 'Customize the defaults below for your protocol, then save.'}
            </p>

            <div className="space-y-2.5">
              <SectionLabel>Inventory</SectionLabel>
              <FormRow label={isPeptide ? 'Vials on Hand' : 'Qty on Hand'} value={form!.currentQuantity}
                onChange={v => setForm(f => f ? { ...f, currentQuantity: v } : f)} type="number" />
              <FormRow label={isOil ? 'Conc.' : 'Unit Size'} value={form!.unitSize} suffix={isPeptide ? 'mg/vial' : isOil ? 'mg/mL' : selected.unit_label}
                onChange={v => setForm(f => f ? { ...f, unitSize: v } : f)} type="number" />
              {isOil && (
                <FormRow label="Vial Size" value={form!.vialSizeMl} suffix="mL"
                  onChange={v => setForm(f => f ? { ...f, vialSizeMl: v } : f)} type="number" />
              )}
              <FormRow label="Reorder Qty" value={form!.reorderQuantity}
                onChange={v => setForm(f => f ? { ...f, reorderQuantity: v } : f)} type="number"
                suffix={form!.reorderType === 'kit' ? 'kits' : 'units'} />
              <div className="flex items-center gap-2 text-[11px] px-1">
                <span className="text-muted-foreground font-medium w-20 flex-shrink-0 text-right">Order As</span>
                {(['single', 'kit'] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => f ? { ...f, reorderType: t } : f)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                      form!.reorderType === t
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-secondary text-muted-foreground/40 border border-border/30'
                    }`}>
                    {t === 'single' ? 'Single Unit' : 'Kit'}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Dosing</p>
                <button type="button" onClick={() => setShowCalculator(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-medium transition-colors">
                  <Calculator className="w-3 h-3" /> Calculator
                </button>
              </div>
              <CompoundingCalculator
                open={showCalculator}
                onOpenChange={setShowCalculator}
                onApply={(result) => {
                  if (result.weightPerUnit !== undefined) {
                    // Auto-fill could be extended here if weight fields are added to add form
                  }
                  if (result.concentration !== undefined && result.solventVolume) {
                    setForm(f => f ? { ...f, reconVolume: result.solventVolume!.toString() } : f);
                  }
                }}
              />
              <FormRow label="Dose/Use" value={form!.dosePerUse} suffix={selected.dose_label}
                onChange={v => setForm(f => f ? { ...f, dosePerUse: v } : f)} type="number" />
              <FormRow label="Doses/Day" value={form!.dosesPerDay}
                onChange={v => setForm(f => f ? { ...f, dosesPerDay: v } : f)} type="number" />

              <div className="flex items-start gap-2 text-[11px]">
                <span className="text-muted-foreground w-20 flex-shrink-0 text-right pt-1.5">Days/Week</span>
                <div className="flex-1 space-y-1.5">
                  <button
                    onClick={() => {
                      const isAll = form!.selectedDays.length === 7;
                      const newDays = isAll ? [] : [...ALL_DAYS];
                      setForm(f => f ? { ...f, selectedDays: newDays, daysPerWeek: newDays.length.toString() } : f);
                    }}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                      form!.selectedDays.length === 7
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-secondary text-muted-foreground border border-border/30 hover:bg-secondary/80'
                    }`}
                  >
                    Daily
                  </button>
                  <div className="flex gap-1">
                    {ALL_DAYS.map(d => {
                      const isSelected = form!.selectedDays.includes(d);
                      return (
                        <button
                          key={d}
                          onClick={() => {
                            setForm(f => {
                              if (!f) return f;
                              const next = isSelected
                                ? f.selectedDays.filter(x => x !== d)
                                : [...f.selectedDays, d].sort();
                              return { ...f, selectedDays: next, daysPerWeek: next.length.toString() };
                            });
                          }}
                          className={`w-8 h-8 rounded-md text-[10px] font-semibold transition-all ${
                            isSelected
                              ? 'bg-primary/15 text-primary border border-primary/30'
                              : 'bg-secondary text-muted-foreground/50 border border-border/30 hover:bg-secondary/80'
                          }`}
                          title={DAY_FULL[d]}
                        >
                          {DAY_LABELS[d]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <FormRow label="Timing" value={form!.timingNote}
                onChange={v => setForm(f => f ? { ...f, timingNote: v } : f)} type="text" />
              <FormRow label="Purchased" value={form!.purchaseDate}
                onChange={v => setForm(f => f ? { ...f, purchaseDate: v } : f)} type="date" />

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
              <div className={form!.reorderType === 'kit' ? 'opacity-40 pointer-events-none' : ''}>
                <FormRow label="Unit Price" value={form!.unitPrice} prefix="$" suffix={`/${isPeptide ? 'vial' : isOil ? 'vial' : 'bottle'}`}
                  onChange={v => setForm(f => f ? { ...f, unitPrice: v } : f)} type="number" />
              </div>
              <div className={form!.reorderType === 'single' ? 'opacity-40 pointer-events-none' : ''}>
                <FormRow label="Kit Price" value={form!.kitPrice} prefix="$" suffix={isPeptide ? '/kit (10 vials)' : '/kit'}
                  onChange={v => setForm(f => f ? { ...f, kitPrice: v } : f)} type="number" />
              </div>

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
      {type === 'date' ? (
        <DatePickerInput
          value={value}
          onChange={onChange}
          className="text-[11px] py-1.5"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-secondary border border-border/50 rounded px-2 py-1.5 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      )}
      {suffix && <span className="text-muted-foreground text-[10px] whitespace-nowrap">{suffix}</span>}
    </div>
  </div>
);

export default AddCompoundDialog;
