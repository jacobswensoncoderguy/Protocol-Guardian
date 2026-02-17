import { useState } from 'react';
import { toast } from 'sonner';
import { Compound, getStatus, getReorderDateString, CompoundCategory } from '@/data/compounds';
import { getCycleStatus, getDaysRemainingWithCycling } from '@/lib/cycling';
import { UserProtocol } from '@/hooks/useProtocols';
import { Pencil, Check, X, Trash2, Plus, ChevronDown, Syringe, Clock, SortAsc, Moon as MoonIcon, Sun, Dumbbell, RefreshCcw, Package } from 'lucide-react';
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

const InventoryView = ({ compounds, onUpdateCompound, onDeleteCompound, onAddCompound, protocols = [], toleranceLevel, onToleranceChange }: InventoryViewProps) => {
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'days'>('name');
  const [showToleranceConfirm, setShowToleranceConfirm] = useState(false);
  const [pendingTolerance, setPendingTolerance] = useState<ToleranceLevel | null>(null);
  const activeCompounds = compounds.filter(c => !c.notes?.includes('[DORMANT]'));
  const dormantCompounds = compounds.filter(c => c.notes?.includes('[DORMANT]'));
  const filtered = filter === 'all' ? activeCompounds : activeCompounds.filter(c => c.category === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'days') return getDaysRemainingWithCycling(a) - getDaysRemainingWithCycling(b);
    return a.name.localeCompare(b.name);
  });

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
        <Collapsible key={group.label}>
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
                <div key={compound.id} {...(compoundIdx === 0 && groups.indexOf(group) === 0 ? { 'data-tour': 'compound-card' } : {})}>
                  <CompoundCard compound={compound} onUpdate={onUpdateCompound} onDelete={onDeleteCompound} />
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
                <CompoundCard key={compound.id} compound={compound} onUpdate={onUpdateCompound} onDelete={onDeleteCompound} />
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

