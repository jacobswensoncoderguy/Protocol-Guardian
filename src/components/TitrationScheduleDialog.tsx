import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Calendar, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import DatePickerInput from '@/components/DatePickerInput';

interface TitrationStep {
  dose_amount: number;
  dose_unit: string;
  start_date: string;
  duration_days: number;
  notes: string;
}

interface TitrationScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compoundName: string;
  compoundId: string;
  currentDose: number;
  doseUnit: string;
  onSave: (
    compoundId: string,
    name: string,
    startDate: string,
    steps: TitrationStep[],
    notes?: string,
  ) => Promise<any>;
}

const TitrationScheduleDialog = ({
  open, onOpenChange, compoundName, compoundId,
  currentDose, doseUnit, onSave,
}: TitrationScheduleDialogProps) => {
  const today = new Date().toISOString().split('T')[0];
  const [name, setName] = useState(`${compoundName} Titration`);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [steps, setSteps] = useState<TitrationStep[]>([
    { dose_amount: currentDose, dose_unit: doseUnit, start_date: today, duration_days: 7, notes: 'Starting dose' },
    { dose_amount: currentDose * 1.5, dose_unit: doseUnit, start_date: addDays(today, 7), duration_days: 7, notes: '' },
    { dose_amount: currentDose * 2, dose_unit: doseUnit, start_date: addDays(today, 14), duration_days: 14, notes: 'Target dose' },
  ]);

  function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  const addStep = () => {
    const lastStep = steps[steps.length - 1];
    const newStart = addDays(lastStep.start_date, lastStep.duration_days);
    setSteps([...steps, {
      dose_amount: lastStep.dose_amount,
      dose_unit: doseUnit,
      start_date: newStart,
      duration_days: 7,
      notes: '',
    }]);
  };

  const removeStep = (i: number) => {
    if (steps.length <= 2) { toast.error('Need at least 2 steps'); return; }
    setSteps(steps.filter((_, idx) => idx !== i));
  };

  const updateStep = (i: number, updates: Partial<TitrationStep>) => {
    const updated = [...steps];
    updated[i] = { ...updated[i], ...updates };

    // Auto-cascade dates if duration changed
    if (updates.duration_days !== undefined || updates.start_date !== undefined) {
      for (let j = i + 1; j < updated.length; j++) {
        const prevEnd = addDays(updated[j - 1].start_date, updated[j - 1].duration_days);
        updated[j] = { ...updated[j], start_date: prevEnd };
      }
    }
    setSteps(updated);
  };

  const handleSave = async () => {
    if (steps.length < 2) { toast.error('Need at least 2 titration steps'); return; }
    setSaving(true);
    try {
      const result = await onSave(compoundId, name, steps[0].start_date, steps, notes || undefined);
      if (result) {
        toast.success('Titration schedule created');
        onOpenChange(false);
      }
    } catch {
      toast.error('Failed to create schedule');
    }
    setSaving(false);
  };

  // Calculate total duration
  const totalDays = steps.reduce((sum, s) => sum + s.duration_days, 0);
  const totalWeeks = Math.ceil(totalDays / 7);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <TrendingUp className="w-5 h-5 text-primary" />
            Titration Schedule
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Schedule Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="bg-secondary/50" />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>{totalWeeks} week{totalWeeks !== 1 ? 's' : ''} ({totalDays} days) total</span>
            <span className="ml-auto font-mono">{steps[0].dose_amount} → {steps[steps.length - 1].dose_amount} {doseUnit}</span>
          </div>

          {/* Visual timeline */}
          <div className="relative pl-4 border-l-2 border-primary/30 space-y-3">
            {steps.map((step, i) => {
              const isFirst = i === 0;
              const isLast = i === steps.length - 1;
              return (
                <div key={i} className="relative">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[calc(1rem+5px)] top-2 w-2.5 h-2.5 rounded-full border-2 ${
                    isFirst ? 'border-muted-foreground bg-muted' :
                    isLast ? 'border-primary bg-primary' :
                    'border-primary/60 bg-card'
                  }`} />

                  <div className="p-3 rounded-lg bg-secondary/30 border border-border/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-primary font-bold">
                        Step {i + 1}{isFirst ? ' (Start)' : isLast ? ' (Target)' : ''}
                      </span>
                      {steps.length > 2 && (
                        <button onClick={() => removeStep(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Dose ({doseUnit})</Label>
                        <Input
                          type="number"
                          value={step.dose_amount}
                          onChange={e => updateStep(i, { dose_amount: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-sm bg-secondary/50"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Duration (days)</Label>
                        <Input
                          type="number"
                          value={step.duration_days}
                          onChange={e => updateStep(i, { duration_days: parseInt(e.target.value) || 1 })}
                          className="h-8 text-sm bg-secondary/50"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-[10px] text-muted-foreground">Start Date</Label>
                      <DatePickerInput
                        value={step.start_date}
                        onChange={v => updateStep(i, { start_date: v })}
                        className="h-8 text-sm"
                      />
                    </div>

                    <Input
                      placeholder="Notes (optional)"
                      value={step.notes}
                      onChange={e => updateStep(i, { notes: e.target.value })}
                      className="h-7 text-xs bg-secondary/30 border-border/30"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Button variant="outline" onClick={addStep} className="w-full text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Step
          </Button>

          <div>
            <Label className="text-xs text-muted-foreground">Schedule Notes</Label>
            <Input
              placeholder="e.g. Follow provider instructions"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="bg-secondary/50"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? 'Saving...' : 'Create Schedule'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TitrationScheduleDialog;
