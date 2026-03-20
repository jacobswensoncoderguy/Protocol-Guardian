import React from 'react';
import { Clock, Dumbbell, Heart, Trophy } from 'lucide-react';
import ClickableCard from '@/components/ClickableCard';
import { WorkoutSession } from '@/hooks/useWorkouts';

interface LastWorkoutCardProps {
  session?: WorkoutSession | null;
  muscleGroups?: string[];
  prCount?: number;
  onClick?: () => void;
}

const LastWorkoutCard: React.FC<LastWorkoutCardProps> = ({ session, muscleGroups = [], prCount = 0, onClick }) => {
  if (!session) return null;

  const sessionDate = new Date(session.session_date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - sessionDate.getTime()) / 86400000);
  const dateLabel = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : `${diffDays}d ago`;

  return (
    <ClickableCard onClick={onClick} className="p-3.5" accentColor="hsl(var(--neon-green))" showArrow>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-semibold text-foreground">
            {session.program_name || session.workout_type?.replace('_', ' ') || 'Workout'} · {dateLabel}
          </p>
          {session.source !== 'manual' && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
              via {session.source}
            </span>
          )}
        </div>
        <Dumbbell className="w-4 h-4 text-[hsl(var(--neon-green))]" />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
        {session.duration_minutes && (
          <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {session.duration_minutes}m</span>
        )}
        {session.total_volume_lbs && (
          <span className="flex items-center gap-0.5"><Dumbbell className="w-3 h-3" /> {(session.total_volume_lbs / 1000).toFixed(1)}k lbs</span>
        )}
        {session.avg_heart_rate && (
          <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {session.avg_heart_rate} bpm</span>
        )}
        {prCount > 0 && (
          <span className="flex items-center gap-0.5 text-accent"><Trophy className="w-3 h-3" /> {prCount} PR{prCount > 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Muscle chips */}
      {muscleGroups.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {muscleGroups.map(mg => (
            <span key={mg} className="text-[8px] px-1.5 py-0.5 rounded-full bg-secondary/50 text-muted-foreground border border-border/30 capitalize">
              {mg}
            </span>
          ))}
        </div>
      )}

      <p className="text-[8px] text-primary/60 mt-2">↗ Tap to see compound synergy during this session</p>
    </ClickableCard>
  );
};

export default LastWorkoutCard;
