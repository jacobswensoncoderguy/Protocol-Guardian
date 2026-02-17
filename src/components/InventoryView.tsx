import { useState, useMemo, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Compound, getStatus, getReorderDateString, CompoundCategory, getDaysRemaining } from '@/data/compounds';
import { getCycleStatus, getDaysRemainingWithCycling, isPaused } from '@/lib/cycling';
import { UserProtocol } from '@/hooks/useProtocols';
import { CustomField, CustomFieldValue, PREDEFINED_FIELDS } from '@/hooks/useCustomFields';
import { Pencil, Check, X, Trash2, Plus, ChevronDown, ChevronUp, GripVertical, Syringe, Clock, SortAsc, Moon as MoonIcon, Sun, Dumbbell, RefreshCcw, Package, PlusCircle, AlertTriangle, Pause, Play, Calendar } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ConfirmDialog from '@/components/ConfirmDialog';
import ToleranceSelector from '@/components/ToleranceSelector';
import { ToleranceLevel } from '@/hooks/useProtocolAnalysis';

interface InventoryViewProps {
  compounds: Compound[];
  onUpdateCompound: (id: string, updates: Partial<Compound>) => void;
  onDeleteCompound?: (id: string) => void;
  onAddCompound?: () => void;
  protocols?: UserProtocol[];
  toleranceLevel?: string;
  onToleranceChange?: (level: ToleranceLevel) => void;
  customFields?: CustomField[];
  customFieldValues?: Map<string, Map<string, string>>;
  onAddCustomField?: (field: Partial<CustomField>) => Promise<CustomField | null>;
  onRemoveCustomField?: (fieldId: string) => Promise<void>;
  onReorderCustomField?: (fieldId: string, direction: 'up' | 'down') => Promise<void>;
  onSetCustomFieldValue?: (compoundId: string, fieldId: string, value: string) => Promise<void>;
}

const categoryLabels: Record<string, string> = {
  'peptide': 'Peptides',
  'injectable-oil': 'Injectable Oils',
  'oral': 'Oral Supplements',
  'powder': 'Powders',
  'prescription': 'Prescription',
  'vitamin': 'Vitamins',
  'holistic': 'Holistic',
  'adaptogen': 'Adaptogens',
  'nootropic': 'Nootropics',
  'essential-oil': 'Essential Oils',
  'alternative-medicine': 'Alternative Medicine',
  'probiotic': 'Probiotics',
  'topical': 'Topical',
};

const categoryOrder: string[] = ['peptide', 'injectable-oil', 'prescription', 'oral', 'powder', 'vitamin', 'holistic', 'adaptogen', 'nootropic', 'essential-oil', 'alternative-medicine', 'probiotic', 'topical'];

