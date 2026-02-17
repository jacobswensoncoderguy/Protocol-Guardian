import { useState } from 'react';
import { Compound, getReorderCost, getNormalizedDailyConsumption } from '@/data/compounds';
import { getDaysRemainingWithCycling, getEffectiveDailyConsumption, getCycleStatus } from '@/lib/cycling';
import { UserProtocol } from '@/hooks/useProtocols';
import { CustomField } from '@/hooks/useCustomFields';
import { TrendingDown, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface CostModifiers {
  shippingCost: number; // flat $ per reorder
  discountPct: number;  // percentage discount (0-100)
  dosesPerDayOverride: number | null; // override base dosesPerDay
}

interface CostProjectionViewProps {
  compounds: Compound[];
  protocols?: UserProtocol[];
  customFields?: CustomField[];
  customFieldValues?: Map<string, Map<string, string>>; // compoundId -> fieldId -> value
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthData {
  month: number;
  year: number;
  name: string;
  compounds: { name: string; qty: string; unitPrice: number; cost: number; compoundId: string }[];
  total: number;
}

function getReorderSupplyDays(compound: Compound): number {
  const effectiveDaily = getEffectiveDailyConsumption(compound);
  if (effectiveDaily === 0) return 9999;

  const reorderUnits = compound.category === 'peptide'
    ? (compound.reorderType === 'single' ? compound.reorderQuantity : compound.reorderQuantity * 10)
    : compound.reorderQuantity;
  const unitsPerUnit = compound.category === 'peptide' && compound.bacstatPerVial
    ? compound.bacstatPerVial
    : compound.category === 'injectable-oil' && compound.vialSizeMl
      ? compound.unitSize * compound.vialSizeMl
      : compound.unitSize;
  return (reorderUnits * unitsPerUnit) / effectiveDaily;
}

function buildProjection(compounds: Compound[], getModifiers: (compoundId: string) => CostModifiers): MonthData[] {
  // Apply dosesPerDay overrides to compounds for accurate projection
  const effectiveCompounds = compounds.map(c => {
    const mods = getModifiers(c.id);
    if (mods.dosesPerDayOverride !== null) {
      return { ...c, dosesPerDay: mods.dosesPerDayOverride };
    }
    return c;
  });
  const now = new Date();
  const startMonth = now.getMonth();
  const startYear = now.getFullYear();

  const months: MonthData[] = Array.from({ length: 12 }, (_, i) => {
    const m = (startMonth + i) % 12;
    const y = startYear + Math.floor((startMonth + i) / 12);
    return { month: m, year: y, name: MONTHS[m], compounds: [], total: 0 };
  });

  const endDate = new Date(now);
  endDate.setFullYear(endDate.getFullYear() + 1);

  effectiveCompounds.forEach(compound => {
    const daysLeft = getDaysRemainingWithCycling(compound);
    const baseCost = getReorderCost(compound);
    const mods = getModifiers(compound.id);
    // Apply discount then add shipping
    const adjustedCost = Math.round((baseCost * (1 - mods.discountPct / 100) + mods.shippingCost) * 100) / 100;
    const isSingleUnit = compound.reorderType === 'single';
    const displayQty = compound.category === 'peptide'
      ? isSingleUnit
        ? `${compound.reorderQuantity} vial${compound.reorderQuantity !== 1 ? 's' : ''}`
        : `${compound.reorderQuantity} kit${compound.reorderQuantity !== 1 ? 's' : ''}`
      : compound.category === 'injectable-oil'
        ? `${compound.reorderQuantity} vial${compound.reorderQuantity !== 1 ? 's' : ''}`
        : (() => {
            const ul = (compound.unitLabel || '').toLowerCase();
            let container = 'bottle';
            if (ul.includes('scoop') || ul.includes('serving') || ul.includes('g') || ul === 'oz') container = 'bag';
            if (compound.reorderType === 'kit') container = 'kit';
            return `${compound.reorderQuantity} ${container}${compound.reorderQuantity !== 1 ? 's' : ''}`;
          })();
    const displayPrice = compound.category === 'peptide'
      ? isSingleUnit ? compound.unitPrice : (compound.kitPrice || 0)
      : compound.unitPrice;

    const supplyDays = getReorderSupplyDays(compound);
    let nextReorderDay = daysLeft;

    while (nextReorderDay < 365) {
      const reorderDate = new Date(now.getTime() + nextReorderDay * 24 * 60 * 60 * 1000);
      if (reorderDate >= endDate) break;

      const rm = reorderDate.getMonth();
      const ry = reorderDate.getFullYear();
      const slotIndex = months.findIndex(s => s.month === rm && s.year === ry);

      if (slotIndex !== -1) {
        months[slotIndex].compounds.push({
          name: compound.name,
          qty: displayQty,
          unitPrice: displayPrice,
          cost: adjustedCost,
          compoundId: compound.id,
        });
        months[slotIndex].total += adjustedCost;
      }

      nextReorderDay += supplyDays;
      if (supplyDays > 9000) break;
    }
  });

  return months;
}

function groupItemsByProtocol(
  items: MonthData['compounds'],
  protocols: UserProtocol[]
): { label: string; items: MonthData['compounds'] }[] {
  const groups: { label: string; items: MonthData['compounds'] }[] = [];
  const protocolIds = new Set<string>();

  protocols.forEach(p => {
    const pItems = items.filter(item => p.compoundIds.includes(item.compoundId));
    if (pItems.length > 0) {
      groups.push({ label: `${p.icon} ${p.name}`, items: pItems });
      pItems.forEach(item => protocolIds.add(item.compoundId));
    }
  });

  const ungrouped = items.filter(item => !protocolIds.has(item.compoundId));
  if (ungrouped.length > 0) {
    groups.push({ label: 'Other Compounds', items: ungrouped });
  }

  return groups.length > 0 ? groups : [{ label: '', items }];
}

const CostProjectionView = ({ compounds, protocols = [], customFields = [], customFieldValues = new Map() }: CostProjectionViewProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showSavings, setShowSavings] = useState(false);

  // Build a per-compound cost modifier getter from custom field values
  const getModifiers = (compoundId: string): CostModifiers => {
    const vals = customFieldValues.get(compoundId);
    if (!vals) return { shippingCost: 0, discountPct: 0, dosesPerDayOverride: null };
    
    let shippingCost = 0;
    let discountPct = 0;
    let dosesPerDayOverride: number | null = null;
    
    customFields.forEach(f => {
      const v = vals.get(f.id);
      if (!v) return;
      const num = parseFloat(v);
      if (isNaN(num)) return;
      
      if (f.field_name === 'Shipping Cost' && f.affects_calculation) {
        shippingCost = num;
      } else if (f.field_name === 'Discount %' && f.affects_calculation) {
        discountPct = Math.min(100, Math.max(0, num));
      } else if (f.field_name === 'Doses Per Day' && f.affects_calculation && num > 0) {
        dosesPerDayOverride = num;
      }
    });
    
    return { shippingCost, discountPct, dosesPerDayOverride };
  };

  const projection = buildProjection(compounds, getModifiers);
  const totalAnnual = projection.reduce((sum, m) => sum + m.total, 0);
  const monthlyAvg = compounds.reduce((sum, c) => {
    const mods = getModifiers(c.id);
    // Apply dosesPerDay override for monthly burn calculation
    const effectiveCompound = mods.dosesPerDayOverride !== null
      ? { ...c, dosesPerDay: mods.dosesPerDayOverride }
      : c;
    const effectiveDaily = getEffectiveDailyConsumption(effectiveCompound);
    if (effectiveDaily === 0) return sum;
    const monthlyConsumption = effectiveDaily * 30;

    if (c.category === 'peptide' && c.bacstatPerVial) {
      const vialsPerMonth = monthlyConsumption / c.bacstatPerVial;
      const kitsPerMonth = vialsPerMonth / 10;
      const baseCost = kitsPerMonth * (c.kitPrice || 0);
      return sum + baseCost * (1 - mods.discountPct / 100) + mods.shippingCost;
    }

    const totalMgPerUnit = c.category === 'injectable-oil' && c.vialSizeMl
      ? c.unitSize * c.vialSizeMl : c.unitSize;
    const unitsPerMonth = monthlyConsumption / totalMgPerUnit;
    const baseCost = unitsPerMonth * c.unitPrice;
    return sum + baseCost * (1 - mods.discountPct / 100) + mods.shippingCost;
  }, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-lg border border-border/50 p-3">
          <p className="text-xs text-muted-foreground">Est. Annual Total</p>
          <p className="text-xl font-bold font-mono text-primary">${Math.round(totalAnnual).toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-lg border border-border/50 p-3">
          <p className="text-xs text-muted-foreground">Monthly Avg Burn</p>
          <p className="text-xl font-bold font-mono text-accent">${Math.round(monthlyAvg).toLocaleString()}</p>
        </div>
      </div>

      {/* Month Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2">
        {projection.map((month, idx) => {
          const color = month.total === 0 ? 'bg-secondary' :
            month.total < 200 ? 'bg-status-good/15 border-status-good/30' :
            month.total < 500 ? 'bg-accent/15 border-accent/30' :
            'bg-destructive/15 border-destructive/30';

          return (
            <button
              key={idx}
              onClick={() => setSelectedIndex(selectedIndex === idx ? null : idx)}
              className={`rounded-lg border p-2 sm:p-2.5 text-center transition-all active:scale-95 touch-manipulation ${color} ${
                selectedIndex === idx ? 'ring-1 ring-primary' : 'border-border/50'
              }`}
            >
              <p className="text-[11px] sm:text-xs font-semibold text-foreground">{month.name}</p>
              <p className={`text-xs sm:text-sm font-bold font-mono mt-0.5 ${
                month.total === 0 ? 'text-muted-foreground' :
                month.total < 200 ? 'text-status-good' :
                month.total < 500 ? 'text-status-warning' :
                'text-status-critical'
              }`}>
                ${Math.round(month.total)}
              </p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">
                {month.compounds.length}
              </p>
            </button>
          );
        })}
      </div>

      {/* Month Detail */}
      {selectedIndex !== null && (
        <div className="bg-card rounded-lg border border-border/50 p-4 animate-slide-up">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {projection[selectedIndex].name} Reorder Breakdown
          </h3>
          {projection[selectedIndex].compounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reorders projected this month.</p>
          ) : (
            <div className="space-y-3">
              {groupItemsByProtocol(projection[selectedIndex].compounds, protocols).map((group) => (
                <div key={group.label}>
                  {group.label && (
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{group.label}</p>
                  )}
                  <div className="space-y-1.5">
                    {group.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-secondary/50 rounded px-3 py-1.5">
                        <span className="text-foreground/80 truncate mr-2">{item.name}</span>
                        <div className="flex items-center gap-3 text-xs font-mono flex-shrink-0">
                          <span className="text-muted-foreground">{item.qty}</span>
                          <span className="text-muted-foreground">@${item.unitPrice}</span>
                          <span className="text-primary font-semibold">${item.cost}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-border/50 text-sm font-semibold">
                <span className="text-foreground">Total</span>
                <span className="font-mono text-primary">${Math.round(projection[selectedIndex].total)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cycling Savings Breakdown */}
      {(() => {
        const cyclingCompounds = compounds.filter(c => {
          const status = getCycleStatus(c);
          return status.hasCycle && status.onFraction < 1;
        });
        if (cyclingCompounds.length === 0) return null;

        const savings = cyclingCompounds.map(c => {
          const status = getCycleStatus(c);
          const rawDaily = getNormalizedDailyConsumption(c);
          const monthlyRaw = rawDaily * 30;
          const monthlyCycled = monthlyRaw * status.onFraction;

          const calcMonthlyCost = (monthly: number) => {
            if (c.category === 'peptide' && c.bacstatPerVial) {
              const vialsPerMonth = monthly / c.bacstatPerVial;
              const kitsPerMonth = vialsPerMonth / 10;
              return kitsPerMonth * (c.kitPrice || 0);
            }
            const totalMg = c.category === 'injectable-oil' && c.vialSizeMl
              ? c.unitSize * c.vialSizeMl : c.unitSize;
            const unitsPerMonth = monthly / totalMg;
            return unitsPerMonth * c.unitPrice;
          };

          const continuousCost = calcMonthlyCost(monthlyRaw);
          const cycledCost = calcMonthlyCost(monthlyCycled);
          const saved = continuousCost - cycledCost;

          return {
            name: c.name,
            id: c.id,
            onFraction: status.onFraction,
            cyclePattern: `${c.cycleOnDays}/${c.cycleOffDays}`,
            continuousCost,
            cycledCost,
            saved,
            annualSaved: saved * 12,
          };
        }).sort((a, b) => b.annualSaved - a.annualSaved);

        const totalAnnualSaved = savings.reduce((sum, s) => sum + s.annualSaved, 0);

        // Group savings by protocol
        const savingsGroups: { label: string; items: typeof savings }[] = [];
        const protocolIds = new Set<string>();
        protocols.forEach(p => {
          const pItems = savings.filter(s => p.compoundIds.includes(s.id));
          if (pItems.length > 0) {
            savingsGroups.push({ label: `${p.icon} ${p.name}`, items: pItems });
            pItems.forEach(s => protocolIds.add(s.id));
          }
        });
        const ungroupedSavings = savings.filter(s => !protocolIds.has(s.id));
        if (ungroupedSavings.length > 0) {
          savingsGroups.push({ label: 'Other', items: ungroupedSavings });
        }
        const finalGroups = savingsGroups.length > 0 ? savingsGroups : [{ label: '', items: savings }];

        return (
          <div className="bg-card rounded-lg border border-border/50 overflow-hidden">
            <button
              onClick={() => setShowSavings(!showSavings)}
              className="w-full flex items-center justify-between p-3 text-left active:bg-secondary/30 touch-manipulation"
            >
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-status-good" />
                <span className="text-sm font-semibold text-foreground">Cycling Savings</span>
                <span className="text-xs text-muted-foreground">({savings.length} compounds)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-mono text-status-good">
                  -${Math.round(totalAnnualSaved).toLocaleString()}/yr
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${showSavings ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {showSavings && (
              <div className="border-t border-border/50 p-3 space-y-3">
                {finalGroups.map((group) => (
                  <div key={group.label}>
                    {group.label && (
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{group.label}</p>
                    )}
                    <div className="space-y-1.5">
                      {group.items.map((s, i) => (
                        <div key={i} className="flex items-center justify-between bg-secondary/30 rounded px-3 py-2">
                          <div className="truncate mr-2">
                            <span className="text-xs text-foreground/80">{s.name}</span>
                            <span className="text-[10px] text-muted-foreground ml-1.5">{s.cyclePattern} days</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono flex-shrink-0">
                            <span className="text-muted-foreground line-through">${Math.round(s.continuousCost)}</span>
                            <span className="text-foreground">${Math.round(s.cycledCost)}</span>
                            <span className="text-status-good font-semibold">-${Math.round(s.saved)}/mo</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-border/50 text-sm font-semibold">
                  <span className="text-foreground">Total Annual Savings</span>
                  <span className="font-mono text-status-good">-${Math.round(totalAnnualSaved).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default CostProjectionView;
