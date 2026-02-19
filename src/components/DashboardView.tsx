import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Compound } from '@/data/compounds';
import { Target, Plus, Shield, Scale, Rocket, Ruler, Weight, Percent, Calendar as CalendarIcon, Check, ToggleLeft, ChevronRight, Sparkles, Package, AlertTriangle, TrendingUp, TrendingDown, Zap, Info, Brain, Heart, Dumbbell, Flame, Activity, History, LayoutGrid } from 'lucide-react';
import bodyMaleImg from '@/assets/body-male.png';
import bodyFemaleImg from '@/assets/body-female.png';
import { useScheduleSnapshots } from '@/hooks/useScheduleSnapshots';
import InfoTooltip from '@/components/InfoTooltip';
import { AppFeatures } from '@/lib/appFeatures';
import FeatureTeaserCard from '@/components/FeatureTeaserCard';
import { getGoalIcon } from '@/lib/goalIcons';
import { kgToLbs, lbsToKg } from '@/lib/measurements';
import { StackAnalysis } from '@/hooks/useProtocolAnalysis';
import { ToleranceLevel } from '@/hooks/useProtocolAnalysis';
import { UserGoal } from '@/hooks/useGoals';
import { UserProfile, ToleranceEntry } from '@/hooks/useProfile';
import { useGoalReadings } from '@/hooks/useGoalReadings';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MeasurementSystem, DoseUnitPreference, displayHeight, displayWeight } from '@/lib/measurements';
import ProtocolOutcomesCard from '@/components/ProtocolOutcomesCard';
import ProtocolIntelligenceCard from '@/components/ProtocolIntelligenceCard';
import MiniSparkline from '@/components/MiniSparkline';
import { computeZoneIntensities, BODY_ZONES, BodyZone } from '@/data/bodyZoneMapping';
import ZoneDetailDrawer from '@/components/ZoneDetailDrawer';
import GenderSelector from '@/components/GenderSelector';
import ConfirmDialog from '@/components/ConfirmDialog';

interface DashboardViewProps {
  compounds: Compound[];
  stackAnalysis?: StackAnalysis | null;
  aiLoading?: boolean;
  needsRefresh?: boolean;
  toleranceLevel?: string;
  onAnalyzeStack?: () => void;
  onViewAIInsights?: () => void;
  onViewOutcomes?: () => void;
  goals?: UserGoal[];
  userId?: string;
  profile?: UserProfile | null;
  toleranceHistory?: ToleranceEntry[];
  onUpdateProfile?: (updates: Partial<UserProfile>) => Promise<void>;
  onToleranceChange?: (level: ToleranceLevel) => void;
  measurementSystem?: MeasurementSystem;
  doseUnitPreference?: DoseUnitPreference;
  onNavigateToInventory?: () => void;
  conversationManager?: {
    createProject: (name: string, description?: string, color?: string) => Promise<any>;
    createConversation: (title?: string, projectId?: string) => Promise<any>;
    projects: { id: string; name: string }[];
    refreshConversation: (convId: string, lastContent: string) => void;
  };
  appFeatures?: AppFeatures;
  onEnableFeature?: (key: keyof AppFeatures) => void;
  onAddCompound?: () => void;
}

const toleranceMeta: Record<string, { Icon: typeof Shield; label: string; color: string }> = {
  conservative: { Icon: Shield, label: 'Conservative', color: 'text-blue-400' },
  moderate: { Icon: Scale, label: 'Moderate', color: 'text-primary' },
  performance: { Icon: Rocket, label: 'Performance', color: 'text-rose-400' },
};

// Goal type icons now use Lucide — see goalIcons.tsx

function getProgress(goal: UserGoal, firstReading?: number): number | null {
  const baseline = goal.baseline_value ?? firstReading ?? null;
  if (!goal.target_value || baseline == null) return null;
  const current = goal.current_value ?? baseline;
  const range = goal.target_value - baseline;
  if (range === 0) return 100;
  return Math.min(100, Math.max(0, Math.round(((current - baseline) / range) * 100)));
}

const GoalCard = ({ goal, GoalIcon, progress, progressVal, barColor, sparkData, onViewOutcomes, onAddReading }: {
  goal: UserGoal; GoalIcon: React.ComponentType<{ className?: string }>; progress: number | null; progressVal: number; barColor: string;
  sparkData: number[]; onViewOutcomes?: () => void; onAddReading: (value: number) => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setSubmitting(true);
    await onAddReading(num);
    setValue('');
    setOpen(false);
    setSubmitting(false);
  };

  return (
    <div className="bg-card/60 backdrop-blur-sm rounded-lg border border-border/30 p-3 hover:border-primary/30 transition-all duration-300">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={onViewOutcomes}>
          <span className="text-sm flex-shrink-0"><GoalIcon className="w-4 h-4 text-primary" /></span>
          <span className="text-xs font-medium text-foreground truncate">{goal.title}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <MiniSparkline values={sparkData} width={40} height={14} />
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button onClick={(e) => e.stopPropagation()} className="p-0.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-primary" title="Quick add reading">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="end" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
                <Input type="number" step="any" placeholder={goal.target_unit || 'Value'} value={value} onChange={(e) => setValue(e.target.value)} className="h-7 text-xs" autoFocus />
                <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={submitting || !value}>Add</Button>
              </form>
            </PopoverContent>
          </Popover>
          <span className="text-xs font-mono font-semibold text-foreground w-8 text-right">
            {progress !== null ? `${progress}%` : '—'}
          </span>
        </div>
      </div>
      <div className="h-1 bg-secondary/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${progressVal}%` }} />
      </div>
      {goal.current_value != null && goal.target_unit && (
        <div className="mt-1 text-[9px] font-mono text-muted-foreground/70">
          {goal.current_value}{goal.target_unit}
          {goal.target_value != null && <span className="text-muted-foreground/40"> → {goal.target_value}{goal.target_unit}</span>}
        </div>
      )}
    </div>
  );
};

