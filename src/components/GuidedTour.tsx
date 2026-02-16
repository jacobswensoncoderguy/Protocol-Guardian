import { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, LayoutDashboard, Calendar, Package, ShoppingCart, DollarSign, Activity, Brain, Target, Plus, Settings } from 'lucide-react';

interface TourStep {
  title: string;
  description: string;
  icon: typeof LayoutDashboard;
  tip?: string;
  /** CSS selector to highlight. If found, a spotlight will cut out around it. */
  selector: string;
  /** Position of the tooltip relative to the highlighted element */
  position: 'bottom' | 'top';
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Dashboard',
    description: 'Your home base. See protocol coverage, body zone map, and goal progress at a glance.',
    icon: LayoutDashboard,
    tip: 'Swipe left on the body map to see your goal progress rings.',
    selector: '[value="dashboard"]',
    position: 'bottom',
  },
  {
    title: 'Weekly Schedule',
    description: 'See exactly what to take each day — organized by morning, afternoon, and evening.',
    icon: Calendar,
    tip: 'Tap any compound to see its full details and edit dosing.',
    selector: '[value="schedule"]',
    position: 'bottom',
  },
  {
    title: 'Inventory',
    description: 'Track remaining supply and days until depletion so you never run out.',
    icon: Package,
    tip: 'Tap the + button in the header to add new compounds anytime.',
    selector: '[value="inventory"]',
    position: 'bottom',
  },
  {
    title: 'Reorders',
    description: 'See which compounds are running low. Mark orders as placed and track arrivals.',
    icon: ShoppingCart,
    selector: '[value="reorders"]',
    position: 'bottom',
  },
  {
    title: 'Cost Projections',
    description: 'Monthly and yearly protocol costs broken down by compound for budgeting.',
    icon: DollarSign,
    selector: '[value="costs"]',
    position: 'bottom',
  },
  {
    title: 'Outcomes & Goals',
    description: 'Track progress with readings from bloodwork, measurements, or journals.',
    icon: Activity,
    tip: 'Use the 🎯 icon in the header to expand your goals anytime.',
    selector: '[value="outcomes"]',
    position: 'bottom',
  },
  {
    title: 'AI Protocol Advisor',
    description: 'Get AI analysis of your stack — synergies, gaps, and optimization suggestions.',
    icon: Brain,
    tip: 'Ask it anything — "Am I taking too much?" or "What should I add for sleep?"',
    selector: '[value="ai-insights"]',
    position: 'bottom',
  },
  {
    title: 'Settings & Actions',
    description: 'Quick access to account settings, protocol groups, goal expansion, and lab uploads.',
    icon: Settings,
    selector: 'header .container',
    position: 'bottom',
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface GuidedTourProps {
  onComplete: () => void;
}

const GuidedTour = ({ onComplete }: GuidedTourProps) => {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const current = TOUR_STEPS[step];
  const Icon = current.icon;
  const isLast = step === TOUR_STEPS.length - 1;

  const measureElement = useCallback(() => {
    const el = document.querySelector(current.selector);
    if (el) {
      const r = el.getBoundingClientRect();
      const padding = 8;
      setRect({
        top: r.top - padding + window.scrollY,
        left: r.left - padding,
        width: r.width + padding * 2,
        height: r.height + padding * 2,
      });
    } else {
      setRect(null);
    }
  }, [current.selector]);

  useEffect(() => {
    measureElement();
    const handleResize = () => measureElement();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [step, measureElement]);

  // Tooltip positioning
  const getTooltipStyle = (): React.CSSProperties => {
    if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    const tooltipWidth = 340;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));

    if (current.position === 'bottom') {
      return { position: 'fixed', top: rect.top + rect.height + 12, left, width: tooltipWidth };
    }
    return { position: 'fixed', bottom: window.innerHeight - rect.top + 12, left, width: tooltipWidth };
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Dark overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="hsl(var(--background) / 0.85)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Spotlight border glow */}
      {rect && (
        <div
          className="absolute rounded-lg border-2 border-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)] pointer-events-none transition-all duration-300"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}

      {/* Click overlay (blocks interaction except on highlighted element) */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Tooltip card */}
      <div
        className="bg-card border border-border/50 rounded-xl p-4 shadow-2xl z-[101] animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
        style={getTooltipStyle()}
      >
        {/* Close */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">{current.title}</h3>
              <p className="text-[10px] text-muted-foreground">Step {step + 1} of {TOUR_STEPS.length}</p>
            </div>
          </div>
          <button
            onClick={onComplete}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs text-foreground/80 leading-relaxed mb-3">
          {current.description}
        </p>

        {current.tip && (
          <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-md bg-primary/5 border border-primary/15 mb-3">
            <span className="text-[10px] text-primary font-semibold mt-0.5">💡</span>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{current.tip}</p>
          </div>
        )}

        {/* Progress + Navigation */}
        <div className="flex gap-0.5 mb-3">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-0.5 rounded-full flex-1 transition-all ${
                i <= step ? 'bg-primary' : 'bg-border/30'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
          <button
            onClick={() => {
              if (isLast) onComplete();
              else setStep(step + 1);
            }}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all"
          >
            {isLast ? 'Start Using SUPERHUMAN' : <>Next <ChevronRight className="w-3.5 h-3.5" /></>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuidedTour;
