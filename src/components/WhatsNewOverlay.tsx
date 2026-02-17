import { useState, useEffect, type ReactNode } from 'react';
import { X, Sparkles, Gift, Compass, Eye, MousePointerClick, Layers, Zap, ScanEye } from 'lucide-react';

const Illustration = ({ children, gradient }: { children: ReactNode; gradient: string }) => (
  <div className={`w-full h-20 rounded-lg overflow-hidden relative ${gradient} flex items-center justify-center mb-2`}>
    {children}
  </div>
);

interface ChangelogEntry {
  icon: typeof Sparkles;
  title: string;
  description: string;
  tag?: 'new' | 'improved' | 'fix';
  illustration: ReactNode;
}

const APP_VERSION = '1.4.0';
const STORAGE_KEY = 'superhuman_whats_new_dismissed';

const CHANGELOG: ChangelogEntry[] = [
  {
    icon: Compass,
    title: 'Interactive Guided Tour',
    description: 'New spotlight-based walkthrough with auto-tab navigation that introduces every feature when you first sign up.',
    tag: 'new',
    illustration: (
      <Illustration gradient="bg-gradient-to-br from-primary/20 via-primary/5 to-secondary/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Compass className="w-5 h-5 text-primary" />
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className={`h-1 rounded-full ${n <= 2 ? 'w-6 bg-primary' : 'w-6 bg-border/40'}`} />
            ))}
          </div>
          <MousePointerClick className="w-4 h-4 text-primary/60 animate-pulse" />
        </div>
      </Illustration>
    ),
  },
  {
    icon: Eye,
    title: 'Compound Info Popouts',
    description: 'Tap the ⓘ icon on any compound during onboarding or in your inventory to see benefits, dosing guidance, and expected timelines.',
    tag: 'new',
    illustration: (
      <Illustration gradient="bg-gradient-to-br from-emerald-500/15 via-secondary/20 to-primary/10">
        <div className="flex items-center gap-2">
          <div className="w-28 h-12 rounded-lg bg-card/60 border border-border/40 flex items-center px-2 gap-2">
            <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center"><Zap className="w-3 h-3 text-emerald-400" /></div>
            <div className="flex-1 space-y-1"><div className="h-1.5 w-12 bg-foreground/15 rounded" /><div className="h-1 w-8 bg-foreground/10 rounded" /></div>
          </div>
          <ScanEye className="w-5 h-5 text-primary/50" />
          <div className="w-24 h-14 rounded-lg bg-card/80 border border-primary/30 p-1.5 space-y-1">
            <div className="h-1.5 w-16 bg-primary/30 rounded" />
            <div className="h-1 w-12 bg-foreground/10 rounded" />
            <div className="h-1 w-14 bg-foreground/10 rounded" />
          </div>
        </div>
      </Illustration>
    ),
  },
  {
    icon: Gift,
    title: 'Optional Tour Prompt',
    description: 'After onboarding, choose to take the guided tour or skip it. Replay anytime from Settings.',
    tag: 'improved',
    illustration: (
      <Illustration gradient="bg-gradient-to-br from-sky-500/15 via-secondary/20 to-primary/10">
        <div className="w-40 h-14 rounded-xl bg-card/70 border border-border/40 p-2 flex flex-col items-center justify-center gap-1.5">
          <div className="h-1.5 w-20 bg-foreground/15 rounded" />
          <div className="flex gap-2">
            <div className="px-3 py-1 rounded-md bg-border/30 text-[8px] text-muted-foreground font-medium">Skip</div>
            <div className="px-3 py-1 rounded-md bg-primary/80 text-[8px] text-primary-foreground font-medium">Take tour</div>
          </div>
        </div>
      </Illustration>
    ),
  },
  {
    icon: Sparkles,
    title: 'Pulse Spotlight Animation',
    description: 'Tour highlights now feature a breathing glow effect to draw attention to key UI elements.',
    tag: 'improved',
    illustration: (
      <Illustration gradient="bg-gradient-to-br from-primary/10 via-background to-primary/15">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-10 rounded-lg bg-card/60 border border-border/40" />
          <div className="absolute inset-0 m-auto w-20 h-14 rounded-lg border-2 border-primary/60 animate-pulse" style={{ boxShadow: '0 0 16px hsl(var(--primary) / 0.3)' }} />
          <div className="absolute inset-0 m-auto w-24 h-[72px] rounded-lg border border-primary/30 animate-[spotlight-pulse_2s_ease-in-out_infinite]" />
        </div>
      </Illustration>
    ),
  },
];

const tagStyles: Record<string, string> = {
  new: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  improved: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  fix: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
};

const WhatsNewOverlay = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const dismissed: string[] = raw ? JSON.parse(raw) : [];
      // Only show if this version hasn't been dismissed
      if (!dismissed.includes(APP_VERSION)) {
        const timer = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // Corrupt data — show overlay once
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const dismissed: string[] = raw ? JSON.parse(raw) : [];
      if (!dismissed.includes(APP_VERSION)) dismissed.push(APP_VERSION);
      // Keep only last 10 versions to avoid unbounded growth
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed.slice(-10)));
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([APP_VERSION]));
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={dismiss} />

      {/* Card */}
      <div className="relative w-full max-w-md bg-card border border-border/50 rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 duration-300 overflow-hidden">
        {/* Header accent bar */}
        <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

        <div className="p-5">
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">What's New</h2>
                <p className="text-[10px] text-muted-foreground font-mono tracking-wide">v{APP_VERSION}</p>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Entries */}
          <div className="space-y-3 mb-5 max-h-[55vh] overflow-y-auto pr-1">
            {CHANGELOG.map((entry, i) => {
              const Icon = entry.icon;
              return (
                <div
                  key={i}
                  className="rounded-xl bg-secondary/30 border border-border/30 overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2"
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
                >
                  {entry.illustration}
                  <div className="flex gap-3 px-3 pb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-foreground">{entry.title}</span>
                        {entry.tag && (
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${tagStyles[entry.tag]}`}>
                            {entry.tag}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{entry.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dismiss button */}
          <button
            onClick={dismiss}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsNewOverlay;