// Zone legend with color-coded labels (kept for possible reuse)
const ZoneLegend = ({ zoneIntensities, onZoneTap }: { zoneIntensities: Record<BodyZone, number>; onZoneTap?: (zone: BodyZone) => void }) => {
  const activeZones = (Object.entries(zoneIntensities) as Array<[BodyZone, number]>)
    .filter(([, v]) => v > 0.1)
    .sort((a, b) => b[1] - a[1]);

  if (activeZones.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {activeZones.map(([zone, intensity]) => (
        <button
          key={zone}
          onClick={() => onZoneTap?.(zone)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/40 border border-border/20 hover:border-primary/30 transition-all active:scale-95"
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: BODY_ZONES[zone].color,
              boxShadow: `0 0 ${4 + intensity * 6}px ${BODY_ZONES[zone].color}`,
            }}
          />
          <span className="text-[10px] font-medium text-muted-foreground">{BODY_ZONES[zone].label}</span>
          <span className="text-[9px] font-mono text-muted-foreground/50">{Math.round(intensity * 100)}%</span>
        </button>
      ))}
    </div>
  );
};

// ── Clean Body Image (no heatmap overlay) ─────────────────────────────

const CartoonBody = ({
  gender,
}: {
  gender?: string | null;
  onZoneTap?: (zone: BodyZone) => void;
  zoneIntensities: Record<BodyZone, number>;
}) => {
  const imgSrc = gender === 'female' ? bodyFemaleImg : bodyMaleImg;

  return (
    <div className="relative w-full h-full bg-transparent">
      {/* Use multiply blend to make the white PNG background disappear against any card color.
          In dark mode, use screen blend instead to keep the image visible */}
      <img
        src={imgSrc}
        alt="Body coverage map"
        className="w-full h-full object-contain object-top dark:mix-blend-screen"
        style={{ mixBlendMode: 'multiply' }}
        draggable={false}
      />
    </div>
  );
};

// ── Protocol Coverage Card ──────────────────────────────────────────

const ZONE_ICONS_MAP: Record<BodyZone, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  brain: Brain,
  heart: Heart,
  arms: Dumbbell,
  core: Flame,
  legs: Activity,
  immune: Shield,
  hormonal: Zap,
};

interface ProtocolCoverageCardProps {
  activeCompounds: Compound[];
  zoneIntensities: Record<BodyZone, number>;
  bodyCoverage: number;
  displayGender?: string | null;
  onZoneTap: (zone: BodyZone) => void;
  onAddCompound?: () => void;
}

type LayoutStyle = 'classic' | 'hero' | 'split' | 'compact' | 'immersive' | 'insight';

const LAYOUT_OPTIONS: Array<{ id: LayoutStyle; label: string; desc: string }> = [
  { id: 'classic',  label: 'Classic',  desc: 'Body left · bars right' },
  { id: 'hero',     label: 'Hero',     desc: 'Full-width glowing body' },
  { id: 'split',    label: 'Split',    desc: 'Score top · body full-width' },
  { id: 'compact',  label: 'Compact',  desc: 'Mini body · rings' },
  { id: 'immersive',label: 'Immersive',desc: 'Body fills card bg' },
  { id: 'insight',  label: 'Insight',  desc: 'AI insight · coverage rings' },
];

