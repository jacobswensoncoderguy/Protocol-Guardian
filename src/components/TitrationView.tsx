import { TitrationSchedule } from '@/hooks/useTitration';
import { Compound } from '@/data/compounds';
import { TrendingUp, Check, Clock, SkipForward, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TitrationViewProps {
  schedules: TitrationSchedule[];
  compounds: Compound[];
  onConfirm: (stepId: string, scheduleId: string) => void;
  onSkip: (stepId: string) => void;
  onCancel: (scheduleId: string) => void;
  onDelete: (scheduleId: string) => void;
  onAddTitration: (compoundId: string) => void;
}

const TitrationView = ({ schedules, compounds, onConfirm, onSkip, onCancel, onDelete, onAddTitration }: TitrationViewProps) => {
  const today = new Date().toISOString().split('T')[0];
  const compoundMap = new Map(compounds.map(c => [c.id, c]));

  const activeSchedules = schedules.filter(s => s.status === 'active');
  const completedSchedules = schedules.filter(s => s.status === 'completed' || s.status === 'cancelled');

  // Compounds eligible for titration (no active schedule)
  const eligibleCompounds = compounds.filter(c =>
    !activeSchedules.some(s => s.user_compound_id === c.id) &&
    !c.notes?.includes('[DORMANT]')
  );

  if (schedules.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto" />
        <h3 className="text-sm font-semibold text-foreground">No Titration Schedules</h3>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Create a titration schedule to manage cadenced dose increases for peptides and compounds that require gradual ramp-up.
        </p>
        {eligibleCompounds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center mt-4">
            {eligibleCompounds.slice(0, 6).map(c => (
              <button
                key={c.id}
                onClick={() => onAddTitration(c.id)}
                className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
              >
                + {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Due alerts */}
      {activeSchedules.map(schedule => {
        const dueSteps = schedule.steps.filter(s => s.status === 'pending' && s.start_date <= today);
        const activeStep = schedule.steps.find(s => s.status === 'active');
        const compound = compoundMap.get(schedule.user_compound_id);
        if (dueSteps.length === 0 && !activeStep) return null;

        const currentStep = activeStep || dueSteps[0];
        if (!currentStep) return null;

        return (
          <div key={schedule.id} className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary truncate">
                  {compound?.name || 'Compound'} — Step {currentStep.step_number} Due
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Increase to <span className="font-mono font-bold text-foreground">{currentStep.dose_amount} {currentStep.dose_unit}</span>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onSkip(currentStep.id)} className="flex-1 h-7 text-[10px]">
                <SkipForward className="w-3 h-3 mr-1" /> Skip
              </Button>
              <Button size="sm" onClick={() => onConfirm(currentStep.id, schedule.id)} className="flex-1 h-7 text-[10px]">
                <Check className="w-3 h-3 mr-1" /> Confirm
              </Button>
            </div>
          </div>
        );
      })}

      {/* Active schedules */}
      {activeSchedules.map(schedule => {
        const compound = compoundMap.get(schedule.user_compound_id);
        const completedCount = schedule.steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
        const pct = Math.round((completedCount / schedule.steps.length) * 100);

        return (
          <div key={schedule.id} className="rounded-lg border border-border/50 bg-card/80 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-foreground">{compound?.name || 'Compound'}</p>
                  <p className="text-[10px] text-muted-foreground">{schedule.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground">{pct}%</span>
                <button
                  onClick={() => onCancel(schedule.id)}
                  className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>

            {/* Compact step list */}
            <div className="flex flex-wrap gap-1">
              {schedule.steps.map(step => (
                <div
                  key={step.id}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                    step.status === 'completed' ? 'bg-status-good/10 text-status-good line-through' :
                    step.status === 'active' ? 'bg-primary/15 text-primary ring-1 ring-primary/30' :
                    step.status === 'skipped' ? 'bg-muted text-muted-foreground line-through' :
                    'bg-secondary text-muted-foreground'
                  }`}
                >
                  {step.dose_amount}{step.dose_unit}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Add new titration */}
      {eligibleCompounds.length > 0 && (
        <div className="pt-2">
          <p className="text-[10px] text-muted-foreground mb-1.5">Add titration to:</p>
          <div className="flex flex-wrap gap-1.5">
            {eligibleCompounds.slice(0, 8).map(c => (
              <button
                key={c.id}
                onClick={() => onAddTitration(c.id)}
                className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary border border-border/40 transition-colors"
              >
                + {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Completed/Cancelled history */}
      {completedSchedules.length > 0 && (
        <div className="pt-3 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground mb-2">History</p>
          {completedSchedules.map(schedule => {
            const compound = compoundMap.get(schedule.user_compound_id);
            return (
              <div key={schedule.id} className="flex items-center justify-between py-1.5 opacity-50">
                <div className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-status-good" />
                  <span className="text-xs text-foreground">{compound?.name}</span>
                  <span className="text-[10px] text-muted-foreground">{schedule.name}</span>
                </div>
                <button onClick={() => onDelete(schedule.id)} className="text-[10px] text-muted-foreground hover:text-destructive">
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TitrationView;
