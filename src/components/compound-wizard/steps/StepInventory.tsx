import { WizardFormData } from '../types';

interface StepInventoryProps {
  formData: WizardFormData;
  onUpdate: (data: Partial<WizardFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  accentColor: string;
}

export default function StepInventory({ formData, onUpdate, onNext, onBack, accentColor }: StepInventoryProps) {
  // Estimate days of supply (simplified — full calculation uses existing functions post-save)
  const supply = parseFloat(formData.currentSupply) || 0;
  const dosesPerDay = parseFloat(formData.dosesPerDay) || 1;
  const type = formData.compoundType;

  let estimatedDays = 0;
  let supplyLabel = 'units';

  if (type === 'lyophilized-peptide') {
    supplyLabel = 'vials';
    const bacstat = parseFloat(formData.powderWeightPerVial) || 0;
    const dose = parseFloat(formData.targetDose) || 0;
    if (bacstat > 0 && dose > 0) {
      const dosesPerVial = Math.floor(bacstat / dose);
      estimatedDays = Math.floor((supply * dosesPerVial) / dosesPerDay);
    }
  } else if (type === 'injectable-oil') {
    supplyLabel = 'vials';
    const conc = parseFloat(formData.concentration) || 0;
    const vialMl = parseFloat(formData.vialSizeMl) || 0;
    const dose = parseFloat(formData.targetDose) || 0;
    if (conc > 0 && vialMl > 0 && dose > 0) {
      const dosesPerVial = Math.floor((conc * vialMl) / dose);
      estimatedDays = Math.floor((supply * dosesPerVial) / dosesPerDay);
    }
  } else if (type === 'oral-pill') {
    supplyLabel = 'containers';
    const countPerContainer = parseFloat(formData.countPerContainer) || 0;
    const unitsPerDose = parseFloat(formData.unitsPerDose) || 1;
    if (countPerContainer > 0) {
      const dosesPerContainer = Math.floor(countPerContainer / unitsPerDose);
      estimatedDays = Math.floor((supply * dosesPerContainer) / dosesPerDay);
    }
  } else if (type === 'oral-powder') {
    supplyLabel = 'containers';
    const containerSize = parseFloat(formData.containerSize) || 0;
    const doseWeight = parseFloat(formData.doseWeightPerServing) || 0;
    if (containerSize > 0 && doseWeight > 0) {
      let containerG = containerSize;
      if (formData.containerSizeUnit === 'kg') containerG *= 1000;
      let doseG = doseWeight;
      if (formData.doseWeightUnit === 'mg') doseG /= 1000;
      const dosesPerContainer = Math.floor(containerG / doseG);
      estimatedDays = Math.floor((supply * dosesPerContainer) / dosesPerDay);
    }
  } else if (type === 'topical') {
    supplyLabel = 'containers';
    const dosesPerContainer = parseFloat(formData.dosesPerContainer) || 0;
    if (dosesPerContainer > 0) {
      estimatedDays = Math.floor((supply * dosesPerContainer) / dosesPerDay);
    }
  } else {
    supplyLabel = 'units';
  }

  // Depletion bar
  const maxDays = 180;
  const barPct = Math.min(100, (estimatedDays / maxDays) * 100);
  const barColor = barPct > 50
    ? `hsl(${accentColor})`
    : barPct > 20
      ? 'hsl(var(--status-warning))'
      : 'hsl(var(--status-critical))';

  return (
    <div className="space-y-5 px-4 pb-6">
      <h3 className="text-base font-semibold text-foreground">Supply & Reorder</h3>

      {/* Current supply */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">How much do you currently have on hand?</label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            value={formData.currentSupply}
            onChange={e => onUpdate({ currentSupply: e.target.value })}
            className="flex-1 rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
          />
          <span className="text-xs text-muted-foreground">{supplyLabel}</span>
        </div>
      </div>

      {/* Estimated days */}
      {estimatedDays > 0 && (
        <div className="rounded-xl p-3 border space-y-2" style={{ borderColor: `hsl(${accentColor} / 0.3)`, backgroundColor: `hsl(${accentColor} / 0.06)` }}>
          <p className="text-sm font-mono" style={{ color: `hsl(${accentColor})` }}>
            Days of supply remaining: ~{estimatedDays} days
          </p>
          <div className="w-full h-2 rounded-full overflow-hidden bg-muted/50">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barPct}%`, backgroundColor: barColor }} />
          </div>
        </div>
      )}

      {/* Reorder threshold */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Alert me to reorder when X days of supply remain</label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="numeric"
            value={formData.reorderThresholdDays}
            onChange={e => onUpdate({ reorderThresholdDays: e.target.value })}
            className="flex-1 rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
          />
          <span className="text-xs text-muted-foreground">days</span>
        </div>
      </div>

      {/* Order format */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Order format</label>
        <div className="flex gap-2">
          {['Single Unit', 'Kit', 'Subscription'].map(opt => {
            const selected = formData.orderFormat === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onUpdate({ orderFormat: opt })}
                className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-all border min-h-[44px]"
                style={{
                  borderColor: selected ? `hsl(${accentColor})` : 'hsl(var(--border) / 0.5)',
                  backgroundColor: selected ? `hsl(${accentColor} / 0.12)` : 'transparent',
                  color: selected ? `hsl(${accentColor})` : 'hsl(var(--muted-foreground))',
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conditional pricing fields */}
      {formData.orderFormat === 'Kit' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Kit size</label>
            <input type="number" inputMode="numeric" value={formData.kitSize} onChange={e => onUpdate({ kitSize: e.target.value })} className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Price per kit ($)</label>
            <input type="number" inputMode="decimal" value={formData.pricePerKit} onChange={e => onUpdate({ pricePerKit: e.target.value })} className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
        </div>
      )}
      {formData.orderFormat === 'Single Unit' && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Price per unit ($)</label>
          <input type="number" inputMode="decimal" value={formData.pricePerUnit} onChange={e => onUpdate({ pricePerUnit: e.target.value })} className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
        </div>
      )}
      {formData.orderFormat === 'Subscription' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cycle interval (days)</label>
            <input type="number" inputMode="numeric" value={formData.subscriptionInterval} onChange={e => onUpdate({ subscriptionInterval: e.target.value })} className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Price per cycle ($)</label>
            <input type="number" inputMode="decimal" value={formData.subscriptionPrice} onChange={e => onUpdate({ subscriptionPrice: e.target.value })} className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
        </div>
      )}

      {/* Reorder quantity */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          How many {formData.orderFormat === 'Kit' ? 'kits' : 'units'} to order at a time?
        </label>
        <input type="number" inputMode="numeric" value={formData.reorderQuantity} onChange={e => onUpdate({ reorderQuantity: e.target.value })} className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
      </div>

      {/* Supplier notes */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Supplier notes</label>
        <input type="text" value={formData.supplierNotes} onChange={e => onUpdate({ supplierNotes: e.target.value })} placeholder="e.g. Source A, code JAKE10 for discount" className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50" />
      </div>

      {/* Auto reorder alert */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">Auto-reorder alert</label>
        <button
          type="button"
          onClick={() => onUpdate({ autoReorderAlert: !formData.autoReorderAlert })}
          className="w-10 h-5 rounded-full transition-colors duration-200 relative"
          style={{ backgroundColor: formData.autoReorderAlert ? `hsl(${accentColor})` : 'hsl(var(--muted))' }}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform duration-200 ${formData.autoReorderAlert ? 'left-[calc(100%-18px)]' : 'left-0.5'}`} />
        </button>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex-1 py-3 rounded-xl text-sm font-medium text-muted-foreground border border-border/50 hover:bg-secondary transition-colors">Back</button>
        <button type="button" onClick={onNext} className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all" style={{ backgroundColor: `hsl(${accentColor})`, color: 'hsl(var(--background))' }}>Review</button>
      </div>
    </div>
  );
}
