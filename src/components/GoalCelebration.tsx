import { useEffect, useRef, useState } from 'react';
import { Trophy, Target, ArrowRight, RotateCcw, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserGoal } from '@/hooks/useGoals';

interface GoalCelebrationProps {
  open: boolean;
  goal: UserGoal;
  onClose: () => void;
  onSetNewTarget: () => void;
  onArchieve: () => void;
  onKeepTracking: () => void;
}

const GoalCelebration = ({ open, goal, onClose, onSetNewTarget, onArchieve, onKeepTracking }: GoalCelebrationProps) => {
  const [show, setShow] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (open && !firedRef.current) {
      firedRef.current = true;
      setShow(true);
      // Fire confetti
      const duration = 3000;
      const end = Date.now() + duration;
      const colors = ['#00e5ff', '#ffd740', '#76ff03', '#e040fb', '#ff6e40'];
      
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors,
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
    if (!open) {
      firedRef.current = false;
      setShow(false);
    }
  }, [open]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
      <div className="max-w-sm w-full mx-4 text-center space-y-6" onClick={e => e.stopPropagation()}>
        {/* Trophy icon */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/50 flex items-center justify-center"
            style={{ boxShadow: '0 0 40px hsl(var(--primary) / 0.4)' }}>
            <Trophy className="w-12 h-12 text-primary" style={{ filter: 'drop-shadow(0 0 8px hsl(var(--primary) / 0.6))' }} />
          </div>
        </div>

        {/* Text */}
        <div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-black text-foreground tracking-tight">GOAL ACHIEVED!</h2>
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <p className="text-lg font-semibold text-primary" style={{ textShadow: '0 0 12px hsl(var(--primary) / 0.5)' }}>
            {goal.title}
          </p>
          {goal.target_value != null && goal.target_unit && (
            <p className="text-sm text-muted-foreground mt-1">
              Target: {goal.target_value} {goal.target_unit} — Reached!
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          <button onClick={onSetNewTarget}
            className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
            <Target className="w-4 h-4" /> Set New Target
          </button>
          <button onClick={onArchieve}
            className="w-full py-3 px-4 rounded-xl bg-secondary border border-border text-foreground font-medium text-sm flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors">
            <Trophy className="w-4 h-4 text-primary" /> Add to Achievements
          </button>
          <button onClick={onKeepTracking}
            className="w-full py-2.5 px-4 rounded-xl text-muted-foreground text-sm flex items-center justify-center gap-2 hover:text-foreground transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Keep Tracking
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoalCelebration;
