import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, LayoutDashboard, Calendar, Package, ShoppingCart, DollarSign, Activity, Brain, Target, Plus, Settings, FileText } from 'lucide-react';

interface TourStep {
  title: string;
  description: string;
  icon: typeof LayoutDashboard;
  tip?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Dashboard',
    description: 'Your home base. See your full protocol coverage, body zone map, and goal progress at a glance. Tap any body zone to see which compounds are working there.',
    icon: LayoutDashboard,
    tip: 'Swipe left on the body map to see your goal progress rings.',
  },
  {
    title: 'Weekly Schedule',
    description: 'See exactly what to take each day. Your compounds are organized by time of day — morning, afternoon, and evening — so you never miss a dose.',
    icon: Calendar,
    tip: 'Tap any compound to see its full details and edit dosing.',
  },
  {
    title: 'Inventory',
    description: 'Track how much you have on hand. Each compound card shows remaining supply and days until depletion so you can reorder before running out.',
    icon: Package,
    tip: 'Tap the + button in the header to add new compounds anytime.',
  },
  {
    title: 'Reorders',
    description: 'See which compounds are running low and need to be reordered. Mark orders as placed and track when they arrive.',
    icon: ShoppingCart,
  },
  {
    title: 'Cost Projections',
    description: 'See your monthly and yearly protocol costs broken down by compound. Helps you budget and find ways to optimize spending.',
    icon: DollarSign,
  },
  {
    title: 'Outcomes & Goals',
    description: 'Track progress toward the goals you set. Log readings from bloodwork, body measurements, or subjective journals to see trends over time.',
    icon: Activity,
    tip: 'Use the 🎯 icon in the header to expand your goals anytime.',
  },
  {
    title: 'AI Protocol Advisor',
    description: 'Get AI-powered analysis of your entire stack. The advisor evaluates compound synergies, identifies gaps, and suggests optimizations based on your goals.',
    icon: Brain,
    tip: 'Ask it anything — "Am I taking too much?" or "What should I add for sleep?"',
  },
  {
    title: 'Quick Actions',
    description: 'Use the header icons for quick access: ⚙️ Settings & account, ➕ Protocol groups, 🎯 Goal expansion, and 📄 Upload lab results.',
    icon: Settings,
  },
];

interface GuidedTourProps {
  onComplete: () => void;
}

const GuidedTour = ({ onComplete }: GuidedTourProps) => {
  const [step, setStep] = useState(0);
  const current = TOUR_STEPS[step];
  const Icon = current.icon;
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Close button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={onComplete}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tour <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 mb-6">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-all ${
                i <= step ? 'bg-primary' : 'bg-border/30'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{current.title}</h3>
              <p className="text-[10px] text-muted-foreground">Step {step + 1} of {TOUR_STEPS.length}</p>
            </div>
          </div>

          <p className="text-sm text-foreground/80 leading-relaxed mb-4">
            {current.description}
          </p>

          {current.tip && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15 mb-4">
              <span className="text-[10px] text-primary font-semibold mt-0.5">💡 TIP</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{current.tip}</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          <button
            onClick={() => {
              if (isLast) onComplete();
              else setStep(step + 1);
            }}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all"
          >
            {isLast ? (
              <>Start Using SUPERHUMAN</>
            ) : (
              <>
                Next <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuidedTour;
