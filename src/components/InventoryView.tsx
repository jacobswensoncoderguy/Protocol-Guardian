import { useState } from 'react';
import { Compound, getStatus, getReorderDateString, CompoundCategory } from '@/data/compounds';
import { getCycleStatus, getDaysRemainingWithCycling } from '@/lib/cycling';
import { Pencil, Check, X, PauseCircle } from 'lucide-react';

interface InventoryViewProps {
  compounds: Compound[];
  onUpdateCompound: (id: string, updates: Partial<Compound>) => void;
}

const categoryLabels: Record<CompoundCategory, string> = {
  'peptide': 'Peptides',
  'injectable-oil': 'Injectable Oils',
  'oral': 'Oral Supplements',
  'powder': 'Powders',
};

const categoryOrder: CompoundCategory[] = ['peptide', 'injectable-oil', 'oral', 'powder'];

const InventoryView = ({ compounds, onUpdateCompound }: InventoryViewProps) => {
  const [filter, setFilter] = useState<CompoundCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'days'>('name');

  const filtered = filter === 'all' ? compounds : compounds.filter(c => c.category === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'days') return getDaysRemainingWithCycling(a) - getDaysRemainingWithCycling(b);
    return a.name.localeCompare(b.name);
  });

  const grouped = sortBy === 'name'
    ? categoryOrder.map(cat => ({
        category: cat,
        items: sorted.filter(c => c.category === cat),
      })).filter(g => g.items.length > 0)
    : [{ category: 'all' as const, items: sorted }];

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

      {/* Compound Cards */}
      {grouped.map(group => (
        <div key={group.category}>
          {group.category !== 'all' && (
            <h3 className="text-sm font-semibold text-foreground mb-2">{categoryLabels[group.category as CompoundCategory]}</h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {group.items.map(compound => (
              <CompoundCard key={compound.id} compound={compound} onUpdate={onUpdateCompound} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Compound Card ---

const CompoundCard = ({ compound, onUpdate }: { compound: Compound; onUpdate: (id: string, updates: Partial<Compound>) => void }) => {
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

  const startEdit = () => {
    const state: Record<string, string> = {
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
      currentQuantity: qty,
      unitSize: size,
      dosePerUse: dose,
      reorderQuantity: reorder,
    };

    if (isPeptide) {
      const kit = parseFloat(editState.kitPrice);
      if (isNaN(kit) || kit < 0) return;
      updates.kitPrice = kit;
    } else {
      const price = parseFloat(editState.unitPrice);
      if (isNaN(price) || price < 0) return;
      updates.unitPrice = price;
    }

    if (!isPeptide && !isOil && editState.purchaseDate) {
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
            <button onClick={startEdit} className="p-1.5 rounded active:bg-secondary/80 transition-colors text-muted-foreground touch-manipulation">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

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