const CompoundCard = ({ compound, onUpdate, onDelete }: { compound: Compound; onUpdate: (id: string, updates: Partial<Compound>) => void; onDelete?: (id: string) => void }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDormant, setConfirmDormant] = useState(false);
  const [doseUnit, setDoseUnit] = useState<'mg' | 'ml' | 'iu'>('iu');
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<Record<string, string>>({});

  const days = getDaysRemainingWithCycling(compound);
  const status = getStatus(days);
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
    else if (dl.includes('pill') || dl.includes('cap') || dl.includes('softgel') || dl.includes('tab') || dl.includes('serving')) storedUnit = 'pills';
    else if (dl.includes('ml')) storedUnit = 'ml';
    else storedUnit = 'mg';

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
      weightPerUnit: (compound.weightPerUnit || '').toString(),
    };
    if (isPeptide) {
      state.kitPrice = (compound.kitPrice || 0).toString();
      state.unitPrice = compound.unitPrice.toString();
    } else {
      state.unitPrice = compound.unitPrice.toString();
    }
    if (!isPeptide && !isOil) {
      state.purchaseDate = compound.purchaseDate;
    }
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
    let storedUnit: string;
    if (dl.includes('iu')) storedUnit = 'iu';
    else if (dl.includes('mcg') || dl.includes('µg')) storedUnit = 'mcg';
    else if (dl.includes('pill') || dl.includes('cap') || dl.includes('softgel') || dl.includes('tab') || dl.includes('serving')) storedUnit = 'pills';
    else if (dl.includes('ml')) storedUnit = 'ml';
    else storedUnit = 'mg';

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

    // Persist unit label for non-peptide/non-oil compounds
    if (!editIsPeptide && !editIsOil && editState.unitLabel) {
      updates.unitLabel = editState.unitLabel;
    }
    // Weight per unit for non-injectable compounds
    if (!editIsPeptide && !editIsOil) {
      const wpu = parseFloat(editState.weightPerUnit || '');
      updates.weightPerUnit = isNaN(wpu) || wpu <= 0 ? undefined : wpu;
    }

    if (editIsOil) {
      const vialMl = parseFloat(editState.vialSizeMl || '10');
      updates.vialSizeMl = isNaN(vialMl) || vialMl <= 0 ? 10 : vialMl;
      updates.unitLabel = 'mg/mL';
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

    if (!editIsPeptide && !editIsOil) {
      updates.purchaseDate = editState.purchaseDate || '';
    }

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
  };

  const cancelEdit = () => setEditing(false);

  const isSingleUnit = compound.reorderType === 'single';
  const reorderLabel = isPeptide
    ? isSingleUnit
      ? `${compound.reorderQuantity} vial${compound.reorderQuantity !== 1 ? 's' : ''}`
      : `${compound.reorderQuantity} kit${compound.reorderQuantity !== 1 ? 's' : ''} (${compound.reorderQuantity * 10} vials)`
    : `${compound.reorderQuantity} ${compound.reorderType === 'kit' ? 'kit' : 'unit'}${compound.reorderQuantity !== 1 ? 's' : ''}`;

  return (
    <div className={`bg-card rounded-lg border p-2.5 sm:p-3 card-glow ${
      status === 'critical' ? 'border-destructive/40' :
      status === 'warning' ? 'border-accent/30' :
      'border-border/50'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-foreground truncate">{compound.name}</h4>
          <p className="text-[10px] text-muted-foreground truncate">{compound.timingNote}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {cycleStatus.hasCycle && compound.cycleOnDays && compound.cycleOnDays > 0 && compound.cycleOffDays && compound.cycleOffDays > 0 && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              cycleStatus.isOn
                ? 'bg-status-good/15 text-status-good'
                : 'bg-muted text-muted-foreground'
            }`} title={cycleStatus.isOn ? `${cycleStatus.daysLeftInPhase} days left in ON phase` : `${cycleStatus.daysLeftInPhase} days left in OFF phase`}>
              {cycleStatus.isOn ? `ON ${cycleStatus.daysLeftInPhase}d` : `OFF ${cycleStatus.daysLeftInPhase}d`}
            </span>
          )}
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
            status === 'critical' ? 'bg-destructive/20 text-status-critical' :
            status === 'warning' ? 'bg-accent/20 text-status-warning' :
            'bg-status-good/10 text-status-good'
          }`} title={`${days} days of supply remaining`}>
            {days}d left
          </span>
          {!editing && (
            <div className="flex items-center gap-1">
              <button onClick={startEdit} className="p-1.5 rounded active:bg-secondary/80 transition-colors text-muted-foreground touch-manipulation">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {/* Dormant toggle */}
              <button
                onClick={() => {
                  const isDormant = compound.notes?.includes('[DORMANT]');
                  if (isDormant) {
                    // Reactivate directly
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

      {/* Progress bar */}
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
              <span className="text-muted-foreground text-[10px] whitespace-nowrap">
                {isPeptide ? 'vials' : isOil ? 'vials' : (editState.category === 'powder' ? 'bags' : 'bottles')}
              </span>
            </div>
          </div>
          {/* Per Unit with unit label dropdown */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">{isOil ? 'Conc.' : 'Per Unit'}</span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                value={editState.unitSize}
                onChange={e => setEditState(s => ({ ...s, unitSize: e.target.value }))}
                className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              {isOil ? (
                <span className="text-muted-foreground text-[10px] whitespace-nowrap">mg/mL</span>
              ) : isPeptide ? (
                <span className="text-muted-foreground text-[10px] whitespace-nowrap">mg</span>
              ) : (
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
                  <option value="g">g</option>
                  <option value="oz">oz</option>
                </select>
              )}
            </div>
          </div>
          {/* Weight per unit for non-injectable compounds */}
          {!isPeptide && !isOil && (
            <EditRow label="Wt/Unit" value={editState.weightPerUnit || ''} suffix="mg each"
              onChange={v => setEditState(s => ({ ...s, weightPerUnit: v }))} type="number" />
          )}
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
                  } else if (oldUnit === 'pills') {
                    mgValue = currentDose; // pills = raw dose
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
                  } else if (newUnit === 'pills') {
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
                {(isPeptide || isOil) && <option value="ml">mL</option>}
                <option value="pills">pills</option>
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
          {!isPeptide && !isOil && (
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
          )}
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
                <div>
                  <span className="text-muted-foreground">Vials:</span>{' '}
                  <span className={`font-mono text-foreground ${status === 'critical' ? 'animate-pulse text-status-critical' : status === 'warning' ? 'text-status-warning' : ''}`}>{compound.currentQuantity}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Per Vial:</span>{' '}
                  <span className="font-mono text-foreground">{compound.unitSize} mg</span>
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
                <div>
                  <span className="text-muted-foreground">Reorder:</span>{' '}
                  <span className="font-mono text-accent">{reorderDate}</span>
                </div>
              </div>
            );
          })() : (
            <div className="grid grid-cols-2 gap-x-3 text-[10px]">
              <div>
              <span className="text-muted-foreground">On Hand:</span>{' '}
                <span className={`font-mono text-foreground ${status === 'critical' ? 'animate-pulse text-status-critical' : status === 'warning' ? 'text-status-warning' : ''}`}>
                  {isOil
                    ? `${compound.currentQuantity} vial${compound.currentQuantity !== 1 ? 's' : ''} (${compound.vialSizeMl || 10}mL)`
                    : (() => {
                        const ul = (compound.unitLabel || '').toLowerCase();
                        let container = 'bottle';
                        if (ul.includes('scoop') || ul.includes('serving') || ul.includes('g') || ul === 'oz') container = 'bag';
                        return `${compound.currentQuantity} ${container}${compound.currentQuantity !== 1 ? 's' : ''}`;
                      })()}
                </span>
              </div>
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
                  <span className="text-muted-foreground">Conc.:</span>{' '}
                  <span className="font-mono text-foreground">{compound.unitSize} mg/mL</span>
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
              {!isOil && compound.purchaseDate && (
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
