import React from 'react';
import { Check, Clock, Utensils, Dumbbell, FlaskConical } from 'lucide-react';
import ClickableCard from '@/components/ClickableCard';

interface ActionItem {
  id: string;
  title: string;
  subtitle: string;
  status: 'now' | 'pending' | 'done';
  icon: React.ReactNode;
  onTap?: () => void;
}

interface NextActionsQueueProps {
  overdueDoseCount?: number;
  hasCheckedIn?: boolean;
  caloriesLogged?: number;
  caloriesTarget?: number;
  workoutLoggedToday?: boolean;
  onLogDose?: () => void;
  onLogCheckin?: () => void;
  onLogFood?: () => void;
  onLogWorkout?: () => void;
}

const NextActionsQueue: React.FC<NextActionsQueueProps> = ({
  overdueDoseCount = 0, hasCheckedIn = false, caloriesLogged = 0,
  caloriesTarget = 2800, workoutLoggedToday = false,
  onLogDose, onLogCheckin, onLogFood, onLogWorkout,
}) => {
  const hour = new Date().getHours();
  const actions: ActionItem[] = [];

  // Overdue doses
  if (overdueDoseCount > 0) {
    actions.push({
      id: 'doses', title: `${overdueDoseCount} overdue dose${overdueDoseCount > 1 ? 's' : ''}`,
      subtitle: 'Scheduled doses not yet logged', status: 'now',
      icon: <Clock className="w-3.5 h-3.5" />, onTap: onLogDose,
    });
  }

  // Check-in
  if (!hasCheckedIn && hour >= 9) {
    actions.push({
      id: 'checkin', title: 'Complete daily check-in',
      subtitle: 'Energy · Mood · Sleep · Pain', status: overdueDoseCount > 0 ? 'pending' : 'now',
      icon: <Check className="w-3.5 h-3.5" />, onTap: onLogCheckin,
    });
  } else if (hasCheckedIn) {
    actions.push({
      id: 'checkin', title: 'Daily check-in', subtitle: 'Completed',
      status: 'done', icon: <Check className="w-3.5 h-3.5" />,
    });
  }

  // Food logging
  if (caloriesLogged === 0 && hour >= 12) {
    actions.push({
      id: 'food', title: 'Log your meals',
      subtitle: `0 / ${caloriesTarget} cal logged`, status: 'pending',
      icon: <Utensils className="w-3.5 h-3.5" />, onTap: onLogFood,
    });
  }

  // Workout
  if (!workoutLoggedToday) {
    actions.push({
      id: 'workout', title: 'No workout logged',
      subtitle: 'Log a session or sync', status: 'pending',
      icon: <Dumbbell className="w-3.5 h-3.5" />, onTap: onLogWorkout,
    });
  }

  const visible = actions.slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Next Actions</p>
      <div className="space-y-1.5">
        {visible.map((action, i) => {
          const isNow = action.status === 'now';
          const isDone = action.status === 'done';

          return (
            <ClickableCard
              key={action.id}
              onClick={action.onTap}
              className="p-2.5 flex items-center gap-2.5"
              accentColor={isNow ? 'hsl(var(--primary))' : undefined}
              showArrow={!isDone}
            >
              <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                isDone ? 'bg-[hsl(var(--neon-green))]/20 text-[hsl(var(--neon-green))]'
                  : isNow ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
              }`}>
                {isDone ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${isDone ? 'text-muted-foreground line-through' : isNow ? 'text-primary' : 'text-foreground'}`}>
                  {action.title}
                </p>
                <p className="text-[9px] text-muted-foreground truncate">{action.subtitle}</p>
              </div>
              <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                isNow ? 'bg-primary/15 text-primary' : isDone ? 'bg-[hsl(var(--neon-green))]/10 text-[hsl(var(--neon-green))]' : 'bg-secondary text-muted-foreground'
              }`}>
                {action.status}
              </span>
            </ClickableCard>
          );
        })}
      </div>
    </div>
  );
};

export default NextActionsQueue;
