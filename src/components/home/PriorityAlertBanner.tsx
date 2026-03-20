import React, { useState } from 'react';
import { AlertTriangle, X, ChevronRight } from 'lucide-react';
import { Compound, getStatus } from '@/data/compounds';
import { getDaysRemainingWithCycling } from '@/lib/cycling';
import { UserGoal } from '@/hooks/useGoals';

interface PriorityAlertBannerProps {
  compounds: Compound[];
  complianceRate: number;
  goals?: UserGoal[];
  hasCheckedInToday?: boolean;
  onOpenBreakdown?: () => void;
}

interface Alert {
  id: string;
  label: string;
  detail: string;
  severity: 'critical' | 'warning';
}

const PriorityAlertBanner: React.FC<PriorityAlertBannerProps> = ({
  compounds, complianceRate, goals = [], hasCheckedInToday = true, onOpenBreakdown,
}) => {
  const [dismissed, setDismissed] = useState(false);

  const alerts: Alert[] = [];

  // Low compliance
  if (complianceRate < 50) {
    alerts.push({ id: 'compliance', label: 'Low Compliance', detail: `${Math.round(complianceRate)}% today`, severity: 'critical' });
  }

  // Critically low inventory
  compounds.forEach(c => {
    if (c.notes?.includes('[DORMANT]') || !c.purchaseDate) return;
    const days = getDaysRemainingWithCycling(c);
    if (days < 3) {
      alerts.push({ id: `inv-${c.id}`, label: `${c.name} critically low`, detail: `${Math.round(days)}d remaining`, severity: 'critical' });
    }
  });

  // Goal deadline approaching
  goals.forEach(g => {
    if (g.status !== 'active' || !g.target_date || !g.target_value) return;
    const daysLeft = Math.ceil((new Date(g.target_date).getTime() - Date.now()) / 86400000);
    const progress = g.current_value && g.baseline_value && g.target_value
      ? Math.abs((g.current_value - g.baseline_value) / (g.target_value - g.baseline_value)) * 100
      : 0;
    if (daysLeft <= 14 && daysLeft > 0 && progress < 50) {
      alerts.push({ id: `goal-${g.id}`, label: `${g.title} at risk`, detail: `${daysLeft}d left, ${Math.round(progress)}% done`, severity: 'warning' });
    }
  });

  // No check-in past 10am
  const hour = new Date().getHours();
  if (!hasCheckedInToday && hour >= 10) {
    alerts.push({ id: 'checkin', label: 'Daily check-in pending', detail: 'Log energy, mood, sleep & pain', severity: 'warning' });
  }

  if (alerts.length === 0 || dismissed) return null;

  return (
    <button
      onClick={onOpenBreakdown}
      className="w-full relative rounded-[14px] border border-destructive/30 bg-gradient-to-r from-destructive/15 to-destructive/5 p-3.5 text-left transition-all active:scale-[0.98]"
      style={{ borderLeftWidth: '3px', borderLeftColor: 'hsl(var(--destructive))' }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
        className="absolute top-2.5 right-2.5 p-1 rounded-full hover:bg-destructive/20 text-muted-foreground transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-destructive mb-1">
            {alerts.length} Alert{alerts.length > 1 ? 's' : ''} Requiring Attention
          </p>
          <div className="space-y-0.5">
            {alerts.slice(0, 3).map(a => (
              <p key={a.id} className="text-[10px] text-muted-foreground truncate">
                <span className={a.severity === 'critical' ? 'text-destructive' : 'text-status-warning'}>●</span>{' '}
                {a.label} — {a.detail}
              </p>
            ))}
            {alerts.length > 3 && (
              <p className="text-[10px] text-muted-foreground/60">+{alerts.length - 3} more</p>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/40 mt-1 flex-shrink-0" />
      </div>
    </button>
  );
};

export default PriorityAlertBanner;
