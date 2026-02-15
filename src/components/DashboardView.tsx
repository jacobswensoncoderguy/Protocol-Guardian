import { useState } from 'react';
import { Compound, getStatus, getReorderCost } from '@/data/compounds';
import { getDaysRemainingWithCycling, getEffectiveDailyConsumption } from '@/lib/cycling';
import { AlertTriangle, TrendingUp, DollarSign, Package, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CompoundInfoDrawer from '@/components/CompoundInfoDrawer';
import ProtocolOutcomesCard from '@/components/ProtocolOutcomesCard';
import ProtocolIntelligenceCard from '@/components/ProtocolIntelligenceCard';
import { StackAnalysis } from '@/hooks/useProtocolAnalysis';

interface DashboardViewProps {
  compounds: Compound[];
  stackAnalysis?: StackAnalysis | null;
  aiLoading?: boolean;
  needsRefresh?: boolean;
  toleranceLevel?: string;
  onAnalyzeStack?: () => void;
  onViewAIInsights?: () => void;
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

type TileType = 'cost' | 'total' | 'reorder' | 'low' | null;

const DashboardView = ({ compounds, stackAnalysis, aiLoading, needsRefresh, toleranceLevel, onAnalyzeStack, onViewAIInsights }: DashboardViewProps) => {
  const [activeTile, setActiveTile] = useState<TileType>(null);
  const [selectedCompound, setSelectedCompound] = useState<Compound | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const totalAnnualCost = getAnnualProjectedCost(compounds);
  const criticalCompounds = compounds.filter(c => getStatus(getDaysRemainingWithCycling(c)) === 'critical');
  const warningCompounds = compounds.filter(c => getStatus(getDaysRemainingWithCycling(c)) === 'warning');
  const goodCompounds = compounds.filter(c => getStatus(getDaysRemainingWithCycling(c)) === 'good');

  const nextReorder = compounds
    .map(c => ({ compound: c, name: c.name, days: getDaysRemainingWithCycling(c) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  const handleCompoundClick = (compound: Compound) => {
    setSelectedCompound(compound);
    setDrawerOpen(true);
  };

  const tileDialogContent = () => {
    switch (activeTile) {
      case 'cost':
        const costBreakdown = compounds
          .map(c => {
            const effectiveDaily = getEffectiveDailyConsumption(c);
            if (effectiveDaily === 0) return null;
            const daysLeft = getDaysRemainingWithCycling(c);
            const cost = getReorderCost(c);
            const reorderUnits = c.category === 'peptide' ? c.reorderQuantity * 10 : c.reorderQuantity;
            const unitsPerUnit = c.category === 'peptide' && c.bacstatPerVial ? c.bacstatPerVial : c.unitSize;
            const supplyDays = (reorderUnits * unitsPerUnit) / effectiveDaily;
            let annual = 0;
            let nextDay = daysLeft;
            while (nextDay < 365) { annual += cost; nextDay += supplyDays; if (supplyDays > 9000) break; }
            return { compound: c, annual };
          })
          .filter(Boolean)
          .sort((a, b) => b!.annual - a!.annual) as { compound: Compound; annual: number }[];
        return (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {costBreakdown.map(item => (
              <button key={item.compound.id} onClick={() => handleCompoundClick(item.compound)} className="flex justify-between w-full text-sm hover:bg-secondary/50 rounded px-2 py-1.5 transition-colors text-left">
                <span className="text-foreground/80 truncate mr-2">{item.compound.name}</span>
                <span className="font-mono text-primary flex-shrink-0">${Math.round(item.annual).toLocaleString()}</span>
              </button>
            ))}
          </div>
        );
      case 'total':
        const grouped = {
          peptide: compounds.filter(c => c.category === 'peptide'),
          'injectable-oil': compounds.filter(c => c.category === 'injectable-oil'),
          oral: compounds.filter(c => c.category === 'oral'),
          powder: compounds.filter(c => c.category === 'powder'),
        };
        return (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {Object.entries(grouped).map(([cat, items]) => items.length > 0 && (
              <div key={cat}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{cat.replace('-', ' ')}s ({items.length})</p>
                {items.map(c => (
                  <button key={c.id} onClick={() => handleCompoundClick(c)} className="flex justify-between w-full text-sm hover:bg-secondary/50 rounded px-2 py-1 transition-colors text-left">
                    <span className="text-foreground/80 truncate mr-2">{c.name}</span>
                    <span className={`font-mono text-xs ${getStatus(getDaysRemainingWithCycling(c)) === 'critical' ? 'text-status-critical' : getStatus(getDaysRemainingWithCycling(c)) === 'warning' ? 'text-status-warning' : 'text-status-good'}`}>{getDaysRemainingWithCycling(c)}d</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        );
      case 'reorder':
        return (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {criticalCompounds.length === 0 && <p className="text-sm text-muted-foreground">No compounds need reordering 🎉</p>}
            {criticalCompounds.map(c => (
              <button key={c.id} onClick={() => handleCompoundClick(c)} className="flex justify-between w-full text-sm hover:bg-secondary/50 rounded px-2 py-1.5 transition-colors text-left">
                <span className="text-foreground/80 truncate mr-2">{c.name}</span>
                <div className="flex gap-2 flex-shrink-0">
                  <span className="font-mono text-status-critical text-xs">{getDaysRemainingWithCycling(c)}d left</span>
                  <span className="font-mono text-primary text-xs">${getReorderCost(c)}</span>
                </div>
              </button>
            ))}
          </div>
        );
      case 'low':
        return (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {warningCompounds.length === 0 && <p className="text-sm text-muted-foreground">All compounds well stocked 🎉</p>}
            {warningCompounds.map(c => (
              <button key={c.id} onClick={() => handleCompoundClick(c)} className="flex justify-between w-full text-sm hover:bg-secondary/50 rounded px-2 py-1.5 transition-colors text-left">
                <span className="text-foreground/80 truncate mr-2">{c.name}</span>
                <span className="font-mono text-status-warning text-xs">{getDaysRemainingWithCycling(c)}d left</span>
              </button>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  const tileTitle = activeTile === 'cost' ? 'Annual Cost Breakdown' : activeTile === 'total' ? 'All Compounds' : activeTile === 'reorder' ? 'Need Reorder (<7 days)' : 'Running Low (7-30 days)';

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Est. Annual Cost"
          value={`$${Math.round(totalAnnualCost).toLocaleString()}`}
          accent="cyan"
          onClick={() => setActiveTile('cost')}
        />
        <MetricCard
          icon={<Package className="w-4 h-4" />}
          label="Total Compounds"
          value={compounds.length.toString()}
          accent="cyan"
          onClick={() => setActiveTile('total')}
        />
        <MetricCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Need Reorder"
          value={criticalCompounds.length.toString()}
          accent={criticalCompounds.length > 0 ? 'red' : 'green'}
          onClick={() => setActiveTile('reorder')}
        />
        <MetricCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Running Low"
          value={warningCompounds.length.toString()}
          accent={warningCompounds.length > 0 ? 'orange' : 'green'}
          onClick={() => setActiveTile('low')}
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
                <button key={item.name} onClick={() => handleCompoundClick(item.compound)} className="flex items-center justify-between text-sm w-full hover:bg-secondary/50 rounded px-2 py-1 transition-colors text-left">
                  <span className="text-foreground/80 truncate mr-2">{item.name}</span>
                  <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${
                    status === 'critical' ? 'bg-destructive/20 text-status-critical' :
                    status === 'warning' ? 'bg-accent/20 text-status-warning' :
                    'bg-status-good/10 text-status-good'
                  }`}>
                    {item.days}d
                  </span>
                </button>
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

      {/* Protocol Intelligence */}
      {onAnalyzeStack && (
        <ProtocolIntelligenceCard
          analysis={stackAnalysis ?? null}
          loading={aiLoading ?? false}
          needsRefresh={needsRefresh ?? false}
          toleranceLevel={toleranceLevel}
          onRefresh={onAnalyzeStack}
          onViewDetails={onViewAIInsights ?? (() => {})}
        />
      )}

      {/* Protocol Outcomes */}
      <ProtocolOutcomesCard />

      {/* Critical Items */}
      {criticalCompounds.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-status-critical mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Order Now
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {criticalCompounds.map(c => (
              <button key={c.id} onClick={() => handleCompoundClick(c)} className="text-sm flex justify-between hover:bg-destructive/10 rounded px-2 py-1 transition-colors text-left">
                <span className="text-foreground/80">{c.name}</span>
                <span className="font-mono text-status-critical">{getDaysRemainingWithCycling(c)}d left</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tile Detail Dialog */}
      <Dialog open={activeTile !== null} onOpenChange={(open) => !open && setActiveTile(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">{tileTitle}</DialogTitle>
          </DialogHeader>
          {tileDialogContent()}
        </DialogContent>
      </Dialog>

      <CompoundInfoDrawer
        compound={selectedCompound}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
};

const MetricCard = ({ icon, label, value, accent, onClick }: { icon: React.ReactNode; label: string; value: string; accent: string; onClick: () => void }) => (
  <button onClick={onClick} className="bg-card rounded-lg border border-border/50 p-3 card-glow text-left w-full cursor-pointer">
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
  </button>
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
