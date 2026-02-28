import { TitrationSchedule, TitrationStep, TitrationNotification } from '@/hooks/useTitration';
import { AlertTriangle, Check, ChevronRight, SkipForward, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TitrationBannerProps {
  notifications: TitrationNotification[];
  schedules: TitrationSchedule[];
  onConfirm: (stepId: string, scheduleId: string) => void;
  onSkip: (stepId: string) => void;
  compoundNames: Map<string, string>; // compoundId -> name
}

const TitrationBanner = ({ notifications, schedules, onConfirm, onSkip, compoundNames }: TitrationBannerProps) => {
  if (notifications.length === 0) return null;

  // Group by schedule
  const dueBySchedule = new Map<string, { schedule: TitrationSchedule; step: TitrationStep; notification: TitrationNotification }>();
  
  for (const notif of notifications) {
    if (notif.notification_type !== 'step_due') continue;
    const schedule = schedules.find(s => s.id === notif.schedule_id);
    if (!schedule) continue;
    const step = schedule.steps.find(s => s.id === notif.step_id);
    if (!step) continue;
    dueBySchedule.set(schedule.id, { schedule, step, notification: notif });
  }

  if (dueBySchedule.size === 0) return null;

  return (
    <div className="space-y-2">
      {Array.from(dueBySchedule.values()).map(({ schedule, step, notification }) => {
        const compoundName = compoundNames.get(schedule.user_compound_id) || 'Compound';
        const nextStep = schedule.steps.find(s => s.step_number === step.step_number + 1);

        return (
          <div key={notification.id} className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary truncate">
                  {compoundName} — Dose Step Due
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Step {step.step_number}: Increase to <span className="font-mono font-bold text-foreground">{step.dose_amount} {step.dose_unit}</span>
                  {nextStep && (
                    <> <ChevronRight className="w-3 h-3 inline" /> Next: {nextStep.dose_amount} {nextStep.dose_unit}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSkip(step.id)}
                className="flex-1 h-7 text-[10px] gap-1"
              >
                <SkipForward className="w-3 h-3" /> Skip
              </Button>
              <Button
                size="sm"
                onClick={() => onConfirm(step.id, schedule.id)}
                className="flex-1 h-7 text-[10px] gap-1"
              >
                <Check className="w-3 h-3" /> Confirm Step Up
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TitrationBanner;
