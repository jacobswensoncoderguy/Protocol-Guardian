import { useState } from 'react';
import { Compound, getStatus, getReorderDateString, CompoundCategory } from '@/data/compounds';
import { getCycleStatus, getDaysRemainingWithCycling } from '@/lib/cycling';
import { UserProtocol } from '@/hooks/useProtocols';
import { Pencil, Check, X, Trash2, Plus, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface InventoryViewProps {
  compounds: Compound[];
  onUpdateCompound: (id: string, updates: Partial<Compound>) => void;
  onDeleteCompound?: (id: string) => void;
  onAddCompound?: () => void;
  protocols?: UserProtocol[];
}

const categoryLabels: Record<CompoundCategory, string> = {
  'peptide': 'Peptides',
  'injectable-oil': 'Injectable Oils',
  'oral': 'Oral Supplements',
  'powder': 'Powders',
};

const categoryOrder: CompoundCategory[] = ['peptide', 'injectable-oil', 'oral', 'powder'];

const InventoryView = ({ compounds, onUpdateCompound, onDeleteCompound, onAddCompound, protocols = [] }: InventoryViewProps) => {
  const [filter, setFilter] = useState<CompoundCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'days'>('name');

  const filtered = filter === 'all' ? compounds : compounds.filter(c => c.category === filter);
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
      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-thin -mx-1 px-1">
          {(['all', ...categoryOrder] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] sm:text-xs transition-all whitespace-nowrap touch-manipulation ${
                filter === cat
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-secondary text-secondary-foreground active:bg-secondary/60'
              }`}
            >
              {cat === 'all' ? 'All' : categoryLabels[cat]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSortBy(s => s === 'days' ? 'name' : 'days')}
          className="ml-auto px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] sm:text-xs bg-secondary text-secondary-foreground active:bg-secondary/60 touch-manipulation"
        >
          {sortBy === 'days' ? '⏰ Days' : '🔤 Name'}
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
              {group.items.map(compound => (
                <CompoundCard key={compound.id} compound={compound} onUpdate={onUpdateCompound} onDelete={onDeleteCompound} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
};

// --- Compound Card ---

const CompoundCard = ({ compound, onUpdate, onDelete }: { compound: Compound; onUpdate: (id: string, updates: Partial<Compound>) => void; onDelete?: (id: string) => void }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
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
    const patterns: [RegExp, number[]][] = [
      [/\bm[\/-]f\b|mon[\s-]*fri/i, [1,2,3,4,5]],
      [/\bm\/w\/f\b/i, [1,3,5]],
      [/\bt\/th\b/i, [2,4]],
    ];
    for (const [pat, idxs] of patterns) {
      if (pat.test(lower)) { idxs.forEach(i => days.add(i)); return days; }
    }
    const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thurs: 4, fri: 5, sat: 6, sa: 6 };
    const matches = lower.match(/\b(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sa)\b/gi);
    if (matches) matches.forEach(m => { const i = dayMap[m.toLowerCase()]; if (i !== undefined) days.add(i); });
    if (days.size === 0 && (/\bdaily\b|\bnightly\b|\bevery\s*day\b/i.test(lower) || compound.daysPerWeek === 7)) {
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
    return sorted.map(d => DAY_LABELS[d]).join('/');
  };

  const startEdit = () => {
    const state: Record<string, string> = {
      name: compound.name,
      category: compound.category,
      timing: compound.timingNote || '',
      daysPerWeek: compound.daysPerWeek.toString(),
      currentQuantity: compound.currentQuantity.toString(),
      unitSize: compound.unitSize.toString(),
      dosePerUse: compound.dosePerUse.toString(),
      reorderQuantity: compound.reorderQuantity.toString(),
    };
    if (isPeptide) {
      state.kitPrice = (compound.kitPrice || 0).toString();
    } else {
      state.unitPrice = compound.unitPrice.toString();
    }
    if (!isPeptide && !isOil) {
      state.purchaseDate = compound.purchaseDate;
    }
    if (compound.cycleOnDays) {
      state.cycleOnDays = compound.cycleOnDays.toString();
      state.cycleOffDays = (compound.cycleOffDays || 0).toString();
      state.cycleStartDate = compound.cycleStartDate || '';
    }
    setEditState(state);
    setEditing(true);
  };

  const saveEdit = () => {
    const qty = parseFloat(editState.currentQuantity);
    const size = parseFloat(editState.unitSize);
    const dose = parseFloat(editState.dosePerUse);
    const reorder = parseInt(editState.reorderQuantity);
    if (isNaN(qty) || isNaN(size) || isNaN(dose) || isNaN(reorder) || qty < 0 || size <= 0 || dose < 0 || reorder < 0) return;

    const updates: Partial<Compound> = {
      name: editState.name?.trim() || compound.name,
      category: (editState.category as CompoundCategory) || compound.category,
      currentQuantity: qty,
      unitSize: size,
      dosePerUse: dose,
      reorderQuantity: reorder,
    };

    const editIsPeptide = editState.category === 'peptide';
    const editIsOil = editState.category === 'injectable-oil';

    if (editIsPeptide) {
      const kit = parseFloat(editState.kitPrice || '0');
      if (isNaN(kit) || kit < 0) return;
      updates.kitPrice = kit;
    } else {
      const price = parseFloat(editState.unitPrice || '0');
      if (isNaN(price) || price < 0) return;
      updates.unitPrice = price;
    }

    if (!editIsPeptide && !editIsOil && editState.purchaseDate) {
      updates.purchaseDate = editState.purchaseDate;
    }

    if (editState.cycleOnDays !== undefined) {
      const on = parseInt(editState.cycleOnDays);
      const off = parseInt(editState.cycleOffDays);
      if (!isNaN(on) && on > 0 && !isNaN(off) && off > 0) {
        updates.cycleOnDays = on;
        updates.cycleOffDays = off;
        updates.cycleStartDate = editState.cycleStartDate || undefined;
      }
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

  const reorderLabel = isPeptide
    ? `${compound.reorderQuantity} kit${compound.reorderQuantity !== 1 ? 's' : ''} (${compound.reorderQuantity * 10} vials)`
    : `${compound.reorderQuantity}`;

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
          {cycleStatus.hasCycle && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              cycleStatus.isOn
                ? 'bg-status-good/15 text-status-good'
                : 'bg-muted text-muted-foreground'
            }`}>
              {cycleStatus.isOn ? `ON ${cycleStatus.daysLeftInPhase}d` : `OFF ${cycleStatus.daysLeftInPhase}d`}
            </span>
          )}
          <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
            status === 'critical' ? 'bg-destructive/20 text-status-critical' :
            status === 'warning' ? 'bg-accent/20 text-status-warning' :
            'bg-status-good/10 text-status-good'
          }`}>
            {days}d
          </span>
          {!editing && (
            <div className="flex items-center gap-0.5">
              <button onClick={startEdit} className="p-1.5 rounded active:bg-secondary/80 transition-colors text-muted-foreground touch-manipulation">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {onDelete && !confirmDelete && (
                <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded active:bg-secondary/80 transition-colors text-muted-foreground touch-manipulation">
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
                  {cat === 'peptide' ? 'Pep' : cat === 'injectable-oil' ? 'Oil' : cat === 'oral' ? 'Oral' : 'Pwd'}
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
                    {t === 'morning' ? '☀️ AM' : t === 'afternoon' ? '💪 Mid' : '🌙 PM'}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Days</span>
            <div className="flex gap-0.5 flex-1">
              {DAY_LABELS.map((label, idx) => {
                const activeDays = parseDaysFromNote(editState.timing || '');
                const isActive = activeDays.has(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      const days = parseDaysFromNote(editState.timing || '');
                      if (isActive) days.delete(idx);
                      else days.add(idx);
                      // Rebuild the timing note: keep non-day parts, replace day pattern
                      const note = editState.timing || '';
                      // Remove existing day patterns
                      let cleaned = note
                        .replace(/\b(daily|nightly|every\s*day|m[\/-]f|mon[\s-]*fri|m\/w\/f|t\/th)\b/gi, '')
                        .replace(/\b(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sa)\b/gi, '')
                        .replace(/[,\/]\s*[,\/]/g, ',')
                        .replace(/^[,\s]+|[,\s]+$/g, '')
                        .trim();
                      const dayStr = buildDayString(days);
                      const newNote = cleaned ? (dayStr ? `${dayStr}, ${cleaned}` : cleaned) : dayStr;
                      setEditState(s => ({
                        ...s,
                        timing: newNote,
                        daysPerWeek: days.size.toString(),
                      }));
                    }}
                    className={`w-7 h-7 rounded text-[10px] font-medium transition-all ${
                      isActive
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-secondary text-muted-foreground border border-border/50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <EditRow label="Note" value={editState.timing || ''}
            onChange={v => setEditState(s => ({ ...s, timing: v }))} type="text" />
          <EditRow label={isPeptide ? 'Vials' : 'Qty'} value={editState.currentQuantity}
            onChange={v => setEditState(s => ({ ...s, currentQuantity: v }))} type="number" />
          <EditRow label="Per Unit" value={editState.unitSize} suffix={isPeptide ? 'mg' : compound.unitLabel.split(' ')[0]}
            onChange={v => setEditState(s => ({ ...s, unitSize: v }))} type="number" />
          <EditRow label="Dose" value={editState.dosePerUse} suffix={compound.doseLabel}
            onChange={v => setEditState(s => ({ ...s, dosePerUse: v }))} type="number" />
          {isPeptide ? (
            <EditRow label="Kit Price" value={editState.kitPrice} prefix="$" suffix="/kit (10 vials)"
              onChange={v => setEditState(s => ({ ...s, kitPrice: v }))} type="number" />
          ) : (
            <EditRow label="Price" value={editState.unitPrice} prefix="$" suffix={`/${isOil ? 'vial' : 'bottle'}`}
              onChange={v => setEditState(s => ({ ...s, unitPrice: v }))} type="number" />
          )}
          {!isPeptide && !isOil && (
            <EditRow label="Purchased" value={editState.purchaseDate}
              onChange={v => setEditState(s => ({ ...s, purchaseDate: v }))} type="date" />
          )}
          <EditRow
            label={isPeptide ? 'Kits (×10)' : 'Reorder'}
            value={editState.reorderQuantity}
            onChange={v => setEditState(s => ({ ...s, reorderQuantity: v }))}
            type="number"
          />
          {editState.cycleOnDays !== undefined && (
            <>
              <EditRow label="Cycle ON" value={editState.cycleOnDays} suffix="days"
                onChange={v => setEditState(s => ({ ...s, cycleOnDays: v }))} type="number" />
              <EditRow label="Cycle OFF" value={editState.cycleOffDays} suffix="days"
                onChange={v => setEditState(s => ({ ...s, cycleOffDays: v }))} type="number" />
              <EditRow label="Cycle Start" value={editState.cycleStartDate}
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
          {isPeptide ? (
            <div className="grid grid-cols-2 gap-x-3 text-[10px]">
              <div>
                <span className="text-muted-foreground">Vials:</span>{' '}
                <span className="font-mono text-foreground">{compound.currentQuantity}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Per Vial:</span>{' '}
                <span className="font-mono text-foreground">{compound.unitSize} mg</span>
              </div>
              <div>
                <span className="text-muted-foreground">Dose:</span>{' '}
                <span className="font-mono text-foreground">{compound.dosePerUse} {compound.doseLabel}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Kit Price:</span>{' '}
                <span className="font-mono text-foreground">${compound.kitPrice || 0}</span>
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
          ) : (
            <div className="grid grid-cols-2 gap-x-3 text-[10px]">
              <div>
                <span className="text-muted-foreground">Qty:</span>{' '}
                <span className="font-mono text-foreground">{compound.currentQuantity} {compound.unitLabel}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Price:</span>{' '}
                <span className="font-mono text-foreground">${compound.unitPrice}/{isOil ? 'vial' : 'bottle'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Dose:</span>{' '}
                <span className="font-mono text-foreground">{compound.dosePerUse} {compound.doseLabel}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Reorder:</span>{' '}
                <span className="font-mono text-foreground">{compound.reorderQuantity}</span>
              </div>
              {!isOil && (
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

          {compound.cyclingNote && (
            <p className="text-[10px] text-accent mt-1.5 italic">⟳ {compound.cyclingNote}</p>
          )}
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