// ── Radial Coverage Rings ──────────────────────────────────────────────
const CoverageRings = ({ zoneIntensities, onZoneTap }: { zoneIntensities: Record<BodyZone, number>; onZoneTap: (z: BodyZone) => void }) => {
  const R = 20, STROKE = 5, C = 2 * Math.PI * R;
  const zones = Object.keys(BODY_ZONES) as BodyZone[];
  return (
    <div className="grid grid-cols-4 gap-x-2 gap-y-3">
      {zones.map(zone => {
        const info = BODY_ZONES[zone];
        const Icon = ZONE_ICONS_MAP[zone];
        const intensity = zoneIntensities[zone] ?? 0;
        const pct = Math.round(intensity * 100);
        const dash = (pct / 100) * C;
        const isUncovered = pct === 0;
        const ringColor = isUncovered ? 'hsl(var(--muted-foreground) / 0.15)' : info.color;
        return (
          <button
            key={zone}
            onClick={() => onZoneTap(zone)}
            className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
          >
            <div className="relative">
              <svg width="52" height="52" viewBox="0 0 52 52">
                {/* Track */}
                <circle cx="26" cy="26" r={R} fill="none" stroke="hsl(var(--secondary))" strokeWidth={STROKE} />
                {/* Fill arc */}
                {pct > 0 && (
                  <circle
                    cx="26" cy="26" r={R}
                    fill="none"
                    stroke={info.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${dash} ${C}`}
                    strokeLinecap="round"
                    transform="rotate(-90 26 26)"
                    style={{ filter: `drop-shadow(0 0 5px ${info.color}80)` }}
                  />
                )}
              </svg>
              {/* Icon centered */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon className="w-3.5 h-3.5" style={{ color: ringColor }} />
              </div>
            </div>
            <span className="text-[8px] font-mono font-bold" style={{ color: isUncovered ? 'hsl(var(--muted-foreground) / 0.3)' : info.color }}>
              {isUncovered ? '—' : `${pct}%`}
            </span>
            <span className="text-[8px] text-muted-foreground/50 text-center leading-tight">{info.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// ── AI Daily Insight ──────────────────────────────────────────────────
type InsightType = 'performance' | 'recommendation' | 'symptom';

const INSIGHT_TABS: Array<{ id: InsightType; label: string; emoji: string }> = [
  { id: 'performance',    label: 'Stack',  emoji: '⚡' },
  { id: 'recommendation', label: 'Today',  emoji: '🎯' },
  { id: 'symptom',        label: 'Body',   emoji: '🧬' },
];

const INSIGHT_ORDER: InsightType[] = ['performance', 'recommendation', 'symptom'];

const AIInsightPanel = ({ activeCompounds, goals }: { activeCompounds: Compound[]; goals?: any[] }) => {
  const [activeTab, setActiveTab] = useState<InsightType>('performance');
  const [insights, setInsights] = useState<Partial<Record<InsightType, string>>>({});
  const [loading, setLoading] = useState<InsightType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const autoRotateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInsight = useCallback(async (type: InsightType, cachedInsights?: Partial<Record<InsightType, string>>) => {
    const cache = cachedInsights ?? insights;
    if (cache[type]) return; // cached
    if (activeCompounds.length === 0) return;
    setLoading(type);
    setError(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-insight`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ compounds: activeCompounds, goals: goals || [], symptoms: [], insightType: type }),
        }
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setInsights(prev => ({ ...prev, [type]: data.insight }));
      }
    } catch {
      setError('Failed to load insight');
    } finally {
      setLoading(null);
    }
  }, [activeCompounds, goals, insights]);

  // Load first tab on mount
  useEffect(() => {
    fetchInsight('performance');
  }, []);

  // Auto-rotate every 10 seconds
  useEffect(() => {
    if (isPaused) { clearInterval(autoRotateRef.current!); return; }
    autoRotateRef.current = setInterval(() => {
      setActiveTab(prev => {
        const idx = INSIGHT_ORDER.indexOf(prev);
        const next = INSIGHT_ORDER[(idx + 1) % INSIGHT_ORDER.length];
        // Prefetch next insight if not cached
        setInsights(cache => {
          if (!cache[next] && activeCompounds.length > 0) {
            fetchInsight(next, cache);
          }
          return cache;
        });
        return next;
      });
    }, 10000);
    return () => clearInterval(autoRotateRef.current!);
  }, [isPaused, activeCompounds, fetchInsight]);

  const handleTabChange = (type: InsightType) => {
    setActiveTab(type);
    fetchInsight(type);
    // Reset auto-rotate timer when user manually switches
    clearInterval(autoRotateRef.current!);
    if (!isPaused) {
      autoRotateRef.current = setInterval(() => {
        setActiveTab(prev => {
          const idx = INSIGHT_ORDER.indexOf(prev);
          const next = INSIGHT_ORDER[(idx + 1) % INSIGHT_ORDER.length];
          setInsights(cache => {
            if (!cache[next] && activeCompounds.length > 0) fetchInsight(next, cache);
            return cache;
          });
          return next;
        });
      }, 10000);
    }
  };

  const currentInsight = insights[activeTab];
  const isLoading = loading === activeTab;

  return (
    <div
      className="px-4 pt-4 pb-3 space-y-3"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setTimeout(() => setIsPaused(false), 3000)}
    >
      {/* Tab row */}
      <div className="flex gap-1.5">
        {INSIGHT_TABS.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-medium transition-all active:scale-95 ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {/* Rotation indicator dots */}
          <div className="flex items-center gap-0.5">
            {INSIGHT_ORDER.map(t => (
              <div key={t} className={`w-1 h-1 rounded-full transition-all ${activeTab === t ? 'bg-primary scale-125' : 'bg-muted-foreground/25'}`} />
            ))}
          </div>
          <button
            onClick={() => { setInsights(prev => ({ ...prev, [activeTab]: undefined })); fetchInsight(activeTab); }}
            className="text-[9px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Insight text */}
      <div className="min-h-[72px] flex items-start">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground/50">
            <div className="flex gap-0.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
            <span className="text-[11px]">Generating insight…</span>
          </div>
        ) : error ? (
          <p className="text-[11px] text-destructive/70">{error}</p>
        ) : activeCompounds.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/50">Add compounds to generate AI insights.</p>
        ) : currentInsight ? (
          <p className="text-[12px] text-foreground leading-relaxed">{currentInsight}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground/40 italic">Tap a tab to load insight.</p>
        )}
      </div>
      {!isPaused && activeCompounds.length > 0 && (
        <p className="text-[8px] text-muted-foreground/25 text-right">auto-rotating · hover to pause</p>
      )}
      {isPaused && (
        <p className="text-[8px] text-muted-foreground/40 text-right">paused</p>
      )}
    </div>
  );
};

const ZoneBars = ({ zoneEntries, onZoneTap }: { zoneEntries: Array<[BodyZone, number]>; onZoneTap: (z: BodyZone) => void }) => (
  <div className="space-y-1.5">
    {zoneEntries.map(([zone, intensity]) => {
      const info = BODY_ZONES[zone];
      const Icon = ZONE_ICONS_MAP[zone];
      const pct = Math.round(intensity * 100);
      const isSaturated = pct >= 95;
      const isWeak = pct > 0 && pct < 40;
      const isUncovered = pct === 0;
      const barColor = isSaturated ? 'hsl(142 80% 50%)' : isWeak ? 'hsl(45 100% 55%)' : info.color;
      return (
        <button key={zone} onClick={() => onZoneTap(zone)} className="w-full flex items-center gap-1.5 group active:scale-[0.98] transition-transform">
          <Icon className="w-3 h-3 flex-shrink-0" style={{ color: isUncovered ? 'hsl(var(--muted-foreground) / 0.25)' : info.color }} />
          <div className="flex-1 h-1.5 bg-secondary/40 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: barColor, boxShadow: pct > 40 ? `0 0 5px ${barColor}90` : 'none' }} />
          </div>
          <span className="text-[9px] font-mono w-6 text-right flex-shrink-0 tabular-nums" style={{ color: isUncovered ? 'hsl(var(--muted-foreground) / 0.25)' : barColor }}>
            {isUncovered ? '—' : pct}
          </span>
        </button>
      );
    })}
  </div>
);

