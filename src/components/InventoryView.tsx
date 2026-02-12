import { useState } from 'react';
import { Compound, getDaysRemaining, getStatus, CompoundCategory } from '@/data/compounds';

interface InventoryViewProps {
  compounds: Compound[];
}

const categoryLabels: Record<CompoundCategory, string> = {
  'peptide': 'Peptides',
  'injectable-oil': 'Injectable Oils',
  'oral': 'Oral Supplements',
  'powder': 'Powders',
};

const categoryOrder: CompoundCategory[] = ['peptide', 'injectable-oil', 'oral', 'powder'];

const InventoryView = ({ compounds }: InventoryViewProps) => {
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

      {/* Compound Cards */}
      {grouped.map(group => (
        <div key={group.category}>
          {group.category !== 'all' && (
            <h3 className="text-sm font-semibold text-foreground mb-2">{categoryLabels[group.category as CompoundCategory]}</h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {group.items.map(compound => (
              <CompoundCard key={compound.id} compound={compound} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const CompoundCard = ({ compound }: { compound: Compound }) => {
  const days = getDaysRemaining(compound);
  const status = getStatus(days);
  const maxDays = 90;
  const progress = Math.min(100, (days / maxDays) * 100);

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
        <span className={`text-xs font-mono px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
          status === 'critical' ? 'bg-destructive/20 text-status-critical' :
          status === 'warning' ? 'bg-accent/20 text-status-warning' :
          'bg-status-good/10 text-status-good'
        }`}>
          {days}d
        </span>
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

      <div className="grid grid-cols-2 gap-x-3 text-[10px]">
        <div>
          <span className="text-muted-foreground">Qty:</span>{' '}
          <span className="font-mono text-foreground">{compound.currentQuantity} {compound.unitLabel}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Price:</span>{' '}
          <span className="font-mono text-foreground">${compound.unitPrice}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Dose:</span>{' '}
          <span className="font-mono text-foreground">{compound.dosePerUse} {compound.doseLabel}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Reorder:</span>{' '}
          <span className="font-mono text-foreground">{compound.reorderQuantity}</span>
        </div>
      </div>

      {compound.cyclingNote && (
        <p className="text-[10px] text-accent mt-1.5 italic">⟳ {compound.cyclingNote}</p>
      )}
    </div>
  );
};

export default InventoryView;
