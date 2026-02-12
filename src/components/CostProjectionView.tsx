import { useState } from 'react';
import { Compound, getDaysRemaining, getMonthlyConsumptionCost } from '@/data/compounds';

interface CostProjectionViewProps {
  compounds: Compound[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthData {
  month: number;
  name: string;
  compounds: { name: string; qty: number; unitPrice: number; cost: number }[];
  total: number;
}

function buildProjection(compounds: Compound[]): MonthData[] {
  const now = new Date();
  const months: MonthData[] = MONTHS.map((name, i) => ({
    month: i,
    name,
    compounds: [],
    total: 0,
  }));

  compounds.forEach(compound => {
    const daysLeft = getDaysRemaining(compound);
    const reorderDate = new Date(now.getTime() + daysLeft * 24 * 60 * 60 * 1000);
    const reorderMonth = reorderDate.getMonth();
    // Peptides: reorderQuantity = kits, each kit = 10 vials
    const actualUnits = compound.category === 'peptide'
      ? compound.reorderQuantity * 10
      : compound.reorderQuantity;
    const cost = actualUnits * compound.unitPrice;

    // Add initial reorder
    months[reorderMonth].compounds.push({
      name: compound.name,
      qty: actualUnits,
      unitPrice: compound.unitPrice,
      cost,
    });
    months[reorderMonth].total += cost;

    // Check if it needs another reorder within the year
    const dailyConsumption = (compound.dosePerUse * compound.dosesPerDay * compound.daysPerWeek) / 7;
    if (dailyConsumption > 0) {
      const unitsPerVial = compound.category === 'peptide' && compound.bacstatPerVial
        ? compound.bacstatPerVial
        : compound.unitSize;
      const supplyDays = (actualUnits * unitsPerVial) / dailyConsumption;
      const secondReorderDate = new Date(reorderDate.getTime() + supplyDays * 24 * 60 * 60 * 1000);
      if (secondReorderDate.getFullYear() === now.getFullYear() || (secondReorderDate.getFullYear() === now.getFullYear() + 1 && secondReorderDate.getMonth() < now.getMonth())) {
        const secondMonth = secondReorderDate.getMonth();
        if (secondMonth !== reorderMonth) {
          months[secondMonth].compounds.push({
            name: compound.name,
            qty: actualUnits,
            unitPrice: compound.unitPrice,
            cost,
          });
          months[secondMonth].total += cost;
        }
      }
    }
  });

  return months;
}

const CostProjectionView = ({ compounds }: CostProjectionViewProps) => {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
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
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {projection.map((month) => {
          const color = month.total === 0 ? 'bg-secondary' :
            month.total < 200 ? 'bg-status-good/15 border-status-good/30' :
            month.total < 500 ? 'bg-accent/15 border-accent/30' :
            'bg-destructive/15 border-destructive/30';

          return (
            <button
              key={month.month}
              onClick={() => setSelectedMonth(selectedMonth === month.month ? null : month.month)}
              className={`rounded-lg border p-2.5 text-center transition-all hover:scale-105 ${color} ${
                selectedMonth === month.month ? 'ring-1 ring-primary' : 'border-border/50'
              }`}
            >
              <p className="text-xs font-semibold text-foreground">{month.name}</p>
              <p className={`text-sm font-bold font-mono mt-0.5 ${
                month.total === 0 ? 'text-muted-foreground' :
                month.total < 200 ? 'text-status-good' :
                month.total < 500 ? 'text-status-warning' :
                'text-status-critical'
              }`}>
                ${Math.round(month.total)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {month.compounds.length} item{month.compounds.length !== 1 ? 's' : ''}
              </p>
            </button>
          );
        })}
      </div>

      {/* Month Detail */}
      {selectedMonth !== null && (
        <div className="bg-card rounded-lg border border-border/50 p-4 animate-slide-up">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {MONTHS[selectedMonth]} Reorder Breakdown
          </h3>
          {projection[selectedMonth].compounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reorders projected this month.</p>
          ) : (
            <div className="space-y-1.5">
              {projection[selectedMonth].compounds.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-secondary/50 rounded px-3 py-1.5">
                  <span className="text-foreground/80 truncate mr-2">{item.name}</span>
                  <div className="flex items-center gap-3 text-xs font-mono flex-shrink-0">
                    <span className="text-muted-foreground">×{item.qty}</span>
                    <span className="text-muted-foreground">@${item.unitPrice}</span>
                    <span className="text-primary font-semibold">${item.cost}</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-border/50 text-sm font-semibold">
                <span className="text-foreground">Total</span>
                <span className="font-mono text-primary">${Math.round(projection[selectedMonth].total)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CostProjectionView;
