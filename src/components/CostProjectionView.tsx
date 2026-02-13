import { useState } from 'react';
import { Compound, getReorderCost, getMonthlyConsumptionCost } from '@/data/compounds';
import { getDaysRemainingWithCycling, getEffectiveDailyConsumption } from '@/lib/cycling';

interface CostProjectionViewProps {
  compounds: Compound[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthData {
  month: number;
  year: number;
  name: string;
  compounds: { name: string; qty: string; unitPrice: number; cost: number }[];
  total: number;
}

function getReorderSupplyDays(compound: Compound): number {
  const effectiveDaily = getEffectiveDailyConsumption(compound);
  if (effectiveDaily === 0) return 9999;

  const reorderUnits = compound.category === 'peptide'
    ? compound.reorderQuantity * 10
    : compound.reorderQuantity;
  const unitsPerUnit = compound.category === 'peptide' && compound.bacstatPerVial
    ? compound.bacstatPerVial
    : compound.unitSize;
  return (reorderUnits * unitsPerUnit) / effectiveDaily;
}

function buildProjection(compounds: Compound[]): MonthData[] {
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

  compounds.forEach(compound => {
    const daysLeft = getDaysRemainingWithCycling(compound);
    const cost = getReorderCost(compound);
    const displayQty = compound.category === 'peptide'
      ? `${compound.reorderQuantity} kit${compound.reorderQuantity !== 1 ? 's' : ''}`
      : `${compound.reorderQuantity}`;
    const displayPrice = compound.category === 'peptide'
      ? (compound.kitPrice || 0)
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
          cost,
        });
        months[slotIndex].total += cost;
      }

      nextReorderDay += supplyDays;
      if (supplyDays > 9000) break;
    }
  });

  return months;
}

const CostProjectionView = ({ compounds }: CostProjectionViewProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const projection = buildProjection(compounds);
  const totalAnnual = projection.reduce((sum, m) => sum + m.total, 0);
  const monthlyAvg = compounds.reduce((sum, c) => sum + getMonthlyConsumptionCost(c), 0);

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
            <div className="space-y-1.5">
              {projection[selectedIndex].compounds.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-secondary/50 rounded px-3 py-1.5">
                  <span className="text-foreground/80 truncate mr-2">{item.name}</span>
                  <div className="flex items-center gap-3 text-xs font-mono flex-shrink-0">
                    <span className="text-muted-foreground">{item.qty}</span>
                    <span className="text-muted-foreground">@${item.unitPrice}</span>
                    <span className="text-primary font-semibold">${item.cost}</span>
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
    </div>
  );
};

export default CostProjectionView;
