import { Compound, getStatus, getReorderCost } from '@/data/compounds';
import { getDaysRemainingWithCycling, getEffectiveDailyConsumption } from '@/lib/cycling';
import { AlertTriangle, TrendingUp, DollarSign, Package } from 'lucide-react';

interface DashboardViewProps {
  compounds: Compound[];
}

function getAnnualProjectedCost(compounds: Compound[]): number {
  let total = 0;

  compounds.forEach(compound => {
    const daysLeft = getDaysRemainingWithCycling(compound);
    const cost = getReorderCost(compound);

    const effectiveDaily = getEffectiveDailyConsumption(compound);
    if (effectiveDaily === 0) return;

    const reorderUnits = compound.category === 'peptide'
      ? compound.reorderQuantity * 10
      : compound.reorderQuantity;
    const unitsPerUnit = compound.category === 'peptide' && compound.bacstatPerVial
      ? compound.bacstatPerVial
      : compound.unitSize;
    // Supply days adjusted for cycling (effective daily already accounts for ON fraction)
    const supplyDays = (reorderUnits * unitsPerUnit) / effectiveDaily;

    let nextReorderDay = daysLeft;
    while (nextReorderDay < 365) {
      total += cost;
      nextReorderDay += supplyDays;
      if (supplyDays > 9000) break;
    }
  });

  return total;
}

const DashboardView = ({ compounds }: DashboardViewProps) => {
  const totalAnnualCost = getAnnualProjectedCost(compounds);
  const criticalCompounds = compounds.filter(c => getStatus(getDaysRemainingWithCycling(c)) === 'critical');
  const warningCompounds = compounds.filter(c => getStatus(getDaysRemainingWithCycling(c)) === 'warning');
  const goodCompounds = compounds.filter(c => getStatus(getDaysRemainingWithCycling(c)) === 'good');

  const nextReorder = compounds
    .map(c => ({ name: c.name, days: getDaysRemainingWithCycling(c) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Est. Annual Cost"
          value={`$${Math.round(totalAnnualCost).toLocaleString()}`}
          accent="cyan"
        />
        <MetricCard
          icon={<Package className="w-4 h-4" />}
          label="Total Compounds"
          value={compounds.length.toString()}
          accent="cyan"
        />
        <MetricCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Need Reorder"
          value={criticalCompounds.length.toString()}
          accent={criticalCompounds.length > 0 ? 'red' : 'green'}
        />
        <MetricCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Running Low"
          value={warningCompounds.length.toString()}
          accent={warningCompounds.length > 0 ? 'orange' : 'green'}
        />
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Next Reorders */}
        <div className="bg-card rounded-lg border border-border/50 p-4">
          <h3 className="text-sm font-semibold mb-3 text-foreground">Next Reorders</h3>
          <div className="space-y-2">
            {nextReorder.map((item) => {
              const status = getStatus(item.days);
              return (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="text-foreground/80 truncate mr-2">{item.name}</span>
                  <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${
                    status === 'critical' ? 'bg-destructive/20 text-status-critical' :
                    status === 'warning' ? 'bg-accent/20 text-status-warning' :
                    'bg-status-good/10 text-status-good'
                  }`}>
                    {item.days}d
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Inventory Health */}
        <div className="bg-card rounded-lg border border-border/50 p-4">
          <h3 className="text-sm font-semibold mb-3 text-foreground">Inventory Health</h3>
          <div className="space-y-3">
            <HealthBar label="Good (30+ days)" count={goodCompounds.length} total={compounds.length} color="bg-status-good" />
            <HealthBar label="Warning (7-30 days)" count={warningCompounds.length} total={compounds.length} color="bg-status-warning" />
            <HealthBar label="Critical (<7 days)" count={criticalCompounds.length} total={compounds.length} color="bg-status-critical" />
          </div>
        </div>
      </div>

      {/* Critical Items */}
      {criticalCompounds.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-status-critical mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Order Now
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {criticalCompounds.map(c => (
              <div key={c.id} className="text-sm flex justify-between">
                <span className="text-foreground/80">{c.name}</span>
                <span className="font-mono text-status-critical">{getDaysRemainingWithCycling(c)}d left</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCard = ({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) => (
  <div className="bg-card rounded-lg border border-border/50 p-3 card-glow">
    <div className={`flex items-center gap-1.5 text-xs mb-1 ${
      accent === 'cyan' ? 'text-primary' :
      accent === 'orange' ? 'text-accent' :
      accent === 'red' ? 'text-status-critical' :
      'text-status-good'
    }`}>
      {icon}
      {label}
    </div>
    <div className="text-xl font-bold font-mono text-foreground">{value}</div>
  </div>
);

const HealthBar = ({ label, count, total, color }: { label: string; count: number; total: number; color: string }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{count}</span>
    </div>
    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }} />
    </div>
  </div>
);

export default DashboardView;
