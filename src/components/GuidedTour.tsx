import { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, LayoutDashboard, Calendar, Package, ShoppingCart, DollarSign, Activity, Brain, Settings, MousePointerClick } from 'lucide-react';

interface TourStep {
  title: string;
  description: string;
  icon: typeof LayoutDashboard;
  tip?: string;
  selector: string;
  position: 'bottom' | 'top';
  /** Tab value to auto-navigate to when this step is shown */
  tabValue?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Dashboard',
    description: 'Your home base. See protocol coverage, body zone map, and goal progress at a glance.',
    icon: LayoutDashboard,
    tip: 'Swipe left on the body map to see your goal progress rings.',
    selector: '[value="dashboard"]',
    position: 'bottom',
    tabValue: 'dashboard',
  },
  {
    title: 'Weekly Schedule',
    description: 'See exactly what to take each day — organized by morning, afternoon, and evening.',
    icon: Calendar,
    tip: 'Tap any compound to see its full details and edit dosing.',
    selector: '[value="schedule"]',
    position: 'bottom',
    tabValue: 'schedule',
  },
  {
    title: 'Inventory',
    description: 'Track remaining supply and days until depletion so you never run out.',
    icon: Package,
    tip: 'Tap any compound card to edit doses, prices, and cycling schedules.',
    selector: '[value="inventory"]',
    position: 'bottom',
    tabValue: 'inventory',
  },
  {
    title: 'Your First Compound Card',
    description: 'Each card shows your compound details. Tap it to set your dose, frequency, unit price, and inventory count. Fill these in to power your schedule, cost projections, and reorder alerts.',
    icon: MousePointerClick,
    tip: 'Start with dose per use and days per week — the rest auto-calculates from there.',
    selector: '[data-tour="compound-card"]',
    position: 'bottom',
    tabValue: 'inventory',
  },
  {
    title: 'Reorders',
    description: 'See which compounds are running low. Mark orders as placed and track arrivals. Found under Inventory → Reorder.',
    icon: ShoppingCart,
    selector: '[value="inventory"]',
    position: 'bottom',
    tabValue: 'inventory',
  },
  {
    title: 'Cost Projections',
    description: 'Monthly and yearly protocol costs broken down by compound for budgeting. Found under Inventory → Costs.',
    icon: DollarSign,
    selector: '[value="inventory"]',
    position: 'bottom',
    tabValue: 'inventory',
  },
  {
    title: 'Outcomes & Goals',
    description: 'Track progress with readings from bloodwork, measurements, or journals.',
    icon: Activity,
    tip: 'Use the 🎯 icon in the header to expand your goals anytime.',
    selector: '[value="outcomes"]',
    position: 'bottom',
    tabValue: 'outcomes',
  },
  {
    title: 'AI Protocol Advisor',
    description: 'Get AI analysis of your stack — synergies, gaps, and optimization suggestions.',
    icon: Brain,
    tip: 'Ask it anything — "Am I taking too much?" or "What should I add for sleep?"',
    selector: '[value="ai-insights"]',
    position: 'bottom',
    tabValue: 'ai-insights',
  },
  {
    title: 'Settings & Actions',
    description: 'Quick access to account settings, protocol groups, goal expansion, and lab uploads. You can replay this tour anytime from Settings.',
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
  onNavigateTab?: (tab: string) => void;
  onSkip?: () => void;
}

const GuidedTour = ({ onComplete, onNavigateTab, onSkip }: GuidedTourProps) => {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const current = TOUR_STEPS[step];
  const Icon = current.icon;
  const isLast = step === TOUR_STEPS.length - 1;

  // Auto-navigate to the correct tab when step changes
  useEffect(() => {
    if (current.tabValue && onNavigateTab) {
      onNavigateTab(current.tabValue);
    }
  }, [step, current.tabValue, onNavigateTab]);

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
    // Small delay to let tab content render before measuring
    const timer = setTimeout(measureElement, 150);
    const handleResize = () => measureElement();
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [step, measureElement]);

  const getTooltipStyle = (): React.CSSProperties => {
    if (!rect) return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    const tooltipWidth = 340;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));

    if (current.position === 'bottom') {
      const top = rect.top + rect.height + 12;
      // If tooltip would go off-screen bottom, flip to top
      if (top + 200 > window.innerHeight) {
        return { position: 'fixed', bottom: window.innerHeight - rect.top + 12, left, width: tooltipWidth };
      }
      return { position: 'fixed', top, left, width: tooltipWidth };
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

      {/* Spotlight border glow with pulse */}
      {rect && (
        <>
          <div
            className="absolute rounded-lg border-2 border-primary pointer-events-none transition-all duration-300"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              boxShadow: '0 0 20px hsl(var(--primary) / 0.4)',
            }}
          />
          <div
            className="absolute rounded-lg border-2 border-primary/60 pointer-events-none animate-[spotlight-pulse_2s_ease-in-out_infinite]"
            style={{
              top: rect.top - 4,
              left: rect.left - 4,
              width: rect.width + 8,
              height: rect.height + 8,
            }}
          />
          <style>{`
            @keyframes spotlight-pulse {
              0%, 100% { opacity: 0; transform: scale(1); }
              50% { opacity: 0.6; transform: scale(1.02); }
            }
          `}</style>
        </>
      )}

      {/* Click overlay */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Tooltip card */}
      <div
        className="bg-card border border-border/50 rounded-xl p-4 shadow-2xl z-[101] animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
        style={getTooltipStyle()}
      >
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              onClick={onSkip || onComplete}
              className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground underline transition-colors"
            >
              Skip tour
            </button>
          </div>
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