const ScoreBlock = ({ bodyCoverage, activeCount, activeZones, coverageGrade }: { bodyCoverage: number; activeCount: number; activeZones: number; coverageGrade: { label: string; color: string; glow: string; border: string } }) => (
  <div>
    <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-0.5">Protocol Coverage</p>
    <div className="flex items-baseline gap-2 mb-0.5">
      <span className={`text-4xl font-black font-mono leading-none ${coverageGrade.color}`} style={{ textShadow: `0 0 24px ${coverageGrade.glow}50` }}>
        {bodyCoverage}%
      </span>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${coverageGrade.border} ${coverageGrade.color}`}>{coverageGrade.label}</span>
    </div>
    <p className="text-[9px] text-muted-foreground/50">{activeCount} compounds · {activeZones}/7 systems</p>
  </div>
);

const ProtocolCoverageCard = ({ activeCompounds, zoneIntensities, bodyCoverage, displayGender, onZoneTap, onAddCompound }: ProtocolCoverageCardProps) => {
  const [showExplainer, setShowExplainer] = useState(false);
  const [layout, setLayout] = useState<LayoutStyle>('insight');
  const [showLayoutPicker, setShowLayoutPicker] = useState(false);

  const zoneEntries = useMemo(() =>
    (Object.entries(zoneIntensities) as Array<[BodyZone, number]>).sort((a, b) => b[1] - a[1]),
    [zoneIntensities]
  );

  const uncoveredZones = zoneEntries.filter(([, v]) => v <= 0.1);
  const saturatedZones = zoneEntries.filter(([, v]) => v >= 0.95);

  const alerts = useMemo(() => {
    const list: Array<{ type: 'danger' | 'warning' | 'info'; message: string }> = [];
    if (uncoveredZones.length > 0) list.push({ type: 'warning', message: `${uncoveredZones.map(([z]) => BODY_ZONES[z].label).join(', ')} ${uncoveredZones.length === 1 ? 'has' : 'have'} no active compounds.` });
    if (saturatedZones.length >= 3) list.push({ type: 'info', message: `${saturatedZones.length} zones at peak saturation — tap any to audit for redundant spend.` });
    if (activeCompounds.length > 20) list.push({ type: 'warning', message: `${activeCompounds.length} compounds is a large stack. Consider a redundancy audit.` });
    return list;
  }, [uncoveredZones, saturatedZones, activeCompounds.length]);

  const coverageGrade = bodyCoverage >= 90
    ? { label: 'Elite', color: 'text-emerald-400', glow: 'hsl(142 80% 50%)', border: 'border-emerald-500/40' }
    : bodyCoverage >= 75 ? { label: 'Strong', color: 'text-primary', glow: 'hsl(var(--primary))', border: 'border-primary/40' }
    : bodyCoverage >= 55 ? { label: 'Moderate', color: 'text-amber-400', glow: 'hsl(45 100% 55%)', border: 'border-amber-500/40' }
    : { label: 'Low', color: 'text-rose-400', glow: 'hsl(0 72% 51%)', border: 'border-rose-500/40' };

  if (activeCompounds.length === 0) {
    return (
      <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden">
        <div className="py-12 flex items-center justify-center">
          <div className="text-center px-6">
            <Package className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">No Compounds Yet</h3>
            <p className="text-xs text-muted-foreground mb-4">Add your first compound to light up the body map and see protocol analysis.</p>
            {onAddCompound && (
              <button onClick={onAddCompound} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all active:scale-95">
                <Plus className="w-4 h-4" />Add Compound
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const bodyImg = (
    <CartoonBody
      zoneIntensities={zoneIntensities}
      gender={displayGender}
    />
  );

  const activeZoneCount = zoneEntries.filter(([, v]) => v > 0.1).length;

  const renderHero = () => {
    // ── Layout 1: Classic — body left, bars right ──────────────
    if (layout === 'classic') return (
      <div className="flex items-stretch" style={{ minHeight: '300px' }}>
        <div className="w-[38%] flex items-center justify-center py-4 pl-4">
          <div className="relative w-full" style={{ maxWidth: '110px', height: '290px' }}>
            {bodyImg}
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center pr-4 py-4 pl-3 space-y-3">
          <ScoreBlock bodyCoverage={bodyCoverage} activeCount={activeCompounds.length} activeZones={activeZoneCount} coverageGrade={coverageGrade} />
          <ZoneBars zoneEntries={zoneEntries} onZoneTap={onZoneTap} />
          <button onClick={() => setShowExplainer(v => !v)} className="flex items-center gap-1 text-[9px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors self-start">
            <Info className="w-3 h-3" />How is this scored?
          </button>
        </div>
      </div>
    );

    // ── Layout 2: Hero — big body centered, score overlaid bottom ──────────────
    if (layout === 'hero') return (
      <div className="relative flex flex-col items-center py-5" style={{ minHeight: '340px' }}>
        <div className="relative w-full flex justify-center" style={{ height: '260px', maxWidth: '130px', margin: '0 auto' }}>
          {bodyImg}
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <div>
            <span className={`text-3xl font-black font-mono ${coverageGrade.color}`} style={{ textShadow: `0 0 20px ${coverageGrade.glow}60` }}>{bodyCoverage}%</span>
            <p className="text-[9px] text-muted-foreground/60">{activeCompounds.length} compounds</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${coverageGrade.border} ${coverageGrade.color}`}>{coverageGrade.label}</span>
        </div>
      </div>
    );

    // ── Layout 3: Split — score banner top, body full-width centered, bars below ──────────────
    if (layout === 'split') return (
      <div>
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <ScoreBlock bodyCoverage={bodyCoverage} activeCount={activeCompounds.length} activeZones={activeZoneCount} coverageGrade={coverageGrade} />
        </div>
        <div className="flex justify-center px-6" style={{ height: '220px' }}>
          {bodyImg}
        </div>
        <div className="px-4 pb-4 pt-2">
          <ZoneBars zoneEntries={zoneEntries} onZoneTap={onZoneTap} />
        </div>
      </div>
    );

    // ── Layout 4: Compact — mini body right, score+rings left ──────────────
    if (layout === 'compact') return (
      <div className="flex items-center gap-4 px-4 py-4">
        <div className="flex-1 space-y-2">
          <ScoreBlock bodyCoverage={bodyCoverage} activeCount={activeCompounds.length} activeZones={activeZoneCount} coverageGrade={coverageGrade} />
          <ZoneBars zoneEntries={zoneEntries.slice(0, 4)} onZoneTap={onZoneTap} />
          <p className="text-[8px] text-muted-foreground/40">{zoneEntries.length - 4} more zones — tap body</p>
        </div>
        <div className="flex-shrink-0" style={{ width: '90px', height: '200px' }}>
          {bodyImg}
        </div>
      </div>
    );

    // ── Layout 5: Immersive — body is the full card background, overlay text ──────────────
    if (layout === 'immersive') return (
      <div className="relative overflow-hidden" style={{ minHeight: '340px' }}>
        {/* Body as large faded BG */}
        <div className="absolute inset-0 flex justify-center items-start opacity-60 pt-2">
          <div style={{ width: '140px', height: '100%' }}>
            {bodyImg}
          </div>
        </div>
        {/* Gradient overlay bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-card via-card/80 to-transparent" />
        {/* Content on top */}
        <div className="relative z-10 flex flex-col justify-end h-full px-4 pb-4 pt-16">
          <ScoreBlock bodyCoverage={bodyCoverage} activeCount={activeCompounds.length} activeZones={activeZoneCount} coverageGrade={coverageGrade} />
          <div className="mt-3">
            <ZoneBars zoneEntries={zoneEntries} onZoneTap={onZoneTap} />
          </div>
        </div>
      </div>
    );

    // ── Layout 6: Insight — AI daily insight + radial coverage rings ──────────────
    if (layout === 'insight') return (
      <div className="space-y-1">
        {/* Score strip */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50 font-semibold mb-0.5">Protocol Coverage</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black font-mono leading-none ${coverageGrade.color}`} style={{ textShadow: `0 0 20px ${coverageGrade.glow}50` }}>
                {bodyCoverage}%
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${coverageGrade.border} ${coverageGrade.color}`}>{coverageGrade.label}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-muted-foreground/40">{activeCompounds.length} compounds</p>
            <p className="text-[9px] text-muted-foreground/40">{activeZoneCount}/7 systems</p>
          </div>
        </div>

        {/* Coverage Rings */}
        <div className="px-4 pb-3">
          <CoverageRings zoneIntensities={zoneIntensities} onZoneTap={onZoneTap} />
        </div>

        {/* Divider */}
        <div className="border-t border-border/20 mx-4" />

        {/* AI Insight Panel */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-0">
          <Sparkles className="w-3 h-3 text-primary/60" />
          <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/50 font-semibold">AI Daily Insight</p>
        </div>
        <AIInsightPanel activeCompounds={activeCompounds} goals={[]} />
      </div>
    );

    return null;
  };

  return (
    <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden">

      {/* Layout picker toggle row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/50 font-semibold">Body Coverage Map</p>
        <button
          onClick={() => setShowLayoutPicker(v => !v)}
          className="flex items-center gap-1 text-[9px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
        >
          <LayoutGrid className="w-3 h-3" />
          Layout
        </button>
      </div>

      {/* Layout picker chips */}
      {showLayoutPicker && (
        <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
          {LAYOUT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => { setLayout(opt.id); setShowLayoutPicker(false); }}
              className={`flex flex-col px-2.5 py-1.5 rounded-lg border text-left transition-all active:scale-95 ${
                layout === opt.id
                  ? 'border-primary/60 bg-primary/10 text-primary'
                  : 'border-border/30 bg-secondary/20 text-muted-foreground hover:border-border/60'
              }`}
            >
              <span className="text-[10px] font-semibold">{opt.label}</span>
              <span className="text-[8px] opacity-60">{opt.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── The Hero (swappable layout) ── */}
      {renderHero()}

      {/* ── Explainer ── */}
      {showExplainer && (
        <div className="mx-4 mb-4 rounded-xl bg-secondary/20 border border-border/20 p-3 text-[11px] text-muted-foreground space-y-2 leading-relaxed">
          <p><span className="text-foreground font-semibold">What is Protocol Coverage?</span> A weighted average of how effectively your compounds address 7 body systems.</p>
          <p><span className="text-foreground font-semibold">How is it calculated?</span> Each zone scores 0–100% based on the strongest compound targeting it. Overall score = average across all 7 zones.</p>
          <p><span className="text-foreground font-semibold">What does 100% per zone mean?</span> Peak mapped efficacy — more compounds won't improve the zone, just increase cost.</p>
        </div>
      )}

      {/* ── Alerts ── */}
      {alerts.length > 0 && layout !== 'insight' && (
        <div className="px-4 pb-3 space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-[11px] leading-snug ${
              alert.type === 'danger' ? 'bg-destructive/10 border border-destructive/30 text-destructive'
              : alert.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              : 'bg-primary/10 border border-primary/30 text-primary'
            }`}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-3 flex items-center gap-1.5 text-[9px] text-muted-foreground/35 border-t border-border/10 pt-2 mt-1">
        <Sparkles className="w-3 h-3 flex-shrink-0" />
        <span>{layout === 'insight' ? 'Tap any ring to drill into zone compounds & AI audit' : 'Tap body or zone bars for AI analysis & redundancy audits'}</span>
      </div>
    </div>
  );
};

