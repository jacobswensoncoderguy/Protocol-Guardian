import React from 'react';
import { Package, AlertTriangle, TrendingDown, Check, DollarSign } from 'lucide-react';
import { Compound } from '@/data/compounds';
import { getDaysRemainingWithCycling } from '@/lib/cycling';

interface InventoryHealthBarProps {
  compounds: Compound[];
  monthlyCost?: number;
}

const InventoryHealthBar: React.FC<InventoryHealthBarProps> = ({ compounds, monthlyCost }) => {
  const active = compounds.filter(c => !c.notes?.includes('[DORMANT]') && c.purchaseDate);

  const critical = active.filter(c => getDaysRemainingWithCycling(c) < 7).length;
  const warning = active.filter(c => {
    const d = getDaysRemainingWithCycling(c);
    return d >= 7 && d < 21;
  }).length;
  const healthy = active.length - critical - warning;

  const healthPct = active.length > 0 ? Math.round((healthy / active.length) * 100) : 100;
  const healthColor = healthPct >= 80 ? 'hsl(var(--neon-green))' : healthPct >= 50 ? 'hsl(var(--neon-amber))' : 'hsl(var(--destructive))';

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 mb-3">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-primary" />
          Inventory Health
        </p>
        <span className="text-sm font-mono font-bold" style={{ color: healthColor }}>
          {healthPct}%
        </span>
      </div>

      {/* Health bar */}
      <div className="h-2 bg-secondary/50 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${healthPct}%`,
            background: healthColor,
            boxShadow: `0 0 6px ${healthColor}44`,
          }}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-1.5">
        <div className="flex flex-col items-center p-1.5 rounded-lg bg-[hsl(var(--neon-green))]/5 border border-[hsl(var(--neon-green))]/15">
          <Check className="w-3 h-3 text-[hsl(var(--neon-green))] mb-0.5" />
          <span className="text-xs font-bold font-mono text-foreground">{healthy}</span>
          <span className="text-[7px] text-muted-foreground uppercase">Good</span>
        </div>
        <div className="flex flex-col items-center p-1.5 rounded-lg bg-[hsl(var(--neon-amber))]/5 border border-[hsl(var(--neon-amber))]/15">
          <TrendingDown className="w-3 h-3 text-[hsl(var(--neon-amber))] mb-0.5" />
          <span className="text-xs font-bold font-mono text-foreground">{warning}</span>
          <span className="text-[7px] text-muted-foreground uppercase">Low</span>
        </div>
        <div className="flex flex-col items-center p-1.5 rounded-lg bg-destructive/5 border border-destructive/15">
          <AlertTriangle className="w-3 h-3 text-destructive mb-0.5" />
          <span className="text-xs font-bold font-mono text-foreground">{critical}</span>
          <span className="text-[7px] text-muted-foreground uppercase">Critical</span>
        </div>
        {monthlyCost != null && (
          <div className="flex flex-col items-center p-1.5 rounded-lg bg-primary/5 border border-primary/15">
            <DollarSign className="w-3 h-3 text-primary mb-0.5" />
            <span className="text-xs font-bold font-mono text-foreground">${Math.round(monthlyCost)}</span>
            <span className="text-[7px] text-muted-foreground uppercase">/mo</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryHealthBar;
