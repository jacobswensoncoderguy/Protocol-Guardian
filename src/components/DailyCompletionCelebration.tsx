import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import confetti from 'canvas-confetti';

interface DailyCompletionCelebrationProps {
  show: boolean;
  onDismiss: () => void;
}

const DailyCompletionCelebration = ({ show, onDismiss }: DailyCompletionCelebrationProps) => {
  const [visible, setVisible] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (show && !firedRef.current) {
      firedRef.current = true;
      setVisible(true);

      // Fire green-themed confetti
      const duration = 2500;
      const end = Date.now() + duration;
      const colors = ['#22c55e', '#4ade80', '#86efac', '#16a34a', '#15803d'];

      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors,
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors,
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();

      // Auto-dismiss after 3s
      const t = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 3000);
      return () => clearTimeout(t);
    }
    if (!show) {
      firedRef.current = false;
    }
  }, [show, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => { setVisible(false); onDismiss(); }}
    >
      <div className="text-center space-y-4" onClick={e => e.stopPropagation()}>
        {/* Animated checkmark */}
        <div className="relative mx-auto w-28 h-28">
          <div className="absolute inset-0 rounded-full bg-status-good/20 animate-ping" />
          <div
            className="relative w-28 h-28 rounded-full bg-gradient-to-br from-status-good/40 to-status-good/10 border-4 border-status-good/60 flex items-center justify-center animate-[celebration-check_0.6s_ease-out]"
            style={{ boxShadow: '0 0 60px hsl(142 71% 45% / 0.5)' }}
          >
            <Check
              className="w-16 h-16 text-status-good"
              strokeWidth={3}
              style={{ filter: 'drop-shadow(0 0 12px hsl(142 71% 45% / 0.7))' }}
            />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-black text-foreground tracking-tight">100% COMPLETE!</h2>
          <p className="text-sm text-muted-foreground mt-1">Every dose taken today. Keep it up! 💪</p>
        </div>
      </div>
    </div>
  );
};

export default DailyCompletionCelebration;