// ── Stack Score History Sparkline ──────────────────────────────────────

const StackScoreHistory = ({ snapshots, currentScore }: {
  snapshots: ReturnType<typeof useScheduleSnapshots>['snapshots'];
  currentScore: number;
}) => {
  const dataPoints = useMemo(() => {
    if (snapshots.length === 0) return [];

    const points = snapshots
      .slice()
      .sort((a, b) => a.week_start_date.localeCompare(b.week_start_date))
      .map(snap => {
        const ids = ((snap.compound_snapshots || []) as Compound[])
          .filter(c => !c.notes?.includes('[DORMANT]'))
          .map(c => c.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
        const intensities = computeZoneIntensities(ids);
        const zones = Object.values(intensities);
        const score = zones.length > 0
          ? Math.round((zones.reduce((s, v) => s + v, 0) / zones.length) * 100)
          : 0;
        return {
          score,
          label: new Date(snap.week_start_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        };
      });

    // Replace last point with live current score
    if (points.length > 0) points[points.length - 1].score = currentScore;
    return points;
  }, [snapshots, currentScore]);

  if (dataPoints.length < 2) return null;

  const scores = dataPoints.map(p => p.score);
  const minScore = Math.max(0, Math.min(...scores) - 8);
  const maxScore = Math.min(100, Math.max(...scores) + 8);
  const range = maxScore - minScore || 1;

  const W = 280, H = 60, PX = 4, PY = 8;
  const xStep = (W - PX * 2) / (dataPoints.length - 1);

  const pts = dataPoints.map((p, i) => ({
    x: PX + i * xStep,
    y: PY + (1 - (p.score - minScore) / range) * (H - PY * 2),
    ...p,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;

  const delta = scores[scores.length - 1] - scores[0];
  const trendColor = delta > 2 ? 'hsl(142 80% 50%)' : delta < -2 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))';
  const TrendIcon = delta > 2 ? TrendingUp : delta < -2 ? TrendingDown : Activity;

  return (
    <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden">
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-muted-foreground/60" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 font-semibold">Stack Score History</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendIcon className="w-3 h-3" style={{ color: trendColor }} />
            <span className="text-[10px] font-mono font-semibold" style={{ color: trendColor }}>
              {delta > 0 ? '+' : ''}{delta}% over {dataPoints.length}w
            </span>
          </div>
        </div>

        {/* SVG Sparkline */}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '60px' }}>
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={trendColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={trendColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#scoreGrad)" />
          <path
            d={linePath}
            fill="none"
            stroke={trendColor}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 4px ${trendColor}70)` }}
          />
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === pts.length - 1 ? 3.5 : 2}
              fill={i === pts.length - 1 ? trendColor : 'hsl(var(--card))'}
              stroke={trendColor}
              strokeWidth="1.2"
              style={i === pts.length - 1 ? { filter: `drop-shadow(0 0 5px ${trendColor})` } : undefined}
            />
          ))}
        </svg>

        {/* X-axis labels — first and last */}
        <div className="flex items-center justify-between mt-0.5 px-1">
          <span className="text-[8px] text-muted-foreground/40 font-mono">{pts[0].label}</span>
          <span className="text-[8px] text-muted-foreground/40 font-mono">{pts[pts.length - 1].label}</span>
        </div>
      </div>

      <div className="border-t border-border/10 px-4 py-2 flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground/40">Peak <span className="font-mono text-muted-foreground/70">{Math.max(...scores)}%</span></span>
        <span className="text-[9px] text-muted-foreground/40">Low <span className="font-mono text-muted-foreground/70">{Math.min(...scores)}%</span></span>
        <span className="text-[9px] text-muted-foreground/40">Avg <span className="font-mono text-muted-foreground/70">{Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%</span></span>
      </div>
    </div>
  );
};


const ProfileToleranceBar = ({ profile, toleranceLevel, toleranceHistory, onUpdateProfile, onToleranceChange, onGenderChange, measurementSystem = 'metric', onNavigateToInventory }: {
  profile?: UserProfile | null;
  toleranceLevel?: string;
  toleranceHistory?: ToleranceEntry[];
  onUpdateProfile?: (updates: Partial<UserProfile>) => Promise<void>;
  onToleranceChange?: (level: ToleranceLevel) => void;
  onGenderChange?: (gender: string, temporary: boolean) => void;
  measurementSystem?: MeasurementSystem;
  onNavigateToInventory?: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState(profile?.body_fat_pct?.toString() || '');
  const [age, setAge] = useState(profile?.age?.toString() || '');
  const [showToleranceConfirm, setShowToleranceConfirm] = useState(false);
  const [pendingTolerance, setPendingTolerance] = useState<ToleranceLevel | null>(null);

  // Convert stored metric values to display units
  const toDisplayHeight = useCallback((cm: number | null | undefined) => {
    if (!cm) return '';
    return measurementSystem === 'imperial' ? (cm / 2.54).toFixed(1) : cm.toString();
  }, [measurementSystem]);

  const toDisplayWeight = useCallback((kg: number | null | undefined) => {
    if (!kg) return '';
    return measurementSystem === 'imperial' ? kgToLbs(kg).toString() : kg.toString();
  }, [measurementSystem]);

  // Re-sync form values when profile or measurement system changes, but NOT while editing
  useEffect(() => {
    if (editing) return;
    setHeight(toDisplayHeight(profile?.height_cm));
    setWeight(toDisplayWeight(profile?.weight_kg));
    setBodyFat(profile?.body_fat_pct?.toString() || '');
    setAge(profile?.age?.toString() || '');
  }, [profile, measurementSystem, toDisplayHeight, toDisplayWeight, editing]);

  const handleSave = async () => {
    if (!onUpdateProfile) return;
    const heightVal = height ? parseFloat(height) : null;
    const weightVal = weight ? parseFloat(weight) : null;
    // Convert back to metric for storage
    const heightCm = heightVal != null
      ? (measurementSystem === 'imperial' ? Math.round(heightVal * 2.54) : heightVal)
      : null;
    const weightKg = weightVal != null
      ? (measurementSystem === 'imperial' ? lbsToKg(weightVal) : weightVal)
      : null;
    await onUpdateProfile({
      height_cm: heightCm,
      weight_kg: weightKg,
      body_fat_pct: bodyFat ? parseFloat(bodyFat) : null,
      age: age ? parseInt(age) : null,
    });
    setEditing(false);
    toast.success('Profile updated');
  };

  const handleToleranceSelect = (level: ToleranceLevel) => {
    setPendingTolerance(level);
    setShowToleranceConfirm(true);
  };

  const confirmTolerance = () => {
    if (pendingTolerance && onToleranceChange) {
      onToleranceChange(pendingTolerance);
      toast.success(`Tolerance locked to ${pendingTolerance}`);
    }
    setShowToleranceConfirm(false);
  };

  const latestTolerance = toleranceHistory?.[0];

  return (
    <div className="w-full space-y-2 mb-3">
      {/* Compact horizontal layout: Gender tabs | divider | Tolerance selector */}
      <div className="flex items-start gap-3 mb-2">
        {onGenderChange && (
          <div className="flex-shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Gender</p>
            <GenderSelector
              currentGender={profile?.gender}
              onGenderChange={onGenderChange}
              locked={!!profile?.gender}
            />
          </div>
        )}
        {onGenderChange && toleranceLevel && (
          <div className="w-px bg-border/40 self-stretch min-h-[48px]" />
        )}
        {toleranceLevel && (
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              Dosing Tolerance
              <InfoTooltip text="Conservative = lower doses & caution. Moderate = balanced approach. Performance = higher doses for advanced users." />
            </p>
            {(() => {
              const meta = toleranceMeta[toleranceLevel];
              if (!meta) return null;
              const colorClass = toleranceLevel === 'conservative' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                : toleranceLevel === 'performance' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-primary/10 border-primary/30 text-primary';
              return (
                <button
                  onClick={onNavigateToInventory}
                  className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-lg border transition-all hover:opacity-80 active:scale-95 ${colorClass}`}
                  title="Tap to change on Compounds tab"
                >
                  <meta.Icon className="w-3 h-3" />
                  <span>{meta.label}</span>
                  <ChevronRight className="w-3 h-3 opacity-50" />
                </button>
              );
            })()}
            {latestTolerance && (
              <p className="text-[9px] text-muted-foreground/60 font-mono mt-1">
                Set {new Date(latestTolerance.created_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Profile metrics row */}
      {!editing ? (
        <button
          onClick={() => setEditing(true)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/30 border border-border/20 hover:border-primary/30 transition-all"
        >
          <div className="flex items-center gap-3 flex-1 text-[10px] text-muted-foreground">
            {profile?.height_cm && <span className="flex items-center gap-0.5"><Ruler className="w-3 h-3" />{displayHeight(profile.height_cm, measurementSystem)}</span>}
            {profile?.weight_kg && <span className="flex items-center gap-0.5"><Weight className="w-3 h-3" />{displayWeight(profile.weight_kg, measurementSystem)}</span>}
            {profile?.body_fat_pct != null && <span className="flex items-center gap-0.5"><Percent className="w-3 h-3" />{profile.body_fat_pct}%</span>}
            {profile?.age && <span className="flex items-center gap-0.5"><CalendarIcon className="w-3 h-3" />{profile.age}y</span>}
            {!profile?.height_cm && !profile?.weight_kg && <span className="text-muted-foreground/50">Tap to add measurements</span>}
          </div>
        </button>
      ) : (
        <div className="px-3 py-3 rounded-lg bg-secondary/30 border border-primary/30 space-y-2">
          {/* Metric/Imperial toggle inside edit card */}
          <div className="flex items-center justify-between pb-1.5 border-b border-border/20">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Unit System</span>
            <button
              onClick={async () => {
                const newSystem = measurementSystem === 'metric' ? 'imperial' : 'metric';
                // Convert current form values to the new system
                const currentHeightVal = height ? parseFloat(height) : null;
                const currentWeightVal = weight ? parseFloat(weight) : null;
                if (currentHeightVal != null) {
                  // Convert between inches and cm
                  const newHeight = measurementSystem === 'metric'
                    ? (currentHeightVal / 2.54).toFixed(1)
                    : Math.round(currentHeightVal * 2.54).toString();
                  setHeight(newHeight);
                }
                if (currentWeightVal != null) {
                  const newWeight = measurementSystem === 'metric'
                    ? kgToLbs(currentWeightVal).toString()
                    : lbsToKg(currentWeightVal).toString();
                  setWeight(newWeight);
                }
                await onUpdateProfile?.({ measurement_system: newSystem } as any);
              }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
            >
              <ToggleLeft className="w-3 h-3" />
              {measurementSystem === 'metric' ? 'Metric (cm/kg)' : 'Imperial (ft/lb)'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-muted-foreground block mb-0.5">
                Height ({measurementSystem === 'metric' ? 'cm' : 'in'})
              </label>
              <Input type="number" value={height} onChange={e => setHeight(e.target.value)} className="h-7 text-xs" placeholder={measurementSystem === 'metric' ? '175' : '70'} />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground block mb-0.5">
                Weight ({measurementSystem === 'metric' ? 'kg' : 'lb'})
              </label>
              <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="h-7 text-xs" placeholder={measurementSystem === 'metric' ? '82' : '180'} />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground block mb-0.5">Body Fat %</label>
              <Input type="number" value={bodyFat} onChange={e => setBodyFat(e.target.value)} className="h-7 text-xs" placeholder="15" />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground block mb-0.5">Age</label>
              <Input type="number" value={age} onChange={e => setAge(e.target.value)} className="h-7 text-xs" placeholder="35" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={handleSave}>Save</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Tolerance confirmation dialog */}
      <ConfirmDialog
        open={showToleranceConfirm}
        onOpenChange={setShowToleranceConfirm}
        title="Confirm Tolerance Level"
        description={`Lock your dosing tolerance to "${pendingTolerance}"? This will update all pages with this tolerance level.`}
        confirmLabel="Lock It In"
        onConfirm={confirmTolerance}
      />
    </div>
  );
};

const DashboardView = ({ compounds, stackAnalysis, aiLoading, needsRefresh, toleranceLevel, onAnalyzeStack, onViewAIInsights, onViewOutcomes, goals = [], userId, profile, toleranceHistory = [], onUpdateProfile, onToleranceChange, measurementSystem = 'metric', doseUnitPreference = 'mg', onNavigateToInventory, conversationManager, appFeatures, onEnableFeature, onAddCompound }: DashboardViewProps) => {
  const { readings, fetchReadings, addReading } = useGoalReadings(userId);
  const { snapshots } = useScheduleSnapshots(compounds);
  const [selectedZone, setSelectedZone] = useState<BodyZone | null>(null);
  const [zoneDrawerOpen, setZoneDrawerOpen] = useState(false);
  const [tempGender, setTempGender] = useState<string | null>(null);

  const handleGenderChange = async (gender: string, temporary: boolean) => {
    if (temporary) {
      setTempGender(gender);
      toast.info(`Viewing as ${gender} temporarily`);
    } else {
      setTempGender(null);
      await onUpdateProfile?.({ gender });
      toast.success(`Gender updated to ${gender}`);
    }
  };

  const displayGender = tempGender || profile?.gender;

  const handleZoneTap = (zone: BodyZone) => {
    setSelectedZone(zone);
    setZoneDrawerOpen(true);
  };

  const activeGoals = goals.filter(g => g.status === 'active');

  useEffect(() => {
    if (activeGoals.length > 0) {
      fetchReadings(activeGoals.map(g => g.id!).filter(Boolean));
    }
  }, [activeGoals.length, fetchReadings]);

  // Filter out dormant compounds from coverage calculations
  const activeCompounds = useMemo(() =>
    compounds.filter(c => !c.notes?.includes('[DORMANT]')),
    [compounds]
  );

  const compoundNameIds = useMemo(() =>
    activeCompounds.map(c => c.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')),
    [activeCompounds]
  );

  const zoneIntensities = useMemo(() => computeZoneIntensities(compoundNameIds), [compoundNameIds]);

  const bodyCoverage = useMemo(() => {
    const zones = Object.values(zoneIntensities);
    // Weighted average of all zone intensities (each zone's intensity is 0-1)
    const totalIntensity = zones.reduce((sum, v) => sum + v, 0);
    return Math.round((totalIntensity / zones.length) * 100);
  }, [zoneIntensities]);

  const coverageRationale = useMemo(() => {
    const entries = Object.entries(zoneIntensities) as Array<[BodyZone, number]>;
    const active = entries.filter(([, v]) => v > 0.1);
    const uncovered = entries.filter(([, v]) => v <= 0.1);
    const strongest = active.sort((a, b) => b[1] - a[1]).slice(0, 2);
    const weakest = active.sort((a, b) => a[1] - b[1]).slice(0, 1);

    let rationale = `${active.length}/${entries.length} zones active. `;
    if (strongest.length > 0) {
      rationale += `Strongest: ${strongest.map(([z, v]) => `${BODY_ZONES[z].label} (${Math.round(v * 100)}%)`).join(', ')}. `;
    }
    if (weakest.length > 0 && weakest[0][1] < 0.5) {
      rationale += `Weakest: ${BODY_ZONES[weakest[0][0]].label} (${Math.round(weakest[0][1] * 100)}%). `;
    }
    if (uncovered.length > 0) {
      rationale += `Uncovered: ${uncovered.map(([z]) => BODY_ZONES[z].label).join(', ')}.`;
    }
    return rationale.trim();
  }, [zoneIntensities]);

  const overallProgress = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((sum, g) => {
        const goalReadings = readings.get(g.id!) || [];
        const firstReading = goalReadings.length > 0 ? goalReadings[0].value : undefined;
        return sum + (getProgress(g, firstReading) ?? 0);
      }, 0) / activeGoals.length)
    : 0;

  const protocolScore = stackAnalysis?.overallGrade
    ? { A: 95, B: 75, C: 55, D: 35, F: 15 }[stackAnalysis.overallGrade] ?? 50
    : 50;

  const f = appFeatures || { goal_tracking: true, supplementation: true, inventory_tracking: true, dosing_reorder: true, medical_records: true };

  return (
    <div className="space-y-3">
      {/* Profile & Tolerance Info Bar */}
      <ProfileToleranceBar
        profile={{ ...profile, gender: displayGender }}
        toleranceLevel={toleranceLevel}
        toleranceHistory={toleranceHistory}
        onUpdateProfile={onUpdateProfile}
        onToleranceChange={onToleranceChange}
        onGenderChange={handleGenderChange}
        measurementSystem={measurementSystem}
        onNavigateToInventory={onNavigateToInventory}
      />

      {/* Protocol Coverage — supplementation feature */}
      {f.supplementation ? (
        <ProtocolCoverageCard
          activeCompounds={activeCompounds}
          zoneIntensities={zoneIntensities}
          bodyCoverage={bodyCoverage}
          displayGender={displayGender}
          onZoneTap={handleZoneTap}
          onAddCompound={onAddCompound}
        />
      ) : (
        <FeatureTeaserCard featureKey="supplementation" onEnable={() => onEnableFeature?.('supplementation')} />
      )}

      {/* Combined Protocol Metrics — just below avatar */}
      {f.supplementation && <ProtocolOutcomesCard />}
      {/* Stack Score History sparkline */}
      {f.supplementation && <StackScoreHistory snapshots={snapshots} currentScore={bodyCoverage} />}

      {/* Goal Progress - removed from dashboard */}
      {false && (
        <div className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Goal Progress
              <InfoTooltip text="Track your health goals over time. Add readings to see progress percentage and sparkline trends." />
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={onViewOutcomes} className="text-xs text-primary hover:underline">View All</button>
              <span className="text-lg font-mono font-bold text-primary">{overallProgress}%</span>
            </div>
          </div>

          <div className="h-2 bg-secondary/50 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${overallProgress}%` }} />
          </div>

          {activeGoals.length > 0 ? (
            <div className="space-y-2">
              {activeGoals.map(goal => {
                const goalReadings = readings.get(goal.id!) || [];
                const firstReading = goalReadings.length > 0 ? goalReadings[0].value : undefined;
                const progress = getProgress(goal, firstReading);
                const GoalIcon = getGoalIcon(goal.goal_type);
                const progressVal = progress ?? 0;
                const barColor = progressVal >= 75 ? 'bg-emerald-500' : progressVal >= 40 ? 'bg-primary' : progressVal >= 15 ? 'bg-amber-500' : 'bg-muted-foreground/40';
                const sparkData = goalReadings.slice(-7).map(r => r.value);

                return (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    GoalIcon={GoalIcon}
                    progress={progress}
                    progressVal={progressVal}
                    barColor={barColor}
                    sparkData={sparkData}
                    onViewOutcomes={onViewOutcomes}
                    onAddReading={async (value: number) => {
                      await addReading(goal.id!, value, goal.target_unit || '');
                      toast.success('Reading added');
                      fetchReadings(activeGoals.map(g => g.id!).filter(Boolean));
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div className="py-8 flex items-center justify-center">
              <div className="text-center">
                <Target className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-1">No Active Goals</h3>
                <p className="text-xs text-muted-foreground mb-4">Set health goals to track biomarkers, body composition, and more.</p>
                <button
                  onClick={onViewOutcomes}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  Create Your First Goal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inventory Tracking teaser */}
      {!f.inventory_tracking && (
        <FeatureTeaserCard featureKey="inventory_tracking" onEnable={() => onEnableFeature?.('inventory_tracking')} />
      )}

      {/* Dosing & Reorder teaser */}
      {!f.dosing_reorder && (
        <FeatureTeaserCard featureKey="dosing_reorder" onEnable={() => onEnableFeature?.('dosing_reorder')} />
      )}

      {/* Medical Records teaser */}
      {!f.medical_records && (
        <FeatureTeaserCard featureKey="medical_records" onEnable={() => onEnableFeature?.('medical_records')} />
      )}

      {/* Protocol Intelligence */}
      {f.supplementation && onAnalyzeStack && (
        <ProtocolIntelligenceCard
          analysis={stackAnalysis ?? null}
          loading={aiLoading ?? false}
          needsRefresh={needsRefresh ?? false}
          toleranceLevel={toleranceLevel}
          onRefresh={onAnalyzeStack}
          onViewDetails={onViewAIInsights ?? (() => {})}
        />
      )}

      {/* ProtocolOutcomesCard moved up, near avatar */}

      <ZoneDetailDrawer
        zone={selectedZone}
        open={zoneDrawerOpen}
        onOpenChange={setZoneDrawerOpen}
        compounds={activeCompounds}
        toleranceLevel={toleranceLevel}
        measurementSystem={measurementSystem}
        profile={profile}
        goals={goals}
        userId={userId}
        conversationManager={conversationManager}
        zoneIntensity={selectedZone ? zoneIntensities[selectedZone] : 0}
      />
    </div>
  );
};

export default DashboardView;
