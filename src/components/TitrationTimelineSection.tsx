import { TitrationSchedule } from '@/hooks/useTitration';
import { TrendingUp, Check, Clock, SkipForward, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useState } from 'react';

interface TitrationTimelineSectionProps {
  schedule: TitrationSchedule;
  onConfirm: (stepId: string, scheduleId: string) => void;
  onSkip: (stepId: string) => void;
  onCancel: (scheduleId: string) => void;
  onDelete: (scheduleId: string) => void;
}

const TitrationTimelineSection = ({ schedule, onConfirm, onSkip, onCancel, onDelete }: TitrationTimelineSectionProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <Check className="w-3 h-3 text-status-good" />;
      case 'active': return <Clock className="w-3 h-3 text-primary animate-pulse" />;
      case 'skipped': return <SkipForward className="w-3 h-3 text-muted-foreground" />;
      default: return <div className="w-3 h-3 rounded-full border-2 border-border" />;
    }
  };

  const progressPct = () => {
    const completed = schedule.steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
    return Math.round((completed / schedule.steps.length) * 100);
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground/80">Titration Schedule</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-muted-foreground">{progressPct()}%</span>
          {schedule.status === 'active' && (
            <button
              onClick={() => onCancel(schedule.id)}
              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
            >
              Cancel
            </button>
          )}
          {(schedule.status === 'completed' || schedule.status === 'cancelled') && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progressPct()}%` }}
        />
      </div>

      {/* Steps timeline */}
      <div className="relative ml-3 border-l-2 border-primary/20 pl-4 space-y-2">
        {schedule.steps.map((step) => {
          const isDue = step.status === 'pending' && step.start_date <= today;
          const isActive = step.status === 'active';

          return (
            <div key={step.id} className={`relative ${step.status === 'completed' || step.status === 'skipped' ? 'opacity-50' : ''}`}>
              <div className="absolute -left-[calc(1rem+5px)] top-1">
                {statusIcon(step.status)}
              </div>
              <div className={`p-2 rounded-md ${
                isActive || isDue ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/30'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-primary font-bold">
                    Step {step.step_number}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {new Date(step.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs font-semibold text-foreground">
                    {step.dose_amount} {step.dose_unit}
                  </span>
                  {step.duration_days && (
                    <span className="text-[10px] text-muted-foreground">{step.duration_days}d</span>
                  )}
                </div>
                {step.notes && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{step.notes}</p>
                )}
                {(isDue || isActive) && step.status !== 'completed' && (
                  <div className="flex gap-1.5 mt-1.5">
                    <Button size="sm" variant="outline" onClick={() => onSkip(step.id)} className="h-6 text-[10px] flex-1">
                      Skip
                    </Button>
                    <Button size="sm" onClick={() => onConfirm(step.id, schedule.id)} className="h-6 text-[10px] flex-1">
                      Confirm
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {schedule.notes && (
        <p className="text-[10px] text-muted-foreground italic">{schedule.notes}</p>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Schedule"
        description="Remove this titration schedule history?"
        confirmLabel="Delete"
        onConfirm={() => { onDelete(schedule.id); setShowDeleteConfirm(false); }}
      />
    </div>
  );
};

export default TitrationTimelineSection;
