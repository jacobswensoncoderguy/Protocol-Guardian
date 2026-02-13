import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Compound } from '@/data/compounds';
import { compoundBenefits } from '@/data/compoundBenefits';
import { getCycleStatus } from '@/lib/cycling';
import { getDaysRemainingWithCycling } from '@/lib/cycling';
import { getStatus } from '@/data/compounds';
import { Info } from 'lucide-react';

interface CompoundInfoDrawerProps {
  compound: Compound | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CompoundInfoDrawer = ({ compound, open, onOpenChange }: CompoundInfoDrawerProps) => {
  if (!compound) return null;

  const benefits = compoundBenefits[compound.id];
  const cycleStatus = getCycleStatus(compound);
  const daysLeft = getDaysRemainingWithCycling(compound);
  const status = getStatus(daysLeft);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto bg-card border-border rounded-t-2xl">
        <SheetHeader className="text-left pb-2">
          <SheetTitle className="flex items-center gap-3 text-foreground">
            <span className="text-3xl">{benefits?.icon || '💊'}</span>
            <div>
              <div className="text-lg font-bold">{compound.name}</div>
              <div className="text-xs text-muted-foreground font-normal capitalize">{compound.category.replace('-', ' ')}</div>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Status bar */}
        <div className="flex gap-2 flex-wrap mt-2 mb-4">
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
            status === 'critical' ? 'bg-destructive/20 text-status-critical' :
            status === 'warning' ? 'bg-accent/20 text-status-warning' :
            'bg-status-good/10 text-status-good'
          }`}>
            {daysLeft}d supply
          </span>
          {cycleStatus.hasCycle && (
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              cycleStatus.isOn ? 'bg-status-good/10 text-status-good' : 'bg-accent/20 text-status-warning'
            }`}>
              {cycleStatus.phaseLabel}
            </span>
          )}
          {compound.timingNote && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {compound.timingNote}
            </span>
          )}
        </div>

        {/* Benefits */}
        {benefits ? (
          <div className="space-y-2.5">
            {benefits.benefits.map((b, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <span className="text-primary text-xs mt-0.5">●</span>
                <p className="text-sm text-foreground/85 leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Info className="w-4 h-4" />
            <span>No benefit data available for this compound yet.</span>
          </div>
        )}

        {/* Cycling note */}
        {compound.cyclingNote && (
          <div className="mt-4 p-3 rounded-lg bg-secondary/50 border border-border/50">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/80">Cycling:</span> {compound.cyclingNote}
            </p>
          </div>
        )}

        {/* Notes */}
        {compound.notes && (
          <div className="mt-3 p-3 rounded-lg bg-secondary/50 border border-border/50">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/80">Notes:</span> {compound.notes}
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CompoundInfoDrawer;
