import { ArrowRight, Check, X, Zap, Info } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ProposedChange } from '@/hooks/useProtocolChat';
import { Compound } from '@/data/compounds';

interface ProtocolChangeConfirmSheetProps {
  open: boolean;
  change: ProposedChange | null;
  compound: Compound | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const fieldLabel = (field?: string) => {
  switch (field) {
    case 'dosePerUse': return 'Dose per Use';
    case 'dosesPerDay': return 'Doses per Day';
    case 'daysPerWeek': return 'Days per Week';
    case 'cycleOnDays': return 'Cycle On Days';
    case 'cycleOffDays': return 'Cycle Off Days';
    case 'timingNote': return 'Timing';
    case 'cyclingNote': return 'Cycling Note';
    default: return field || 'Value';
  }
};

const ProtocolChangeConfirmSheet = ({
  open,
  change,
  compound,
  onConfirm,
  onCancel,
}: ProtocolChangeConfirmSheetProps) => {
  if (!change) return null;

  const isRemove = change.type === 'remove_compound';
  const isAdd = change.type === 'add_compound';

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Zap className="w-4 h-4 text-primary" />
            Confirm Protocol Change
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Review the details below before locking in this adjustment. Changes will cascade to inventory, schedule, costs, and logging.
          </SheetDescription>
        </SheetHeader>

        {/* Change summary */}
        <div className={`rounded-lg border p-4 mb-4 ${
          isRemove ? 'border-destructive/40 bg-destructive/5' :
          isAdd ? 'border-status-good/40 bg-status-good/5' :
          'border-primary/30 bg-primary/5'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
              isRemove ? 'bg-destructive/20 text-status-critical' :
              isAdd ? 'bg-status-good/20 text-status-good' :
              'bg-primary/15 text-primary'
            }`}>
              {change.type.replace(/_/g, ' ')}
            </span>
            <span className="text-sm font-semibold text-foreground">{change.compoundName}</span>
          </div>

          {change.oldValue && change.newValue && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 rounded-md bg-secondary/50 border border-border/40 p-2.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Current</p>
                <p className="text-sm font-mono font-semibold text-foreground line-through opacity-60">{change.oldValue}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex-1 rounded-md bg-primary/10 border border-primary/30 p-2.5">
                <p className="text-[9px] uppercase tracking-wider text-primary mb-0.5">New Value</p>
                <p className="text-sm font-mono font-semibold text-primary">{change.newValue}</p>
              </div>
            </div>
          )}

          {change.field && (
            <p className="text-[10px] text-muted-foreground mb-2">
              <span className="font-semibold">Field:</span> {fieldLabel(change.field)}
            </p>
          )}

          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-secondary/40 rounded-md p-2">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
            <p className="leading-relaxed">{change.reasoning}</p>
          </div>
        </div>

        {/* Compound details if available */}
        {compound && (
          <div className="rounded-lg border border-border/30 bg-card/50 p-3 mb-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Current Compound Details</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span className="font-medium capitalize">{compound.category.replace(/-/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dose</span>
                <span className="font-medium">{compound.dosePerUse} {compound.doseLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frequency</span>
                <span className="font-medium">{compound.dosesPerDay}x / {compound.daysPerWeek}d</span>
              </div>
              {compound.timingNote && (
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Timing</span>
                  <span className="font-medium truncate ml-2">{compound.timingNote}</span>
                </div>
              )}
              {compound.unitPrice > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit Price</span>
                  <span className="font-medium">${compound.unitPrice}</span>
                </div>
              )}
              {compound.currentQuantity != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">On Hand</span>
                  <span className="font-medium">{compound.currentQuantity} {compound.unitLabel}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* What will cascade */}
        <div className="rounded-md border border-border/20 bg-secondary/20 p-3 mb-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Cascades to</p>
          <div className="flex flex-wrap gap-1.5">
            {['Inventory', 'Schedule', 'Costs', 'Protocol Log'].map(area => (
              <span key={area} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">{area}</span>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-1.5 border-destructive/40 text-status-critical hover:bg-destructive/10"
            onClick={onCancel}
          >
            <X className="w-4 h-4" />
            Cancel
          </Button>
          <Button
            className="flex-1 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onConfirm}
          >
            <Check className="w-4 h-4" />
            Lock In Change
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProtocolChangeConfirmSheet;
