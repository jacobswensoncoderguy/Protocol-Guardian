import { useState } from 'react';
import { Compound, getDaysRemaining, getStatus, CompoundCategory } from '@/data/compounds';
import { Pencil, Check, X } from 'lucide-react';

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
  const [sortBy, setSortBy] = useState<'name' | 'days'>('days');

  const filtered = filter === 'all' ? compounds : compounds.filter(c => c.category === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'days') return getDaysRemaining(a) - getDaysRemaining(b);
    return a.name.localeCompare(b.name);
  });

  const grouped = sortBy === 'name'
    ? categoryOrder.map(cat => ({
        category: cat,
        items: sorted.filter(c => c.category === cat),
      })).filter(g => g.items.length > 0)
    : [{ category: 'all' as const, items: sorted }];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 overflow-x-auto">
          {(['all', ...categoryOrder] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2.5 py-1 rounded-md text-xs transition-all whitespace-nowrap ${
                filter === cat
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {cat === 'all' ? 'All' : categoryLabels[cat]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSortBy(s => s === 'days' ? 'name' : 'days')}
          className="ml-auto px-2.5 py-1 rounded-md text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80"
        >
          Sort: {sortBy === 'days' ? '⏰ Days Left' : '🔤 Name'}
        </button>
      </div>

      {/* Info note */}
      <p className="text-[10px] text-muted-foreground italic">
        Tap ✏️ on any card to edit inventory. Peptide reorder qty = kits of 10 vials each.
      </p>

      {/* Compound Cards */}
      {grouped.map(group => (
        <div key={group.category}>
          {group.category !== 'all' && (
            <h3 className="text-sm font-semibold text-foreground mb-2">{categoryLabels[group.category as CompoundCategory]}</h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {group.items.map(compound => (
              <CompoundCard key={compound.id} compound={compound} onUpdate={onUpdateCompound} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

interface EditState {
  currentQuantity: string;
  unitSize: string;
  unitPrice: string;
  purchaseDate: string;
  reorderQuantity: string;
}

const CompoundCard = ({ compound, onUpdate }: { compound: Compound; onUpdate: (id: string, updates: Partial<Compound>) => void }) => {
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<EditState>({
    currentQuantity: '',
    unitSize: '',
    unitPrice: '',
    purchaseDate: '',
    reorderQuantity: '',
  });

  const days = getDaysRemaining(compound);
  const status = getStatus(days);
  const maxDays = 90;
  const progress = Math.min(100, (days / maxDays) * 100);
  const isPeptide = compound.category === 'peptide';

  const startEdit = () => {
    setEditState({
      currentQuantity: compound.currentQuantity.toString(),
      unitSize: compound.unitSize.toString(),
      unitPrice: compound.unitPrice.toString(),
      purchaseDate: compound.purchaseDate,
      reorderQuantity: compound.reorderQuantity.toString(),
    });
    setEditing(true);
  };

  const saveEdit = () => {
    const qty = parseFloat(editState.currentQuantity);
    const size = parseFloat(editState.unitSize);
    const price = parseFloat(editState.unitPrice);
    const reorder = parseInt(editState.reorderQuantity);
    if (isNaN(qty) || isNaN(size) || isNaN(price) || isNaN(reorder) || qty < 0 || size <= 0 || price < 0 || reorder < 0) return;

    onUpdate(compound.id, {
      currentQuantity: qty,
      unitSize: size,
      unitPrice: price,
      purchaseDate: editState.purchaseDate,
      reorderQuantity: reorder,
    });
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  const reorderLabel = isPeptide
    ? `${compound.reorderQuantity} kit${compound.reorderQuantity !== 1 ? 's' : ''} (${compound.reorderQuantity * 10} vials)`
    : `${compound.reorderQuantity}`;

  return (
    <div className={`bg-card rounded-lg border p-3 card-glow ${
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
          <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
            status === 'critical' ? 'bg-destructive/20 text-status-critical' :
            status === 'warning' ? 'bg-accent/20 text-status-warning' :
            'bg-status-good/10 text-status-good'
          }`}>
            {days}d
          </span>
          {!editing && (
            <button onClick={startEdit} className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              <Pencil className="w-3 h-3" />
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
          <EditRow label="Vials" value={editState.currentQuantity}
            onChange={v => setEditState(s => ({ ...s, currentQuantity: v }))} type="number" />
          <EditRow label="Per Vial" value={editState.unitSize} suffix={isPeptide ? 'mg' : compound.unitLabel.split(' ')[0]}
            onChange={v => setEditState(s => ({ ...s, unitSize: v }))} type="number" />
          <EditRow label="Price" value={editState.unitPrice} prefix="$" suffix="/vial"
            onChange={v => setEditState(s => ({ ...s, unitPrice: v }))} type="number" />
          <EditRow label="Purchased" value={editState.purchaseDate}
            onChange={v => setEditState(s => ({ ...s, purchaseDate: v }))} type="date" />
          <EditRow
            label={isPeptide ? 'Kits (×10)' : 'Reorder'}
            value={editState.reorderQuantity}
            onChange={v => setEditState(s => ({ ...s, reorderQuantity: v }))}
            type="number"
          />
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
          <div className="grid grid-cols-2 gap-x-3 text-[10px]">
            <div>
              <span className="text-muted-foreground">Vials:</span>{' '}
              <span className="font-mono text-foreground">{compound.currentQuantity}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Per Vial:</span>{' '}
              <span className="font-mono text-foreground">{compound.unitSize} {isPeptide ? 'mg' : compound.unitLabel}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Price:</span>{' '}
              <span className="font-mono text-foreground">${compound.unitPrice}/vial</span>
            </div>
            <div>
              <span className="text-muted-foreground">Dose:</span>{' '}
              <span className="font-mono text-foreground">{compound.dosePerUse} {compound.doseLabel}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total:</span>{' '}
              <span className="font-mono text-foreground">{compound.currentQuantity * compound.unitSize} {isPeptide ? 'mg' : compound.unitLabel}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Reorder:</span>{' '}
              <span className="font-mono text-foreground">{reorderLabel}</span>
            </div>
          </div>

          {compound.cyclingNote && (
            <p className="text-[10px] text-accent mt-1.5 italic">⟳ {compound.cyclingNote}</p>
          )}
        </>
      )}
    </div>
  );
};

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
