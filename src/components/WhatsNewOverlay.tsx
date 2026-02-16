import { useState, useEffect } from 'react';
import { X, Sparkles, Gift, Compass, Eye } from 'lucide-react';

interface ChangelogEntry {
  icon: typeof Sparkles;
  title: string;
  description: string;
  tag?: 'new' | 'improved' | 'fix';
}

const APP_VERSION = '1.3.0';
const STORAGE_KEY = 'superhuman_last_seen_version';

const CHANGELOG: ChangelogEntry[] = [
  {
    icon: Compass,
    title: 'Interactive Guided Tour',
    description: 'New spotlight-based walkthrough with auto-tab navigation that introduces every feature when you first sign up.',
    tag: 'new',
  },
  {
    icon: Eye,
    title: 'Compound Info Popouts',
    description: 'Tap the ⓘ icon on any compound during onboarding or in your inventory to see benefits, dosing guidance, and expected timelines.',
    tag: 'new',
  },
  {
    icon: Gift,
    title: 'Optional Tour Prompt',
    description: 'After onboarding, choose to take the guided tour or skip it. Replay anytime from Settings.',
    tag: 'improved',
  },
  {
    icon: Sparkles,
    title: 'Pulse Spotlight Animation',
    description: 'Tour highlights now feature a breathing glow effect to draw attention to key UI elements.',
    tag: 'improved',
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
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    if (lastSeen !== APP_VERSION) {
      // Small delay so it doesn't compete with page load
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
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
                  className="flex gap-3 p-3 rounded-xl bg-secondary/30 border border-border/30 animate-in fade-in-0 slide-in-from-bottom-2"
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
                >
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