const InventoryView = ({ compounds, onUpdateCompound, onDeleteCompound, onAddCompound, protocols = [], toleranceLevel, onToleranceChange, customFields = [], customFieldValues = new Map(), onAddCustomField, onRemoveCustomField, onReorderCustomField, onSetCustomFieldValue }: InventoryViewProps) => {
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'days'>('name');
  const [showToleranceConfirm, setShowToleranceConfirm] = useState(false);
  const [pendingTolerance, setPendingTolerance] = useState<ToleranceLevel | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const activeCompounds = compounds.filter(c => !c.notes?.includes('[DORMANT]'));
  const dormantCompounds = compounds.filter(c => c.notes?.includes('[DORMANT]'));

  const scrollToCompound = useCallback((id: string) => {
    setHighlightId(id);
    // Small delay to allow collapsed groups to open
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = cardRefs.current.get(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Clear highlight after animation
        setTimeout(() => setHighlightId(null), 2000);
      }, 100);
    });
  }, []);
  const filtered = filter === 'all' ? activeCompounds : activeCompounds.filter(c => c.category === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'days') return getDaysRemainingWithCycling(a) - getDaysRemainingWithCycling(b);
    return a.name.localeCompare(b.name);
  });

  // Compounds with stock alerts
  const alertCompounds = useMemo(() => {
    return activeCompounds
      .map(c => ({ compound: c, days: getDaysRemainingWithCycling(c), status: getStatus(getDaysRemainingWithCycling(c)) }))
      .filter(a => a.status === 'critical' || a.status === 'warning')
      .sort((a, b) => a.days - b.days);
  }, [activeCompounds]);

  // Build protocol groups + ungrouped by category
  const buildGroups = () => {
    if (sortBy === 'days') return [{ label: 'all', items: sorted }];

    const groups: { label: string; items: Compound[] }[] = [];
    const protocolCompoundIds = new Set<string>();

    // Protocol groups first
    protocols.forEach(p => {
      const pItems = sorted.filter(c => p.compoundIds.includes(c.id));
      if (pItems.length > 0) {
        groups.push({ label: `${p.icon} ${p.name}`, items: pItems });
        pItems.forEach(c => protocolCompoundIds.add(c.id));
      }
    });

    // Then category groups for ungrouped compounds
    categoryOrder.forEach(cat => {
      const items = sorted.filter(c => c.category === cat && !protocolCompoundIds.has(c.id));
      if (items.length > 0) {
        groups.push({ label: categoryLabels[cat], items });
      }
    });

    return groups;
  };

  const groups = buildGroups();

  return (
    <div className="space-y-3">
      {/* Stock Alert Banner */}
      {alertCompounds.length > 0 && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/5 p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-status-warning flex-shrink-0" />
            <span className="text-[11px] font-semibold text-status-warning">
              {alertCompounds.length} compound{alertCompounds.length !== 1 ? 's' : ''} need attention
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {alertCompounds.map(a => (
              <button
                key={a.compound.id}
                onClick={() => scrollToCompound(a.compound.id)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                  a.status === 'critical'
                    ? 'bg-destructive/15 text-status-critical border border-destructive/20 hover:bg-destructive/25'
                    : 'bg-accent/15 text-status-warning border border-accent/20 hover:bg-accent/25'
                }`}
              >
                <Package className="w-2.5 h-2.5" />
                {a.compound.name} — {a.days}d
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Header with tolerance selector */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-foreground">Compounds</h2>
      </div>

      {/* Tolerance selector — full comparison view */}
      {onToleranceChange && (
        <div className="bg-card/60 rounded-lg border border-border/30 p-3 mb-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Dosing Tolerance Level</p>
          <ToleranceSelector
            value={(toleranceLevel || 'moderate') as ToleranceLevel}
            onChange={(level) => {
              setPendingTolerance(level);
              setShowToleranceConfirm(true);
            }}
          />
          <p className="text-[9px] text-muted-foreground/50 mt-1.5">
            Your selection applies across all pages.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-thin -mx-1 px-1">
          {(['all', ...categoryOrder.filter(cat => activeCompounds.some(c => c.category === cat) || dormantCompounds.some(c => c.category === cat))]).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] sm:text-xs transition-all whitespace-nowrap touch-manipulation ${
                filter === cat
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-secondary text-secondary-foreground active:bg-secondary/60'
              }`}
            >
              {cat === 'all' ? 'All' : (categoryLabels[cat] || cat)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSortBy(s => s === 'days' ? 'name' : 'days')}
          className="ml-auto px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] sm:text-xs bg-secondary text-secondary-foreground active:bg-secondary/60 touch-manipulation"
        >
          {sortBy === 'days' ? <><Clock className="w-3 h-3 inline mr-0.5" /> Days</> : <><SortAsc className="w-3 h-3 inline mr-0.5" /> Name</>}
        </button>
      </div>

      {/* Add button */}
      {onAddCompound && (
        <button
          onClick={onAddCompound}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-primary text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Compound from Library
        </button>
      )}

      {/* Compound Cards */}
      {groups.map(group => (
        <Collapsible key={group.label} defaultOpen>
          {group.label !== 'all' && (
            <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left mb-2 group">
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
              <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
              <span className="text-[10px] text-muted-foreground font-mono">({group.items.length})</span>
            </CollapsibleTrigger>
          )}
          <CollapsibleContent className="animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {group.items.map((compound, compoundIdx) => (
                <div
                  key={compound.id}
                  ref={(el) => { if (el) cardRefs.current.set(compound.id, el); else cardRefs.current.delete(compound.id); }}
                  className={`transition-all duration-500 rounded-lg ${highlightId === compound.id ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}`}
                  {...(compoundIdx === 0 && groups.indexOf(group) === 0 ? { 'data-tour': 'compound-card' } : {})}
                >
                  <CompoundCard compound={compound} onUpdate={onUpdateCompound} onDelete={onDeleteCompound} customFields={customFields} customFieldValues={customFieldValues.get(compound.id) || new Map()} onAddCustomField={onAddCustomField} onRemoveCustomField={onRemoveCustomField} onReorderCustomField={onReorderCustomField} onSetCustomFieldValue={onSetCustomFieldValue} />
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}

      {/* Dormant Compounds */}
      {dormantCompounds.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left mb-2 group">
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
            <MoonIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground">Dormant</h3>
            <span className="text-[10px] text-muted-foreground font-mono">({dormantCompounds.length})</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 opacity-60">
              {dormantCompounds.map(compound => (
                <CompoundCard key={compound.id} compound={compound} onUpdate={onUpdateCompound} onDelete={onDeleteCompound} customFields={customFields} customFieldValues={customFieldValues.get(compound.id) || new Map()} onAddCustomField={onAddCustomField} onRemoveCustomField={onRemoveCustomField} onReorderCustomField={onReorderCustomField} onSetCustomFieldValue={onSetCustomFieldValue} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      <ConfirmDialog
        open={showToleranceConfirm}
        onOpenChange={setShowToleranceConfirm}
        title="Confirm Tolerance Level"
        description={`Lock your dosing tolerance to "${pendingTolerance}"? This will update all pages with this tolerance level.`}
        confirmLabel="Lock It In"
        onConfirm={() => {
          if (pendingTolerance && onToleranceChange) {
            onToleranceChange(pendingTolerance);
            toast.success(`Tolerance locked to ${pendingTolerance}`);
          }
          setShowToleranceConfirm(false);
        }}
      />
    </div>
  );
};

// --- Compound Card ---

const CompoundCard = ({ compound, onUpdate, onDelete, customFields = [], customFieldValues = new Map(), onAddCustomField, onRemoveCustomField, onReorderCustomField, onSetCustomFieldValue }: {
  compound: Compound; onUpdate: (id: string, updates: Partial<Compound>) => void; onDelete?: (id: string) => void;
  customFields?: CustomField[]; customFieldValues?: Map<string, string>;
  onAddCustomField?: (field: Partial<CustomField>) => Promise<CustomField | null>;
  onRemoveCustomField?: (fieldId: string) => Promise<void>;
  onReorderCustomField?: (fieldId: string, direction: 'up' | 'down') => Promise<void>;
  onSetCustomFieldValue?: (compoundId: string, fieldId: string, value: string) => Promise<void>;
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDormant, setConfirmDormant] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseDate, setPauseDate] = useState('');
  const [doseUnit, setDoseUnit] = useState<'mg' | 'ml' | 'iu'>('iu');
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<Record<string, string>>({});
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'date'>('text');
  const [newFieldUnit, setNewFieldUnit] = useState('');

  const compoundIsPaused = isPaused(compound);
  const days = getDaysRemainingWithCycling(compound);
  const status = compoundIsPaused ? 'good' as const : getStatus(days);
  const cycleStatus = getCycleStatus(compound);
  const maxDays = 90;
  const progress = Math.min(100, (days / maxDays) * 100);
  const isPeptide = compound.category === 'peptide';
  const isOil = compound.category === 'injectable-oil';
  const reorderDate = getReorderDateString(compound);

  const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  const parseDaysFromNote = (note: string): Set<number> => {
    const lower = note.toLowerCase();
    const days = new Set<number>();

    // Check "daily" / "nightly" / "every day" FIRST — these mean all 7 days
    if (/\bdaily\b|\bnightly\b|\bevery\s*day\b/i.test(lower)) {
      [0,1,2,3,4,5,6].forEach(i => days.add(i));
      return days;
    }

    const patterns: [RegExp, number[]][] = [
      [/\bm[\/-]f\b|mon[\s-]*fri/i, [1,2,3,4,5]],
      [/\bm\/w\/f\b/i, [1,3,5]],
      [/\bt\/th\b/i, [2,4]],
    ];
    for (const [pat, idxs] of patterns) {
      if (pat.test(lower)) { idxs.forEach(i => days.add(i)); return days; }
    }
    const dayMap: Record<string, number> = { su: 0, sun: 0, mo: 1, mon: 1, tu: 2, tue: 2, tues: 2, we: 3, wed: 3, th: 4, thu: 4, thurs: 4, fr: 5, fri: 5, sa: 6, sat: 6 };
    const matches = lower.match(/\b(su(?:n(?:day)?)?|mo(?:n(?:day)?)?|tu(?:e(?:s(?:day)?)?)?|we(?:d(?:nesday)?)?|th(?:u(?:rs(?:day)?)?)?|fr(?:i(?:day)?)?|sa(?:t(?:urday)?)?)\b/gi);
    if (matches) matches.forEach(m => { const i = dayMap[m.toLowerCase()]; if (i !== undefined) days.add(i); });
    if (days.size === 0 && parseInt(editState.daysPerWeek || '0') === 7) {
      [0,1,2,3,4,5,6].forEach(i => days.add(i));
    }
    return days;
  };

  const buildDayString = (days: Set<number>): string => {
    if (days.size === 7) return 'daily';
    if (days.size === 0) return '';
    const sorted = Array.from(days).sort();
    if (sorted.join(',') === '1,2,3,4,5') return 'M-F';
    if (sorted.join(',') === '1,3,5') return 'M/W/F';
    if (sorted.join(',') === '2,4') return 'T/Th';
    return sorted.map(d => DAY_KEYS[d]).join('/');
  };

  const startEdit = () => {
    const hasCycling = !!(compound.cycleOnDays && compound.cycleOnDays > 0 && compound.cycleOffDays && compound.cycleOffDays > 0);
    
    // Determine the stored dose unit from doseLabel
    const dl = compound.doseLabel.toLowerCase();
    let storedUnit: string;
    if (dl.includes('iu')) storedUnit = 'iu';
    else if (dl.includes('mcg') || dl.includes('µg')) storedUnit = 'mcg';
    else if (dl.includes('scoop') || (compound.category === 'powder' && dl.includes('serving'))) storedUnit = 'scoop';
    else if (dl.includes('pill') || dl.includes('cap') || dl.includes('softgel') || dl.includes('tab') || dl.includes('serving')) storedUnit = 'pills';
    else if (dl.includes('ml')) storedUnit = 'ml';
    else storedUnit = compound.category === 'powder' ? 'scoop' : 'mg';

    // Use the stored unit as the edit unit so overview and edit match
    const editDoseUnit = storedUnit;
    let editDose = compound.dosePerUse; // already in stored unit

    const state: Record<string, string> = {
      name: compound.name,
      category: compound.category,
      timing: compound.timingNote || '',
      daysPerWeek: compound.daysPerWeek.toString(),
      currentQuantity: compound.currentQuantity.toString(),
      unitSize: compound.unitSize.toString(),
      dosePerUse: editDose.toString(),
      reorderQuantity: compound.reorderQuantity.toString(),
      reorderType: compound.reorderType || 'single',
      cyclingEnabled: hasCycling ? 'true' : 'false',
      cycleOnDays: (compound.cycleOnDays || 0).toString(),
      cycleOffDays: (compound.cycleOffDays || 0).toString(),
      cycleStartDate: compound.cycleStartDate || '',
      editDoseUnit: editDoseUnit,
      vialSizeMl: (compound.vialSizeMl || 10).toString(),
      unitLabel: compound.unitLabel,
      weightPerUnit: (() => {
        const wpu = compound.weightPerUnit || 0;
        if (wpu === 0) return '';
        if (wpu < 0.1) return (wpu * 1000).toString(); // display as mcg
        if (wpu >= 1000 && wpu % 1000 === 0) return (wpu / 1000).toString(); // display as g
        return wpu.toString(); // display as mg
      })(),
      strengthUnit: (() => {
        const wpu = compound.weightPerUnit || 0;
        if (wpu === 0) return 'mg';
        if (wpu < 0.1) return 'mcg';
        if (wpu >= 1000 && wpu % 1000 === 0) return 'g';
        return 'mg';
      })(),
    };
    if (isPeptide) {
      state.kitPrice = (compound.kitPrice || 0).toString();
      state.unitPrice = compound.unitPrice.toString();
    } else {
      state.unitPrice = compound.unitPrice.toString();
    }
    state.purchaseDate = compound.purchaseDate;
    setEditState(state);
    setEditing(true);
  };

  const saveEdit = () => {
    const qty = parseFloat(editState.currentQuantity);
    const size = parseFloat(editState.unitSize);
    let dose = parseFloat(editState.dosePerUse);
    const reorder = parseInt(editState.reorderQuantity);
    if (isNaN(qty) || isNaN(size) || isNaN(dose) || isNaN(reorder) || qty < 0 || size <= 0 || dose < 0 || reorder < 0) return;

    // Convert dose back from edit unit to stored doseLabel unit
    const eu = editState.editDoseUnit || 'mg';
    const dl = compound.doseLabel.toLowerCase();
    const editCat = editState.category || compound.category;
    let storedUnit: string;
    if (dl.includes('iu')) storedUnit = 'iu';
    else if (dl.includes('mcg') || dl.includes('µg')) storedUnit = 'mcg';
    else if (dl.includes('scoop') || (editCat === 'powder' && dl.includes('serving'))) storedUnit = 'scoop';
    else if (dl.includes('pill') || dl.includes('cap') || dl.includes('softgel') || dl.includes('tab') || dl.includes('serving')) storedUnit = 'pills';
    else if (dl.includes('ml')) storedUnit = 'ml';
    else storedUnit = editCat === 'powder' ? 'scoop' : 'mg';

    // If edit unit matches stored unit, no conversion needed
    if (eu !== storedUnit) {
      const catIsPeptide = editState.category === 'peptide';
      const catIsOil = editState.category === 'injectable-oil';
      const reconVolIU = (compound.reconVolume || 2) * 100;

      // Convert edit value to mg first
      let mgValue = dose;
      if (eu === 'iu') {
        if (catIsPeptide && size > 0) mgValue = (dose / reconVolIU) * size;
        else if (catIsOil && size > 0) mgValue = (dose / 200) * size;
      } else if (eu === 'ml') {
        if (catIsPeptide) mgValue = (dose * 100 / reconVolIU) * size;
        else if (catIsOil) mgValue = dose * size;
      } else if (eu === 'mcg') {
        mgValue = dose / 1000;
      } else if (eu === 'pills') {
        mgValue = dose;
      }

      // Convert mg to stored unit
      dose = mgValue;
      if (storedUnit === 'iu') {
        if (catIsPeptide && size > 0) dose = (mgValue / size) * reconVolIU;
        else if (catIsOil && size > 0) dose = (mgValue / size) * 200;
      } else if (storedUnit === 'ml') {
        if (catIsPeptide) dose = ((mgValue / size) * reconVolIU) / 100;
        else if (catIsOil && size > 0) dose = mgValue / size;
      } else if (storedUnit === 'mcg') {
        dose = mgValue * 1000;
      } else if (storedUnit === 'pills') {
        dose = mgValue;
      }
      dose = Math.round(dose * 1000) / 1000;
    }

    const updates: Partial<Compound> = {
      name: editState.name?.trim() || compound.name,
      category: (editState.category as CompoundCategory) || compound.category,
      currentQuantity: qty,
      unitSize: size,
      dosePerUse: dose,
      reorderQuantity: reorder,
      reorderType: (editState.reorderType as 'single' | 'kit') || 'single',
    };

    const editIsPeptide = editState.category === 'peptide';
    const editIsOil = editState.category === 'injectable-oil';

    // Persist unit label for all categories
    if (editState.unitLabel) {
      updates.unitLabel = editState.unitLabel;
    }
    // Persist dose label from the dose unit dropdown
    if (editState.editDoseUnit) {
      const unitMap: Record<string, string> = { mg: 'mg', mcg: 'mcg', iu: 'IU', ml: 'mL', pills: 'pills', scoop: 'scoop' };
      updates.doseLabel = unitMap[editState.editDoseUnit] || compound.doseLabel;
    }
    // Strength (weight per unit) — available for all categories
    const rawVal = parseFloat(editState.weightPerUnit || '');
    if (isNaN(rawVal) || rawVal <= 0) {
      updates.weightPerUnit = undefined;
    } else {
      const su = editState.strengthUnit || 'mg';
      let mgVal = rawVal;
      if (su === 'mcg') mgVal = rawVal / 1000;
      else if (su === 'g') mgVal = rawVal * 1000;
      updates.weightPerUnit = mgVal;
    }

    if (editIsOil) {
      const vialMl = parseFloat(editState.vialSizeMl || '10');
      updates.vialSizeMl = isNaN(vialMl) || vialMl <= 0 ? 10 : vialMl;
    }

    if (editIsPeptide) {
      if (editState.reorderType === 'single') {
        const unit = parseFloat(editState.unitPrice || '0');
        if (isNaN(unit) || unit < 0) return;
        updates.unitPrice = unit;
        updates.kitPrice = Math.round(unit * 10 * 100) / 100;
      } else {
        const kit = parseFloat(editState.kitPrice || '0');
        if (isNaN(kit) || kit < 0) return;
        updates.kitPrice = kit;
        updates.unitPrice = Math.round((kit / 10) * 100) / 100;
      }
    } else {
      const price = parseFloat(editState.unitPrice || '0');
      if (isNaN(price) || price < 0) return;
      updates.unitPrice = price;
    }

    updates.purchaseDate = editState.purchaseDate || '';

    if (editState.cyclingEnabled === 'true') {
      const on = parseInt(editState.cycleOnDays);
      const off = parseInt(editState.cycleOffDays);
      if (!isNaN(on) && on > 0 && !isNaN(off) && off > 0) {
        updates.cycleOnDays = on;
        updates.cycleOffDays = off;
        updates.cycleStartDate = editState.cycleStartDate || compound.cycleStartDate || new Date().toISOString().split('T')[0];
      }
    } else {
      // Cycling disabled — clear it
      updates.cycleOnDays = undefined;
      updates.cycleOffDays = undefined;
      updates.cycleStartDate = undefined;
    }

    if (editState.timing !== undefined) {
      updates.timingNote = editState.timing.trim() || undefined;
    }

    if (editState.daysPerWeek !== undefined) {
      const dpw = parseInt(editState.daysPerWeek);
      if (!isNaN(dpw) && dpw >= 0 && dpw <= 7) {
        updates.daysPerWeek = dpw;
      }
    }

    onUpdate(compound.id, updates);
    setEditing(false);
    toast.success(`${updates.name || compound.name} updated`);
  };

  const cancelEdit = () => setEditing(false);

  const isSingleUnit = compound.reorderType === 'single';
  const reorderLabel = isPeptide
    ? isSingleUnit
      ? `${compound.reorderQuantity} vial${compound.reorderQuantity !== 1 ? 's' : ''}`
      : `${compound.reorderQuantity} kit${compound.reorderQuantity !== 1 ? 's' : ''} (${compound.reorderQuantity * 10} vials)`
    : `${compound.reorderQuantity} ${compound.reorderType === 'kit' ? 'kit' : 'unit'}${compound.reorderQuantity !== 1 ? 's' : ''}`;

  return (
    <div className={`bg-card rounded-lg border p-2.5 sm:p-3 card-glow transition-opacity ${
      compoundIsPaused ? 'opacity-60 border-accent/30' :
      status === 'critical' ? 'border-destructive/40' :
      status === 'warning' ? 'border-accent/30' :
      'border-border/50'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-foreground truncate">{compound.name}</h4>
          <p className="text-[10px] text-muted-foreground truncate">
            {compoundIsPaused
              ? `Paused${compound.pauseRestartDate ? ` → resumes ${new Date(compound.pauseRestartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' (manual resume)'}`
              : compound.timingNote}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {compoundIsPaused && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-accent/20 text-status-warning">
              PAUSED
            </span>
          )}
          {!compoundIsPaused && cycleStatus.hasCycle && compound.cycleOnDays && compound.cycleOnDays > 0 && compound.cycleOffDays && compound.cycleOffDays > 0 && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              cycleStatus.isOn
                ? 'bg-status-good/15 text-status-good'
                : 'bg-muted text-muted-foreground'
            }`} title={cycleStatus.isOn ? `${cycleStatus.daysLeftInPhase} days left in ON phase` : `${cycleStatus.daysLeftInPhase} days left in OFF phase`}>
              {cycleStatus.isOn ? `ON ${cycleStatus.daysLeftInPhase}d` : `OFF ${cycleStatus.daysLeftInPhase}d`}
            </span>
          )}
          {!compoundIsPaused && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              status === 'critical' ? 'bg-destructive/20 text-status-critical' :
              status === 'warning' ? 'bg-accent/20 text-status-warning' :
              'bg-status-good/10 text-status-good'
            }`} title={`${days} days of supply remaining`}>
              {days}d left
            </span>
          )}
          {!editing && (
            <div className="flex items-center gap-1">
              <button onClick={startEdit} className="p-1.5 rounded active:bg-secondary/80 transition-colors text-muted-foreground touch-manipulation">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {/* Pause/Resume toggle */}
              <button
                onClick={() => {
                  if (compoundIsPaused) {
                    // Resume immediately
                    onUpdate(compound.id, { pausedAt: undefined, pauseRestartDate: undefined });
                    toast.success(`${compound.name} resumed`);
                  } else {
                    setShowPauseDialog(true);
                  }
                }}
                className={`p-1.5 rounded active:bg-secondary/80 transition-colors touch-manipulation ${compoundIsPaused ? 'text-status-warning' : 'text-muted-foreground'}`}
                title={compoundIsPaused ? 'Resume compound' : 'Pause compound'}
              >
                {compoundIsPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              {/* Dormant toggle */}
              <button
                onClick={() => {
                  const isDormant = compound.notes?.includes('[DORMANT]');
                  if (isDormant) {
                    const newNotes = (compound.notes || '').replace('[DORMANT]', '').trim();
                    onUpdate(compound.id, { notes: newNotes });
                  } else {
                    setConfirmDormant(true);
                  }
                }}
                className="p-1.5 rounded active:bg-secondary/80 transition-colors text-muted-foreground touch-manipulation"
                title={compound.notes?.includes('[DORMANT]') ? 'Reactivate compound' : 'Set dormant'}
              >
                <MoonIcon className="w-3.5 h-3.5" />
              </button>
              {/* Delete — spaced away from other actions */}
              {onDelete && !confirmDelete && (
                <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded active:bg-secondary/80 transition-colors text-muted-foreground touch-manipulation ml-4">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 mb-2">
          <span className="text-[11px] text-destructive font-medium">Remove from protocol?</span>
          <div className="flex gap-1">
            <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded text-[10px] bg-secondary text-muted-foreground">
              Cancel
            </button>
            <button onClick={() => onDelete?.(compound.id)} className="px-2 py-1 rounded text-[10px] bg-destructive text-destructive-foreground font-medium">
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Dormant confirmation */}
      <ConfirmDialog
        open={confirmDormant}
        onOpenChange={setConfirmDormant}
        title="Set Compound Dormant?"
        description={`Mark "${compound.name}" as dormant? It will be moved to the dormant section but kept in your inventory for future use.`}
        confirmLabel="Set Dormant"
        onConfirm={() => {
          const newNotes = `[DORMANT] ${compound.notes || ''}`.trim();
          onUpdate(compound.id, { notes: newNotes });
          setConfirmDormant(false);
        }}
      />

      {/* Pause dialog */}
      {showPauseDialog && (
        <div className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-2.5 mb-2 space-y-2">
          <div className="flex items-center gap-2">
            <Pause className="w-3.5 h-3.5 text-status-warning flex-shrink-0" />
            <span className="text-xs font-semibold text-foreground">Pause {compound.name}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Inventory depletion and cost projections will freeze. {cycleStatus.hasCycle ? 'Your current cycle will resume from where it left off when you unpause.' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground">Restart date (optional):</span>
            <input
              type="date"
              value={pauseDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setPauseDate(e.target.value)}
              className="flex-1 bg-secondary border border-border/50 rounded px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                onUpdate(compound.id, {
                  pausedAt: new Date().toISOString(),
                  pauseRestartDate: pauseDate || undefined,
                });
                toast.success(`${compound.name} paused${pauseDate ? ` until ${new Date(pauseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}`);
                setShowPauseDialog(false);
                setPauseDate('');
              }}
              className="flex-1 py-1.5 rounded-lg bg-accent/20 text-status-warning text-[11px] font-semibold hover:bg-accent/30 transition-colors"
            >
              Pause Now
            </button>
            <button
              onClick={() => { setShowPauseDialog(false); setPauseDate(''); }}
              className="px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground text-[11px] font-medium hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="h-1 bg-secondary rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            status === 'critical' ? 'bg-status-critical' :
            status === 'warning' ? 'bg-status-warning' :
            'bg-status-good'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {editing ? (
        <div className="space-y-1.5">
          <EditRow label="Name" value={editState.name || compound.name}
            onChange={v => setEditState(s => ({ ...s, name: v }))} type="text" />
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Category</span>
            <div className="flex gap-1 flex-1 flex-wrap">
              {categoryOrder.map(cat => (
                <button
                  key={cat}
                  onClick={() => setEditState(s => ({ ...s, category: cat }))}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                    editState.category === cat
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-secondary text-muted-foreground border border-border/50'
                  }`}
                >
                  {categoryLabels[cat] || cat}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Timing</span>
            <div className="flex gap-1 flex-1 flex-wrap">
              {(['morning', 'afternoon', 'evening'] as const).map(t => {
                const current = (editState.timing || '').toLowerCase();
                const isActive = current.includes(t) || 
                  (t === 'morning' && (current.includes('am') || current.includes('daily morning'))) ||
                  (t === 'evening' && (current.includes('pm') || current.includes('nightly') || current.includes('night'))) ||
                  (t === 'afternoon' && (current.includes('workout')));
                return (
                  <button
                    key={t}
                    onClick={() => {
                      // Toggle the timing keyword in the timingNote
                      const note = editState.timing || '';
                      if (isActive) {
                        // Remove timing keyword
                        const cleaned = note.replace(new RegExp(`\\b${t}\\b`, 'gi'), '').replace(/\s+/g, ' ').trim();
                        setEditState(s => ({ ...s, timing: cleaned }));
                      } else {
                        setEditState(s => ({ ...s, timing: note ? `${note}, ${t}` : t }));
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                      isActive
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-secondary text-muted-foreground border border-border/50'
                    }`}
                  >
                    {t === 'morning' ? <><Sun className="w-3 h-3 inline mr-0.5" />AM</> : t === 'afternoon' ? <><Dumbbell className="w-3 h-3 inline mr-0.5" />Mid</> : <><MoonIcon className="w-3 h-3 inline mr-0.5" />PM</>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Days</span>
            <div className="flex gap-0.5 flex-1">
              {(() => {
                const activeDays = parseDaysFromNote(editState.timing || '');
                const allSelected = activeDays.size === 7;
                const toggleDay = (idx: number) => {
                  const days = new Set(activeDays);
                  if (days.has(idx)) days.delete(idx);
                  else days.add(idx);
                  const note = editState.timing || '';
                  let cleaned = note
                    .replace(/\b(daily|nightly|every\s*day|m[\/-]f|mon[\s-]*fri|m\/w\/f|t\/th)\b/gi, '')
                    .replace(/\b(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sa)\b/gi, '')
                    .replace(/[,\/]\s*[,\/]/g, ',')
                    .replace(/^[,\s]+|[,\s]+$/g, '')
                    .trim();
                  const dayStr = days.size === 7 ? 'daily' : buildDayString(days);
                  const newNote = cleaned ? (dayStr ? `${dayStr}, ${cleaned}` : cleaned) : dayStr;
                  setEditState(s => ({ ...s, timing: newNote, daysPerWeek: days.size.toString() }));
                };
                const toggleAll = () => {
                  const note = editState.timing || '';
                  let cleaned = note
                    .replace(/\b(daily|nightly|every\s*day|m[\/-]f|mon[\s-]*fri|m\/w\/f|t\/th)\b/gi, '')
                    .replace(/\b(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sa)\b/gi, '')
                    .replace(/[,\/]\s*[,\/]/g, ',')
                    .replace(/^[,\s]+|[,\s]+$/g, '')
                    .trim();
                  if (allSelected) {
                    // Deselect all
                    setEditState(s => ({ ...s, timing: cleaned, daysPerWeek: '0' }));
                  } else {
                    const newNote = cleaned ? `daily, ${cleaned}` : 'daily';
                    setEditState(s => ({ ...s, timing: newNote, daysPerWeek: '7' }));
                  }
                };
                return (
                  <>
                    <button
                      onClick={toggleAll}
                      className={`h-7 px-1.5 rounded text-[10px] font-medium transition-all ${
                        allSelected
                          ? 'bg-primary/15 text-primary border border-primary/30'
                          : 'bg-secondary text-muted-foreground border border-border/50'
                      }`}
                    >
                      Daily
                    </button>
                    {DAY_LABELS.map((label, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleDay(idx)}
                        className={`w-7 h-7 rounded text-[10px] font-medium transition-all ${
                          activeDays.has(idx)
                            ? 'bg-primary/15 text-primary border border-primary/30'
                            : 'bg-secondary text-muted-foreground border border-border/50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
          <EditRow label="Note" value={editState.timing || ''}
            onChange={v => setEditState(s => ({ ...s, timing: v }))} type="text" />
          {/* On Hand with unit dropdown */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">{isPeptide ? 'Vials' : 'On Hand'}</span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                value={editState.currentQuantity}
                onChange={e => setEditState(s => ({ ...s, currentQuantity: e.target.value }))}
                className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
               />
              {editState.category === 'powder' ? (
                <select
                  value={editState.containerType || 'bags'}
                  onChange={e => setEditState(s => ({ ...s, containerType: e.target.value }))}
                  className="bg-secondary border border-border/50 rounded px-1.5 py-1 text-foreground font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-[52px]"
                >
                  <option value="bags">bags</option>
                  <option value="bottles">bottles</option>
                </select>
              ) : (
                <span className="text-muted-foreground text-[10px] whitespace-nowrap">
                  {isPeptide ? 'vials' : isOil ? 'vials' : 'bottles'}
                </span>
              )}
            </div>
          </div>
          {/* Volume (peptides/oils) or Per Unit (others) */}
          {(editState.category === 'peptide' || editState.category === 'injectable-oil') ? (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-muted-foreground w-16 flex-shrink-0">Volume</span>
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number"
                  value={editState.unitSize}
                  onChange={e => setEditState(s => ({ ...s, unitSize: e.target.value }))}
                  className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <select
                  value={editState.unitLabel || compound.unitLabel}
                  onChange={e => setEditState(s => ({ ...s, unitLabel: e.target.value }))}
                  className="bg-secondary border border-border/50 rounded px-1.5 py-1 text-foreground font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-[52px]"
                >
                  <option value="mg vial">mg vial</option>
                  <option value="mL vial">mL vial</option>
                  <option value="mg/mL">mg/mL</option>
                  <option value="IU">IU</option>
                  <option value="mL">mL</option>
                </select>
                <span className="text-muted-foreground text-[10px] whitespace-nowrap">/vial</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-muted-foreground w-16 flex-shrink-0">Per Unit</span>
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number"
                  value={editState.unitSize}
                  onChange={e => setEditState(s => ({ ...s, unitSize: e.target.value }))}
                  className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <select
                  value={editState.unitLabel || compound.unitLabel}
                  onChange={e => setEditState(s => ({ ...s, unitLabel: e.target.value }))}
                  className="bg-secondary border border-border/50 rounded px-1.5 py-1 text-foreground font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-[52px]"
                >
                  <option value="caps">caps</option>
                  <option value="tabs">tabs</option>
                  <option value="softgels">softgels</option>
                  <option value="servings">servings</option>
                  <option value="scoops">scoops</option>
                  <option value="pills">pills</option>
                  <option value="mg">mg</option>
                  <option value="mcg">mcg</option>
                  <option value="mL">mL</option>
                  <option value="mg/mL">mg/mL</option>
                  <option value="g">g</option>
                  <option value="oz">oz</option>
                  <option value="IU">IU</option>
                </select>
              </div>
            </div>
          )}
          {/* Strength (weight per unit) — available for all compound types */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Strength</span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                value={editState.weightPerUnit || ''}
                onChange={e => setEditState(s => ({ ...s, weightPerUnit: e.target.value }))}
                placeholder="e.g. 500"
                className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <select
                value={editState.strengthUnit || 'mg'}
                onChange={e => {
                  const newUnit = e.target.value;
                  const oldUnit = editState.strengthUnit || 'mg';
                  if (newUnit === oldUnit) return;
                  const currentVal = parseFloat(editState.weightPerUnit || '0');
                  if (!currentVal) {
                    setEditState(s => ({ ...s, strengthUnit: newUnit }));
                    return;
                  }
                  let mgVal = currentVal;
                  if (oldUnit === 'mcg') mgVal = currentVal / 1000;
                  else if (oldUnit === 'g') mgVal = currentVal * 1000;
                  else if (oldUnit === 'IU') mgVal = currentVal;

                  let newVal = mgVal;
                  if (newUnit === 'mcg') newVal = mgVal * 1000;
                  else if (newUnit === 'g') newVal = mgVal / 1000;
                  else if (newUnit === 'IU') newVal = mgVal;

                  newVal = Math.round(newVal * 10000) / 10000;
                  setEditState(s => ({ ...s, strengthUnit: newUnit, weightPerUnit: newVal.toString() }));
                }}
                className="bg-secondary border border-border/50 rounded px-1.5 py-1 text-foreground font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-[52px]"
              >
                <option value="mg">mg</option>
                <option value="mcg">mcg</option>
                <option value="g">g</option>
                <option value="IU">IU</option>
              </select>
              <span className="text-muted-foreground text-[10px] whitespace-nowrap">each</span>
            </div>
          </div>
          {isOil && (
            <EditRow label="Vial Size" value={editState.vialSizeMl || '10'} suffix="mL"
              onChange={v => setEditState(s => ({ ...s, vialSizeMl: v }))} type="number" />
          )}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Dose</span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                value={editState.dosePerUse}
                onChange={e => setEditState(s => ({ ...s, dosePerUse: e.target.value }))}
                className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <select
                value={editState.editDoseUnit || 'mg'}
                onChange={e => {
                  const newUnit = e.target.value;
                  const oldUnit = editState.editDoseUnit || 'mg';
                  if (newUnit === oldUnit) return;
                  // Convert current dose value between units
                  let currentDose = parseFloat(editState.dosePerUse) || 0;
                  const unitSize = parseFloat(editState.unitSize) || compound.unitSize;
                  const reconVolIU = (compound.reconVolume || 2) * 100;
                  const catIsPeptide = (editState.category || compound.category) === 'peptide';
                  const catIsOil = (editState.category || compound.category) === 'injectable-oil';

                  // First convert current value back to mg (base unit)
                  let mgValue = currentDose;
                  if (oldUnit === 'iu') {
                    if (catIsPeptide && unitSize > 0) mgValue = (currentDose / reconVolIU) * unitSize;
                    else if (catIsOil && unitSize > 0) mgValue = (currentDose / 200) * unitSize;
                  } else if (oldUnit === 'ml') {
                    if (catIsPeptide) mgValue = (currentDose * 100 / reconVolIU) * unitSize;
                    else if (catIsOil) mgValue = currentDose * unitSize;
                  } else if (oldUnit === 'mcg') {
                    mgValue = currentDose / 1000;
                   } else if (oldUnit === 'pills' || oldUnit === 'scoop') {
                     mgValue = currentDose; // pills/scoop = raw dose
                   }

                  // Then convert mg to new unit
                  let newDose = mgValue;
                  if (newUnit === 'iu') {
                    if (catIsPeptide && unitSize > 0) newDose = (mgValue / unitSize) * reconVolIU;
                    else if (catIsOil && unitSize > 0) newDose = (mgValue / unitSize) * 200;
                  } else if (newUnit === 'ml') {
                    if (catIsPeptide) newDose = ((mgValue / unitSize) * reconVolIU) / 100;
                    else if (catIsOil && unitSize > 0) newDose = mgValue / unitSize;
                  } else if (newUnit === 'mcg') {
                    newDose = mgValue * 1000;
                   } else if (newUnit === 'pills' || newUnit === 'scoop') {
                     newDose = mgValue;
                   }

                  newDose = Math.round(newDose * 1000) / 1000;
                  setEditState(s => ({ ...s, editDoseUnit: newUnit, dosePerUse: newDose.toString() }));
                }}
                className="bg-secondary border border-border/50 rounded px-1.5 py-1 text-foreground font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-[52px]"
              >
                <option value="mg">mg</option>
                <option value="mcg">mcg</option>
                <option value="iu">IU</option>
                <option value="ml">mL</option>
                <option value="pills">pills</option>
                <option value="scoop">scoop</option>
              </select>
            </div>
          </div>
          {isPeptide ? (
            editState.reorderType === 'single' ? (
              <EditRow label="Unit Price" value={editState.unitPrice || (parseFloat(editState.kitPrice || '0') / 10).toString()} prefix="$" suffix="/vial"
                onChange={v => setEditState(s => ({ ...s, unitPrice: v }))} type="number" />
            ) : (
              <EditRow label="Kit Price" value={editState.kitPrice} prefix="$" suffix="/kit (10 vials)"
                onChange={v => setEditState(s => ({ ...s, kitPrice: v }))} type="number" />
            )
          ) : (
            <EditRow label="Price" value={editState.unitPrice} prefix="$" suffix={`/${isOil ? 'vial' : 'bottle'}`}
              onChange={v => setEditState(s => ({ ...s, unitPrice: v }))} type="number" />
          )}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Purchased</span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="date"
                value={editState.purchaseDate || ''}
                onChange={e => setEditState(s => ({ ...s, purchaseDate: e.target.value }))}
                className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              {editState.purchaseDate && (
                <button
                  onClick={() => setEditState(s => ({ ...s, purchaseDate: '' }))}
                  className="p-1 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground flex-shrink-0"
                  title="Clear date"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <EditRow
            label="Reorder Qty"
            value={editState.reorderQuantity}
            onChange={v => setEditState(s => ({ ...s, reorderQuantity: v }))}
            type="number"
            suffix={editState.reorderType === 'kit' ? 'kits' : 'units'}
          />
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Order As</span>
            <div className="flex gap-1 flex-1">
              {(['single', 'kit'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setEditState(s => ({ ...s, reorderType: t }))}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    editState.reorderType === t
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-secondary text-muted-foreground border border-border/50'
                  }`}
                >
                  {t === 'single' ? 'Single Unit' : 'Kit'}
                </button>
              ))}
            </div>
          </div>
          {/* Cycling toggle */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Cycling</span>
            <div className="flex gap-1 flex-1">
              <button
                onClick={() => {
                  if (editState.cyclingEnabled === 'true') {
                    setEditState(s => ({ ...s, cyclingEnabled: 'false', cycleOnDays: '0', cycleOffDays: '0', cycleStartDate: '' }));
                  } else {
                    setEditState(s => ({
                      ...s,
                      cyclingEnabled: 'true',
                      cycleOnDays: s.cycleOnDays && s.cycleOnDays !== '0' ? s.cycleOnDays : '28',
                      cycleOffDays: s.cycleOffDays && s.cycleOffDays !== '0' ? s.cycleOffDays : '14',
                      cycleStartDate: s.cycleStartDate || new Date().toISOString().split('T')[0],
                    }));
                  }
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  editState.cyclingEnabled === 'true'
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-secondary text-muted-foreground border border-border/50'
                }`}
              >
                <RefreshCcw className="w-3 h-3 inline mr-0.5" />
                {editState.cyclingEnabled === 'true' ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
          {editState.cyclingEnabled === 'true' && (
            <>
              <EditRow label="Cycle ON" value={editState.cycleOnDays || ''} suffix="days"
                onChange={v => setEditState(s => ({ ...s, cycleOnDays: v }))} type="number" />
              <EditRow label="Cycle OFF" value={editState.cycleOffDays || ''} suffix="days"
                onChange={v => setEditState(s => ({ ...s, cycleOffDays: v }))} type="number" />
              <EditRow label="Cycle Start" value={editState.cycleStartDate || ''}
                onChange={v => setEditState(s => ({ ...s, cycleStartDate: v }))} type="date" />
            </>
          )}
          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="border-t border-border/30 pt-1.5 mt-1.5 space-y-1">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Custom Fields</span>
              {customFields.map((f, fIdx) => (
                <div key={f.id} className="flex items-center gap-1 text-[11px] group/field">
                  {/* Drag handle with reorder controls */}
                  {onReorderCustomField && (
                    <div className="flex items-center gap-0 flex-shrink-0">
                      <GripVertical className="w-3 h-3 text-muted-foreground/40 cursor-grab" />
                      <div className="flex flex-col gap-0">
                        <button
                          onClick={() => onReorderCustomField(f.id, 'up')}
                          disabled={fIdx === 0}
                          className="p-0 text-muted-foreground/50 hover:text-primary disabled:opacity-20 transition-colors"
                          title="Move up"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onReorderCustomField(f.id, 'down')}
                          disabled={fIdx === customFields.length - 1}
                          className="p-0 text-muted-foreground/50 hover:text-primary disabled:opacity-20 transition-colors"
                          title="Move down"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                  <span className="text-muted-foreground w-14 flex-shrink-0 truncate" title={f.field_name}>{f.field_name}</span>
                  <div className="flex items-center gap-1 flex-1">
                    {f.field_type === 'select' && f.options ? (
                      <select
                        value={customFieldValues.get(f.id) || f.default_value || ''}
                        onChange={e => onSetCustomFieldValue?.(compound.id, f.id, e.target.value)}
                        className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                      >
                        {(f.options as string[]).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                        value={customFieldValues.get(f.id) || f.default_value || ''}
                        onChange={e => onSetCustomFieldValue?.(compound.id, f.id, e.target.value)}
                        placeholder={f.default_value || ''}
                        className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    )}
                    {f.field_unit && <span className="text-muted-foreground text-[10px] whitespace-nowrap">{f.field_unit}</span>}
                    {onRemoveCustomField && !f.is_predefined && (
                      <button
                        onClick={async () => {
                          await onRemoveCustomField(f.id);
                          toast.success(`Removed "${f.field_name}" field`);
                        }}
                        className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                        title={`Remove ${f.field_name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    {onRemoveCustomField && f.is_predefined && (
                      <button
                        onClick={async () => {
                          await onRemoveCustomField(f.id);
                          toast.success(`Removed "${f.field_name}" field`);
                        }}
                        className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                        title={`Remove ${f.field_name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Add Field */}
          {onAddCustomField && (
            <div className="pt-1">
              {showAddField ? (
                <div className="space-y-1.5 border border-dashed border-primary/20 rounded-lg p-2 bg-primary/5">
                  <div className="flex gap-1 flex-wrap mb-1">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold w-full">Quick Add</span>
                    {PREDEFINED_FIELDS.filter(pf => !customFields.some(cf => cf.field_name === pf.field_name)).slice(0, 4).map(pf => (
                      <button
                        key={pf.field_name}
                        onClick={async () => {
                          await onAddCustomField(pf);
                          toast.success(`Added "${pf.field_name}" field`);
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground border border-border/50 hover:text-primary hover:border-primary/30 transition-all"
                      >
                        + {pf.field_name}
                      </button>
                    ))}
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Custom</span>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newFieldName}
                      onChange={e => setNewFieldName(e.target.value)}
                      placeholder="Field name"
                      className="flex-1 bg-secondary border border-border/50 rounded px-2 py-1 text-foreground text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <select
                      value={newFieldType}
                      onChange={e => setNewFieldType(e.target.value as any)}
                      className="bg-secondary border border-border/50 rounded px-1 py-1 text-[10px] text-foreground focus:outline-none"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                    </select>
                  </div>
                  {newFieldType === 'number' && (
                    <input
                      type="text"
                      value={newFieldUnit}
                      onChange={e => setNewFieldUnit(e.target.value)}
                      placeholder="Unit (e.g. mg, hours, $)"
                      className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  )}
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => { setShowAddField(false); setNewFieldName(''); setNewFieldUnit(''); }} className="px-2 py-0.5 rounded text-[10px] text-muted-foreground bg-secondary">Cancel</button>
                    <button
                      onClick={async () => {
                        if (!newFieldName.trim()) return;
                        await onAddCustomField({
                          field_name: newFieldName.trim(),
                          field_type: newFieldType,
                          field_unit: newFieldUnit.trim() || null,
                          affects_calculation: newFieldType === 'number',
                          is_predefined: false,
                        });
                        toast.success(`Added "${newFieldName}" to all compounds`);
                        setNewFieldName('');
                        setNewFieldUnit('');
                        setShowAddField(false);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] text-primary bg-primary/10 border border-primary/20 font-medium"
                    >Add</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddField(true)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                >
                  <PlusCircle className="w-3 h-3" /> Add Field
                </button>
              )}
            </div>
          )}
          <div className="flex justify-end gap-1 pt-1">
            <button onClick={cancelEdit} className="p-1 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
            <button onClick={saveEdit} className="p-1 rounded bg-primary/20 hover:bg-primary/30 text-primary">
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Per-card dose unit toggle for injectables/peptides */}
          {(isPeptide || isOil) && (
            <div className="flex justify-end mb-1.5">
              <button
                onClick={() => setDoseUnit(u => u === 'mg' ? 'ml' : u === 'ml' ? 'iu' : 'mg')}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
              >
                <Syringe className="w-2.5 h-2.5" />
                {doseUnit === 'mg' ? 'mg/mcg' : doseUnit === 'ml' ? 'mg/mL' : 'IU'}
              </button>
            </div>
          )}
          {isPeptide ? (() => {
            const storedIsIu = compound.doseLabel.toLowerCase().includes('iu');
            const storedIsMg = compound.doseLabel.toLowerCase().includes('mg') || compound.doseLabel.toLowerCase().includes('mcg');
            const reconVolIU = (compound.reconVolume || 2) * 100; // mL → IU (1mL = 100 IU)
            const vialMg = compound.unitSize;

            let displayDose = `${compound.dosePerUse} ${compound.doseLabel}`;
            if (doseUnit === 'ml') {
              // Convert to mL: IU / 100 or mg-based
              if (storedIsIu) {
                const ml = Math.round((compound.dosePerUse / 100) * 1000) / 1000;
                displayDose = `${ml} mL`;
              } else if (storedIsMg && vialMg > 0) {
                const iu = (compound.dosePerUse / vialMg) * reconVolIU;
                const ml = Math.round((iu / 100) * 1000) / 1000;
                displayDose = `${ml} mL`;
              }
            } else if (doseUnit === 'iu' && storedIsMg && vialMg > 0) {
              const iu = Math.round((compound.dosePerUse / vialMg) * reconVolIU * 100) / 100;
              displayDose = `${iu} IU`;
            } else if (doseUnit === 'mg' && storedIsIu && vialMg > 0) {
              const mg = Math.round((compound.dosePerUse / reconVolIU) * vialMg * 1000) / 1000;
              displayDose = `${mg} mg`;
            }

            return (
              <div className="grid grid-cols-2 gap-x-3 text-[10px]">
              <InlineQuantityEditor
                compound={compound}
                status={status}
                isOil={false}
                isPeptide={true}
                onUpdate={onUpdate}
              />
                <div>
                  <span className="text-muted-foreground">Per Vial:</span>{' '}
                  <span className="font-mono text-foreground">{compound.unitSize} {(() => {
                    const ul = (compound.unitLabel || 'mg vial').toLowerCase();
                    if (ul.includes('ml')) return 'mL';
                    if (ul.includes('iu')) return 'IU';
                    if (ul.includes('mg/ml')) return 'mg/mL';
                    return 'mg';
                  })()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Dose:</span>{' '}
                  <span className="font-mono text-foreground">{displayDose}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{isSingleUnit ? 'Unit Price:' : 'Kit Price:'}</span>{' '}
                  <span className="font-mono text-foreground">${isSingleUnit ? compound.unitPrice : (compound.kitPrice || 0)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Reorder:</span>{' '}
                  <span className="font-mono text-foreground">{reorderLabel}</span>
                </div>
                {compound.purchaseDate && (
                  <div>
                    <span className="text-muted-foreground">Purchased:</span>{' '}
                    <span className="font-mono text-foreground">{compound.purchaseDate}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Reorder:</span>{' '}
                  <span className="font-mono text-accent">{reorderDate}</span>
                </div>
              </div>
            );
          })() : (
            <div className="grid grid-cols-2 gap-x-3 text-[10px]">
              <InlineQuantityEditor
                compound={compound}
                status={status}
                isOil={isOil}
                isPeptide={false}
                onUpdate={onUpdate}
              />
              <div>
                <span className="text-muted-foreground">Price:</span>{' '}
                <span className="font-mono text-foreground">${compound.unitPrice}/{isOil ? 'vial' : (() => {
                  const ul = (compound.unitLabel || '').toLowerCase();
                  if (ul.includes('scoop') || ul.includes('serving') || ul.includes('g') || ul === 'oz') return 'bag';
                  return 'bottle';
                })()}</span>
              </div>
              {isOil && (
                <div>
                  <span className="text-muted-foreground">Per Vial:</span>{' '}
                  <span className="font-mono text-foreground">{compound.unitSize} {(() => {
                    const ul = (compound.unitLabel || 'mg/mL').toLowerCase();
                    if (ul.includes('ml vial')) return 'mL';
                    if (ul.includes('iu')) return 'IU';
                    if (ul.includes('mg/ml')) return 'mg/mL';
                    return 'mg';
                  })()}</span>
                </div>
              )}
              {!isOil && (
                <div>
                  <span className="text-muted-foreground">Contents:</span>{' '}
                  <span className="font-mono text-foreground">{compound.unitSize} {compound.unitLabel || 'caps'}/{(() => {
                    const ul = (compound.unitLabel || '').toLowerCase();
                    if (ul.includes('scoop') || ul.includes('serving') || ul.includes('g') || ul === 'oz') return 'bag';
                    return 'bottle';
                  })()}</span>
                </div>
              )}
              {!isOil && compound.weightPerUnit && compound.weightPerUnit > 0 && (
                <div>
                  <span className="text-muted-foreground">Per {(compound.unitLabel || 'cap').replace(/s$/, '')}:</span>{' '}
                  <span className="font-mono text-foreground">{compound.weightPerUnit >= 1000 ? `${compound.weightPerUnit / 1000}g` : `${compound.weightPerUnit}mg`}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Dose:</span>{' '}
                <span className="font-mono text-foreground">
                  {(() => {
                    // For non-oil compounds with weight per unit, show both weight and unit count
                    if (!isOil && compound.weightPerUnit && compound.weightPerUnit > 0) {
                      const doseLabel = compound.doseLabel.toLowerCase();
                      // If dose is in pills/caps/tabs, convert to weight
                      if (doseLabel.includes('pill') || doseLabel.includes('cap') || doseLabel.includes('tab') || doseLabel.includes('softgel') || doseLabel.includes('serving')) {
                        const totalMg = compound.dosePerUse * compound.weightPerUnit;
                        const weightStr = totalMg >= 1000 ? `${totalMg / 1000}g` : `${totalMg}mg`;
                        return `${weightStr} (${compound.dosePerUse} ${compound.doseLabel})`;
                      }
                      // If dose is in mg, show how many pills that is
                      if (doseLabel.includes('mg') || doseLabel.includes('mcg') || doseLabel === 'g') {
                        let doseMg = compound.dosePerUse;
                        if (doseLabel.includes('mcg')) doseMg = compound.dosePerUse / 1000;
                        else if (doseLabel === 'g') doseMg = compound.dosePerUse * 1000;
                        const pillCount = Math.round((doseMg / compound.weightPerUnit) * 10) / 10;
                        const unitSingular = (compound.unitLabel || 'cap').replace(/s$/, '');
                        return `${compound.dosePerUse} ${compound.doseLabel} (${pillCount} ${pillCount !== 1 ? compound.unitLabel || 'caps' : unitSingular})`;
                      }
                    }
                    if (!isOil || doseUnit === 'mg') return `${compound.dosePerUse} ${compound.doseLabel}`;
                    if (doseUnit === 'ml') {
                      const concMgPerMl = compound.unitSize;
                      if (concMgPerMl > 0) {
                        const ml = Math.round((compound.dosePerUse / concMgPerMl) * 1000) / 1000;
                        return `${ml} mL`;
                      }
                      return `${compound.dosePerUse} ${compound.doseLabel}`;
                    }
                    const storedIsIu = compound.doseLabel.toLowerCase().includes('iu');
                    if (storedIsIu) return `${compound.dosePerUse} ${compound.doseLabel}`;
                    const iu = compound.unitSize > 0
                      ? Math.round((compound.dosePerUse / compound.unitSize) * 200 * 100) / 100
                      : compound.dosePerUse;
                    return `${iu} IU`;
                  })()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Reorder Qty:</span>{' '}
                <span className="font-mono text-foreground">{compound.reorderQuantity} {compound.reorderType === 'kit' ? 'kit' : (() => {
                  const ul = (compound.unitLabel || '').toLowerCase();
                  if (ul.includes('scoop') || ul.includes('serving') || ul.includes('g') || ul === 'oz') return 'bag';
                  return 'bottle';
                })()}{compound.reorderQuantity !== 1 ? 's' : ''}</span>
              </div>
              {compound.purchaseDate && (
                <div>
                  <span className="text-muted-foreground">Purchased:</span>{' '}
                  <span className="font-mono text-foreground">{compound.purchaseDate}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Reorder by:</span>{' '}
                <span className="font-mono text-accent">{reorderDate}</span>
              </div>
            </div>
          )}

          {/* Custom field values display */}
          {customFields.length > 0 && Array.from(customFieldValues.entries()).filter(([,v]) => v).length > 0 && (
            <div className="grid grid-cols-2 gap-x-3 text-[10px] mt-1">
              {customFields.map(f => {
                const val = customFieldValues.get(f.id);
                if (!val) return null;
                return (
                  <div key={f.id}>
                    <span className="text-muted-foreground">{f.field_name}:</span>{' '}
                    <span className="font-mono text-foreground">{val}{f.field_unit ? ` ${f.field_unit}` : ''}</span>
                  </div>
                );
              })}
            </div>
          )}

          {(compound.cycleOnDays && compound.cycleOnDays > 0 && compound.cycleOffDays && compound.cycleOffDays > 0) ? (
            <p className="text-[10px] text-accent mt-1.5 italic flex items-center gap-1">
              <RefreshCcw className="w-3 h-3" /> {compound.cycleOnDays} days on / {compound.cycleOffDays} days off{compound.cyclingNote && !compound.cyclingNote.match(/^\d+\s*days?\s*(on|off)/i) ? ` (${compound.cyclingNote})` : ''}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};

// --- Inline Quantity Editor ---

const hapticTap = (ms = 10) => {
  try { navigator?.vibrate?.(ms); } catch {}
};

const InlineQuantityEditor = ({ compound, status, isOil, isPeptide, onUpdate }: {
  compound: Compound; status: string; isOil: boolean; isPeptide: boolean;
  onUpdate: (id: string, updates: Partial<Compound>) => void;
}) => {
  const [inlineEditing, setInlineEditing] = useState(false);
  const [inlineValue, setInlineValue] = useState(compound.currentQuantity.toString());
  const [justSaved, setJustSaved] = useState(false);

  const label = isPeptide ? 'Vials' : 'On Hand';
  const displayValue = isPeptide
    ? `${compound.currentQuantity}`
    : isOil
      ? `${compound.currentQuantity} vial${compound.currentQuantity !== 1 ? 's' : ''} (${compound.vialSizeMl || 10}mL)`
      : (() => {
          const ul = (compound.unitLabel || '').toLowerCase();
          let container = 'bottle';
          if (ul.includes('scoop') || ul.includes('serving') || ul.includes('g') || ul === 'oz') container = 'bag';
          return `${compound.currentQuantity} ${container}${compound.currentQuantity !== 1 ? 's' : ''}`;
        })();

  const saveInline = () => {
    const val = parseFloat(inlineValue);
    if (!isNaN(val) && val >= 0) {
      onUpdate(compound.id, { currentQuantity: val });
      hapticTap(15);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 600);
    }
    setInlineEditing(false);
  };

  const stepValue = (delta: number) => {
    hapticTap(6);
    const v = Math.max(0, parseFloat(inlineValue) + delta);
    setInlineValue(v.toString());
  };

  if (inlineEditing) {
    return (
      <div className="flex items-center gap-1 animate-scale-in">
        <span className="text-muted-foreground text-[10px]">{label}:</span>
        <button
          onClick={() => stepValue(-1)}
          className="w-5 h-5 rounded bg-secondary text-foreground text-xs flex items-center justify-center active:scale-90 active:bg-secondary/60 transition-transform duration-100"
        >−</button>
        <input
          type="number"
          value={inlineValue}
          onChange={e => setInlineValue(e.target.value)}
          onBlur={saveInline}
          onKeyDown={e => e.key === 'Enter' && saveInline()}
          autoFocus
          className="w-12 bg-secondary border border-primary/30 rounded px-1 py-0.5 text-foreground font-mono text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors duration-150"
        />
        <button
          onClick={() => stepValue(1)}
          className="w-5 h-5 rounded bg-secondary text-foreground text-xs flex items-center justify-center active:scale-90 active:bg-secondary/60 transition-transform duration-100"
        >+</button>
        <button onClick={saveInline} className="p-0.5 text-primary active:scale-90 transition-transform duration-100">
          <Check className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <span className="text-muted-foreground text-[10px]">{label}:</span>{' '}
      <button
        onClick={() => { hapticTap(8); setInlineValue(compound.currentQuantity.toString()); setInlineEditing(true); }}
        className={`font-mono text-[10px] text-foreground underline decoration-dotted underline-offset-2 cursor-pointer hover:text-primary transition-all duration-150 ${justSaved ? 'text-primary scale-110' : ''} ${status === 'critical' ? 'animate-pulse text-status-critical' : status === 'warning' ? 'text-status-warning' : ''}`}
        title="Tap to edit quantity"
      >
        {displayValue}
      </button>
    </div>
  );
};

// --- Edit Row ---

const EditRow = ({ label, value, onChange, type, prefix, suffix }: {
  label: string; value: string; onChange: (v: string) => void; type: string; prefix?: string; suffix?: string;
}) => (
  <div className="flex items-center gap-2 text-[11px]">
    <span className="text-muted-foreground w-16 flex-shrink-0">{label}</span>
    <div className="flex items-center gap-1 flex-1">
      {prefix && <span className="text-muted-foreground">{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
      {suffix && <span className="text-muted-foreground text-[10px] whitespace-nowrap">{suffix}</span>}
    </div>
  </div>
);

export default InventoryView;
