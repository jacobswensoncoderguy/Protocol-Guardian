import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { fieldExplanations, FieldExplanation } from '@/lib/fieldExplanations';
import { Info, ArrowRight } from 'lucide-react';

interface InfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldKey?: string;
  customExplanation?: FieldExplanation;
  currentValue?: string | number;
  onAction?: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({
  open,
  onOpenChange,
  fieldKey,
  customExplanation,
  currentValue,
  onAction,
}) => {
  const explanation = customExplanation ?? (fieldKey ? fieldExplanations[fieldKey] : undefined);

  if (!explanation) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Info className="w-4 h-4 text-primary" />
            </div>
            <SheetTitle className="text-base">{explanation.title}</SheetTitle>
          </div>
          {currentValue !== undefined && (
            <div className="text-2xl font-mono font-bold text-foreground mt-2">
              {currentValue}
            </div>
          )}
          <SheetDescription className="text-sm mt-2">
            {explanation.description}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {explanation.calculation && (
            <div className="p-3 rounded-lg bg-secondary/50 border border-border/30">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">How it's calculated</p>
              <p className="text-xs font-mono text-foreground">{explanation.calculation}</p>
            </div>
          )}

          {explanation.factors && explanation.factors.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">What affects this</p>
              <ul className="space-y-1.5">
                {explanation.factors.map((factor, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {explanation.actionLabel && onAction && (
            <Button
              onClick={() => { onAction(); onOpenChange(false); }}
              className="w-full gap-2"
              variant="outline"
            >
              {explanation.actionLabel}
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default InfoModal;
