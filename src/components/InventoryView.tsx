import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Compound, getStatus, CompoundCategory, getEffectiveQuantity, getConsumedSinceDate, consumedToContainerUnits, getCompoundContainerKind, validateCompoundForMath } from '@/data/compounds';
import { getCycleStatus, getDaysRemainingWithCycling, isPaused, getReorderDateString } from '@/lib/cycling';
import { useCompliance } from '@/contexts/ComplianceContext';
import { UserProtocol } from '@/hooks/useProtocols';
import { CustomField, CustomFieldValue, PREDEFINED_FIELDS } from '@/hooks/useCustomFields';
import { Pencil, Check, X, Trash2, Plus, ChevronDown, ChevronUp, GripVertical, Syringe, Clock, SortAsc, Moon as MoonIcon, Sun, Dumbbell, RefreshCcw, Package, PlusCircle, AlertTriangle, Pause, Play, Calendar, TrendingDown, Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ConfirmDialog from '@/components/ConfirmDialog';
import ToleranceSelector from '@/components/ToleranceSelector';
import { ToleranceLevel } from '@/hooks/useProtocolAnalysis';
import CycleTimelineBar from '@/components/CycleTimelineBar';
import { getCompoundScores, getDeliveryLabel, CompoundScores } from '@/data/compoundScores';
import { FlaskConical, Beaker, Target } from 'lucide-react';
import CompoundScoreDrawer from '@/components/CompoundScoreDrawer';
import { buildPrepGuide } from '@/data/dilutionDefaults';
import { Droplets, Thermometer, Calculator } from 'lucide-react';
import InfoTooltip from '@/components/InfoTooltip';
import CompoundingCalculator from '@/components/CompoundingCalculator';
import type { CalculatorResult } from '@/components/CompoundingCalculator';
import DatePickerInput from '@/components/DatePickerInput';

interface TitrationBadgeInfo {
  currentStep: number;
  totalSteps: number;
  currentDose: number;
  doseUnit: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
}

interface InventoryViewProps {
  compounds: Compound[];
  onUpdateCompound: (id: string, updates: Partial<Compound>) => void;
  onDeleteCompound?: (id: string) => void;
  onAddCompound?: () => void;
  protocols?: UserProtocol[];
  toleranceLevel?: string;
  onToleranceChange?: (level: ToleranceLevel) => void;
  customFields?: CustomField[];
  customFieldValues?: Map<string, Map<string, string>>;
  onAddCustomField?: (field: Partial<CustomField>) => Promise<CustomField | null>;
  onRemoveCustomField?: (fieldId: string) => Promise<void>;
  onReorderCustomField?: (fieldId: string, direction: 'up' | 'down') => Promise<void>;
  onSetCustomFieldValue?: (compoundId: string, fieldId: string, value: string) => Promise<void>;
  /** If set, scroll to this compound ID as soon as the view mounts/changes */
  scrollToCompoundId?: string | null;
  /** Called after the scroll has been triggered so parent can clear the value */
  onScrollToCompoundDone?: () => void;
  /** Titration info per compound ID */
  titrationInfo?: Map<string, TitrationBadgeInfo>;
}

const categoryLabels: Record<string, string> = {
  'peptide': 'Peptides',
  'injectable-oil': 'Injectable Oils',
  'oral': 'Oral Supplements',
  'powder': 'Powders',
  'prescription': 'Prescription',
  'vitamin': 'Vitamins',
  'holistic': 'Holistic',
  'adaptogen': 'Adaptogens',
  'nootropic': 'Nootropics',
  'essential-oil': 'Essential Oils',
  'alternative-medicine': 'Alternative Medicine',
  'probiotic': 'Probiotics',
  'topical': 'Topical',
};

const categoryOrder: string[] = ['peptide', 'injectable-oil', 'prescription', 'oral', 'powder', 'vitamin', 'holistic', 'adaptogen', 'nootropic', 'essential-oil', 'alternative-medicine', 'probiotic', 'topical'];

const InventoryView = ({ compounds, onUpdateCompound, onDeleteCompound, onAddCompound, protocols = [], toleranceLevel, onToleranceChange, customFields = [], customFieldValues = new Map(), onAddCustomField, onRemoveCustomField, onReorderCustomField, onSetCustomFieldValue, scrollToCompoundId, onScrollToCompoundDone, titrationInfo }: InventoryViewProps) => {
  const { getDaysRemainingAdjusted, getEffectiveQtyAdjusted, getConsumedAdjusted, getComplianceInfo } = useCompliance();
  const [filter, setFilter] = useState<string>('all');
  const [showOffOnly, setShowOffOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'days'>('name');
  const [showToleranceConfirm, setShowToleranceConfirm] = useState(false);
  const [pendingTolerance, setPendingTolerance] = useState<ToleranceLevel | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const activeCompounds = compounds.filter(c => !c.notes?.includes('[DORMANT]'));
  const dormantCompounds = compounds.filter(c => c.notes?.includes('[DORMANT]'));

  // Auto-trigger depletion action when stock hits 0
  useEffect(() => {
    activeCompounds.forEach(compound => {
      if (!compound.depletionAction || isPaused(compound)) return;
      const days = getDaysRemainingAdjusted(compound);
      if (days > 0) return;
      // Stock is depleted — apply action
      if (compound.depletionAction === 'pause') {
        onUpdateCompound(compound.id, {
          pausedAt: new Date().toISOString(),
          depletionAction: null, // clear so it doesn't re-trigger
        });
        toast.info(`${compound.name} auto-paused (stock depleted)`);
      } else if (compound.depletionAction === 'dormant') {
        const newNotes = `[DORMANT] ${compound.notes || ''}`.trim();
        onUpdateCompound(compound.id, {
          notes: newNotes,
          depletionAction: null,
        });
        toast.info(`${compound.name} set dormant (stock depleted)`);
      }
    });
  }, [activeCompounds, getDaysRemainingAdjusted, onUpdateCompound]);

  // Fetch cached personalized scores for all compounds
  const [cachedScoresMap, setCachedScoresMap] = useState<Map<string, CompoundScores>>(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);
  const refreshCachedScores = useCallback(() => setCacheVersion(v => v + 1), []);
  useEffect(() => {
    let cancelled = false;
    const fetchCached = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from('personalized_score_cache')
        .select('compound_name, scores')
        .eq('user_id', user.id);
      if (cancelled || !data) return;
      const map = new Map<string, CompoundScores>();
      for (const row of data) {
        const s = row.scores as any;
        if (s && typeof s.bioavailability === 'number') {
          map.set(row.compound_name, {
            bioavailability: s.bioavailability,
            efficacy: s.efficacy,
            effectiveness: s.effectiveness,
            evidenceTier: s.evidenceTier || 'Mixed',
            confidencePct: s.confidencePct,
            confidenceNote: s.confidenceNote,
          });
        }
      }
      setCachedScoresMap(map);
    };
    fetchCached();
    return () => { cancelled = true; };
  }, [compounds, cacheVersion]);

  const refreshAllScores = useCallback(async () => {
    const toRefresh = activeCompounds.filter(c => !isPaused(c));
    if (toRefresh.length === 0) { toast.info('No active compounds to refresh'); return; }
    setRefreshingAll(true);
    let success = 0;
    let failed = 0;
    for (let i = 0; i < toRefresh.length; i++) {
      const c = toRefresh[i];
      setRefreshProgress({ current: i + 1, total: toRefresh.length, name: c.name });
      try {
        const { error } = await supabase.functions.invoke('personalized-scores', {
          body: {
            compoundName: c.name,
            category: c.category,
            dosePerUse: c.dosePerUse || 0,
            dosesPerDay: c.dosesPerDay || 1,
            daysPerWeek: c.daysPerWeek || 7,
            unitLabel: c.unitLabel || '',
            doseLabel: c.doseLabel || '',
            forceRefresh: true,
          },
        });
        if (error) throw error;
        success++;
      } catch {
        failed++;
      }
    }
    setRefreshingAll(false);
    setRefreshProgress(null);
    refreshCachedScores();
    if (failed === 0) {
      toast.success(`All ${success} scores refreshed`);
    } else {
      toast.warning(`${success} refreshed, ${failed} failed`);
    }
  }, [activeCompounds, refreshCachedScores]);

  const scrollToCompound = useCallback((id: string) => {
    setHighlightId(id);
    // Small delay to allow collapsed groups to open
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = cardRefs.current.get(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Clear highlight after animation
        setTimeout(() => setHighlightId(null), 2000);
      }, 100);
    });
  }, []);

  // Auto-scroll when parent requests a specific compound
  useEffect(() => {
    if (!scrollToCompoundId) return;
    // Give the tab animation time to complete before scrolling
    const timer = setTimeout(() => {
      scrollToCompound(scrollToCompoundId);
      onScrollToCompoundDone?.();
    }, 350);
    return () => clearTimeout(timer);
  }, [scrollToCompoundId, scrollToCompound, onScrollToCompoundDone]);
  const filtered = (() => {
    let base = filter === 'all' ? activeCompounds : activeCompounds.filter(c => c.category === filter);
    if (showOffOnly) {
      base = base.filter(c => {
        const cs = getCycleStatus(c);
        return cs.hasCycle && !cs.isOn;
      });
    }
    return base;
  })();
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'days') return getDaysRemainingAdjusted(a) - getDaysRemainingAdjusted(b);
    return a.name.localeCompare(b.name);
  });

  // Compounds with stock alerts
  const alertCompounds = useMemo(() => {
    return activeCompounds
      .filter(c => !c.depletionAction) // Skip compounds set to auto-pause/dormant on depletion
      .map(c => ({ compound: c, days: getDaysRemainingAdjusted(c), status: getStatus(getDaysRemainingAdjusted(c)) }))
      .filter(a => a.status === 'critical' || a.status === 'warning')
      .sort((a, b) => a.days - b.days);
  }, [activeCompounds, getDaysRemainingAdjusted]);

  // Compounds with incomplete cycling configs
  const incompleteCyclingCompounds = useMemo(() => {
    return activeCompounds.filter(c => {
      const hasAny = c.cycleOnDays || c.cycleOffDays || c.cycleStartDate;
      const hasAll = c.cycleOnDays && c.cycleOffDays && c.cycleStartDate;
      return hasAny && !hasAll;
    });
  }, [activeCompounds]);

  const fixCycleConfig = useCallback((compound: Compound) => {
    const today = new Date().toISOString().split('T')[0];
    const fixes: Partial<Compound> = {};
    if (!compound.cycleOffDays) fixes.cycleOffDays = compound.cycleOnDays ?? 5;
    if (!compound.cycleOnDays) fixes.cycleOnDays = compound.cycleOffDays ?? 5;
    if (!compound.cycleStartDate) fixes.cycleStartDate = today;
    onUpdateCompound(compound.id, fixes);
    toast.success(`Cycle config fixed for ${compound.name}`);
  }, [onUpdateCompound]);

  // Build protocol groups + ungrouped by category
  const buildGroups = () => {
    if (sortBy === 'days') return [{ label: 'all', items: sorted }];

    const groups: { label: string; items: Compound[] }[] = [];
    const protocolCompoundIds = new Set<string>();

    // Protocol groups first
    protocols.forEach(p => {
      const pItems = sorted.filter(c => p.compoundIds.includes(c.id));
      if (pItems.length > 0) {
        groups.push({ label: `${p.icon} ${p.name}`, items: pItems });
        pItems.forEach(c => protocolCompoundIds.add(c.id));
      }
    });

    // Then category groups for ungrouped compounds
    categoryOrder.forEach(cat => {
      const items = sorted.filter(c => c.category === cat && !protocolCompoundIds.has(c.id));
      if (items.length > 0) {
        groups.push({ label: categoryLabels[cat], items });
      }
    });

    return groups;
  };

  const groups = buildGroups();

  return (
    <div className="space-y-3">
      {/* Stock Alert Banner */}
      {alertCompounds.length > 0 && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/5 p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-status-warning flex-shrink-0" />
            <span className="text-[11px] font-semibold text-status-warning">
              {alertCompounds.length} compound{alertCompounds.length !== 1 ? 's' : ''} need attention
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {alertCompounds.map(a => (
              <button
                key={a.compound.id}
                onClick={() => scrollToCompound(a.compound.id)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                  a.status === 'critical'
                    ? 'bg-destructive/15 text-status-critical border border-destructive/20 hover:bg-destructive/25'
                    : 'bg-accent/15 text-status-warning border border-accent/20 hover:bg-accent/25'
                }`}
              >
                <Package className="w-2.5 h-2.5" />
                {a.compound.name} — {a.days}d
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cycling Config Health Check Banner */}
      {incompleteCyclingCompounds.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <RefreshCcw className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-[11px] font-semibold text-primary">
              {incompleteCyclingCompounds.length} incomplete cycling config{incompleteCyclingCompounds.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            These compounds have partial cycling data — fix to enable accurate supply math and schedule display.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {incompleteCyclingCompounds.map(c => {
              const missing: string[] = [];
              if (!c.cycleOnDays) missing.push('ON days');
              if (!c.cycleOffDays) missing.push('OFF days');
              if (!c.cycleStartDate) missing.push('start date');
              return (
                <button
                  key={c.id}
                  onClick={() => fixCycleConfig(c)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono cursor-pointer transition-all hover:scale-105 active:scale-95 bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25"
                  title={`Missing: ${missing.join(', ')}`}
                >
                  <Check className="w-2.5 h-2.5" />
                  Fix {c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Header with tolerance selector */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-foreground">Compounds</h2>
      </div>

      {/* Tolerance selector — full comparison view */}
      {onToleranceChange && (
        <div className="bg-card/60 rounded-lg border border-border/30 p-3 mb-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Dosing Tolerance Level</p>
          <ToleranceSelector
            value={(toleranceLevel || 'moderate') as ToleranceLevel}
            onChange={(level) => {
              setPendingTolerance(level);
              setShowToleranceConfirm(true);
            }}
          />
          <p className="text-[9px] text-muted-foreground/50 mt-1.5">
            Your selection applies across all pages.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-thin -mx-1 px-1">
          {(['all', ...categoryOrder.filter(cat => activeCompounds.some(c => c.category === cat) || dormantCompounds.some(c => c.category === cat))]).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] sm:text-xs transition-all whitespace-nowrap touch-manipulation ${
                filter === cat
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-secondary text-secondary-foreground active:bg-secondary/60'
              }`}
            >
              {cat === 'all' ? 'All' : (categoryLabels[cat] || cat)}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setShowOffOnly(v => !v)}
            className={`px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] sm:text-xs transition-all touch-manipulation ${
              showOffOnly
                ? 'bg-status-warning/20 text-status-warning border border-status-warning/30'
                : 'bg-secondary text-secondary-foreground active:bg-secondary/60'
            }`}
            title="Show only compounds currently in OFF phase"
          >
            <RefreshCcw className="w-3 h-3 inline mr-0.5" /> OFF
          </button>
          <button
            onClick={() => setSortBy(s => s === 'days' ? 'name' : 'days')}
            className="px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] sm:text-xs bg-secondary text-secondary-foreground active:bg-secondary/60 touch-manipulation"
          >
            {sortBy === 'days' ? <><Clock className="w-3 h-3 inline mr-0.5" /> Days</> : <><SortAsc className="w-3 h-3 inline mr-0.5" /> Name</>}
          </button>
        </div>
      </div>

      {/* Add button + Refresh All */}
      <div className="flex gap-2">
        {onAddCompound && (
          <button
            onClick={onAddCompound}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-primary text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Compound
          </button>
        )}
        <button
          onClick={refreshAllScores}
          disabled={refreshingAll}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border/40 bg-secondary/30 hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground text-xs font-medium disabled:opacity-50"
          title="Recompute all personalized scores"
        >
          {refreshingAll ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCcw className="w-3.5 h-3.5" />
          )}
          {refreshingAll && refreshProgress
            ? <span className="truncate max-w-[120px]">{refreshProgress.current}/{refreshProgress.total} {refreshProgress.name}</span>
            : 'Refresh All Scores'}
        </button>
      </div>

      {/* Compound Cards */}
      {groups.map(group => (
        <Collapsible key={group.label}>
          {group.label !== 'all' && (
            <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left mb-2 group">
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
              <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
              <span className="text-[10px] text-muted-foreground font-mono">({group.items.length})</span>
            </CollapsibleTrigger>
          )}
          <CollapsibleContent className="animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {group.items.map((compound, compoundIdx) => (
                <div
                  key={compound.id}
                  ref={(el) => { if (el) cardRefs.current.set(compound.id, el); else cardRefs.current.delete(compound.id); }}
                  className={`transition-all duration-500 rounded-lg ${highlightId === compound.id ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}`}
                  {...(compoundIdx === 0 && groups.indexOf(group) === 0 ? { 'data-tour': 'compound-card' } : {})}
                >
                  <CompoundCard compound={compound} onUpdate={onUpdateCompound} onDelete={onDeleteCompound} customFields={customFields} customFieldValues={customFieldValues.get(compound.id) || new Map()} onAddCustomField={onAddCustomField} onRemoveCustomField={onRemoveCustomField} onReorderCustomField={onReorderCustomField} onSetCustomFieldValue={onSetCustomFieldValue} cachedScores={cachedScoresMap.get(compound.name)} onScoreDrawerClose={refreshCachedScores} titrationBadge={titrationInfo?.get(compound.id)} />
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}

      {/* Dormant Compounds */}
      {dormantCompounds.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left mb-2 group">
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
            <MoonIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground">Dormant</h3>
            <span className="text-[10px] text-muted-foreground font-mono">({dormantCompounds.length})</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 opacity-60">
              {dormantCompounds.map(compound => (
                <CompoundCard key={compound.id} compound={compound} onUpdate={onUpdateCompound} onDelete={onDeleteCompound} customFields={customFields} customFieldValues={customFieldValues.get(compound.id) || new Map()} onAddCustomField={onAddCustomField} onRemoveCustomField={onRemoveCustomField} onReorderCustomField={onReorderCustomField} onSetCustomFieldValue={onSetCustomFieldValue} cachedScores={cachedScoresMap.get(compound.name)} onScoreDrawerClose={refreshCachedScores} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      <ConfirmDialog
        open={showToleranceConfirm}
        onOpenChange={setShowToleranceConfirm}
        title="Confirm Tolerance Level"
        description={`Lock your dosing tolerance to "${pendingTolerance}"? This will update all pages with this tolerance level.`}
        confirmLabel="Lock It In"
        onConfirm={() => {
          if (pendingTolerance && onToleranceChange) {
            onToleranceChange(pendingTolerance);
            toast.success(`Tolerance locked to ${pendingTolerance}`);
          }
          setShowToleranceConfirm(false);
        }}
      />
    </div>
  );
};

// --- Compound Card ---

const CompoundCard = ({ compound, onUpdate, onDelete, customFields = [], customFieldValues = new Map(), onAddCustomField, onRemoveCustomField, onReorderCustomField, onSetCustomFieldValue, cachedScores, onScoreDrawerClose, titrationBadge }: {
  compound: Compound; onUpdate: (id: string, updates: Partial<Compound>) => void; onDelete?: (id: string) => void;
  customFields?: CustomField[]; customFieldValues?: Map<string, string>;
  onAddCustomField?: (field: Partial<CustomField>) => Promise<CustomField | null>;
  onRemoveCustomField?: (fieldId: string) => Promise<void>;
  onReorderCustomField?: (fieldId: string, direction: 'up' | 'down') => Promise<void>;
  onSetCustomFieldValue?: (compoundId: string, fieldId: string, value: string) => Promise<void>;
  cachedScores?: CompoundScores;
  onScoreDrawerClose?: () => void;
  titrationBadge?: TitrationBadgeInfo;
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDormant, setConfirmDormant] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseDate, setPauseDate] = useState('');
  const [doseUnit, setDoseUnit] = useState<'mg' | 'ml' | 'iu'>('mg');
  const [showScoreDrawer, setShowScoreDrawer] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<Record<string, string>>({});
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'date'>('text');
  const [newFieldUnit, setNewFieldUnit] = useState('');
  const cycleStatus = getCycleStatus(compound);
  const [showCycleTimeline, setShowCycleTimeline] = useState(cycleStatus.hasCycle && !cycleStatus.isOn);
  const [showCalculator, setShowCalculator] = useState(false);

  const { getDaysRemainingAdjusted: getDaysAdj, getEffectiveQtyAdjusted: getQtyAdj, getConsumedAdjusted: getConsumedAdj, getComplianceInfo: getCI } = useCompliance();
  const compoundIsPaused = isPaused(compound);
  const validationErrors = validateCompoundForMath(compound);
  const hasValidationErrors = validationErrors.length > 0;
  const days = hasValidationErrors ? 0 : getDaysAdj(compound);
  const status = compoundIsPaused ? 'good' as const : hasValidationErrors ? 'warning' as const : getStatus(days);
  const maxDays = 90;
  const progress = hasValidationErrors ? 0 : Math.min(100, (days / maxDays) * 100);
  const isPeptide = compound.category === 'peptide';
  const isOil = compound.category === 'injectable-oil';
  const reorderDate = hasValidationErrors ? '—' : getReorderDateString(compound, getCI(compound.id));

  /** Build a human-readable math breakdown for peptides and oils */
  const getDaysMathTooltip = (): string => {
    const qty = compound.currentQuantity;
    const dosePerDay = compound.dosePerUse * compound.dosesPerDay;
    if (dosePerDay === 0 || compound.daysPerWeek === 0) return `${days} days remaining`;

    if (isPeptide && compound.bacstatPerVial) {
      // (vials × IU/vial) / (dose IU × doses/day × days/week ÷ 7)
      const totalIU = qty * compound.bacstatPerVial;
      const dailyRate = dosePerDay * (compound.daysPerWeek / 7);
      const dpw = compound.daysPerWeek === 7 ? 'daily' : `${compound.daysPerWeek}×/wk`;
      return `${qty} vials × ${compound.bacstatPerVial} IU = ${totalIU} IU total\n÷ ${compound.dosePerUse} IU${compound.dosesPerDay > 1 ? ` × ${compound.dosesPerDay}/day` : '/day'} (${dpw})\n= ${days} days`;
    }
    if (isOil && compound.vialSizeMl) {
      // (vials × conc mg/mL × mL/vial) / daily dose mg
      const totalMg = qty * compound.unitSize * compound.vialSizeMl;
      const dpw = compound.daysPerWeek === 7 ? 'daily' : `${compound.daysPerWeek}×/wk`;
      return `${qty} vials × ${compound.unitSize}mg/mL × ${compound.vialSizeMl}mL = ${totalMg}mg total\n÷ ${compound.dosePerUse}mg/day (${dpw})\n= ${days} days`;
    }
    // Oral/powder fallback
    const totalUnits = qty * compound.unitSize;
    const dailyUnits = dosePerDay * (compound.daysPerWeek / 7);
    return `${qty} units × ${compound.unitSize} = ${totalUnits} doses total\n÷ ${dailyUnits.toFixed(1)}/day = ${days} days`;
  };

  const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  const parseDaysFromNote = (note: string): Set<number> => {
    const lower = note.toLowerCase();
    const days = new Set<number>();

    // Check "daily" / "nightly" / "every day" FIRST — these mean all 7 days
    if (/\bdaily\b|\bnightl?y?\b|\bevery\s*day\b/i.test(lower)) {
      [0,1,2,3,4,5,6].forEach(i => days.add(i));
      return days;
    }

    const patterns: [RegExp, number[]][] = [
      [/\bm[\/-]f\b|mon[\s-]*fri/i, [1,2,3,4,5]],
      [/\bm\/w\/f\b/i, [1,3,5]],
      [/\bt\/th\b/i, [2,4]],
      [/M\/T\/W\/Th\/F/i, [1,2,3,4,5]], // Handle M/T/W/Th/F pattern
    ];
    for (const [pat, idxs] of patterns) {
      if (pat.test(note)) { idxs.forEach(i => days.add(i)); }
    }
    // Don't return early for patterns — also check individual day mentions
    const dayMap: Record<string, number> = { su: 0, sun: 0, mo: 1, mon: 1, tu: 2, tue: 2, tues: 2, we: 3, wed: 3, th: 4, thu: 4, thurs: 4, fr: 5, fri: 5, sa: 6, sat: 6 };
    const matches = lower.match(/\b(su(?:n(?:day)?)?|mo(?:n(?:day)?)?|tu(?:e(?:s(?:day)?)?)?|we(?:d(?:nesday)?)?|th(?:u(?:rs(?:day)?)?)?|fr(?:i(?:day)?)?|sa(?:t(?:urday)?)?)\b/gi);
    if (matches) matches.forEach(m => { const i = dayMap[m.toLowerCase()]; if (i !== undefined) days.add(i); });
    if (days.size === 0 && parseInt(editState.daysPerWeek || '0') === 7) {
      [0,1,2,3,4,5,6].forEach(i => days.add(i));
    }
    return days;
  };

  const buildDayString = (days: Set<number>): string => {
    if (days.size === 7) return 'daily';
    if (days.size === 0) return '';
    const sorted = Array.from(days).sort();
    if (sorted.join(',') === '1,2,3,4,5') return 'M-F';
    if (sorted.join(',') === '1,3,5') return 'M/W/F';
    if (sorted.join(',') === '2,4') return 'T/Th';
    return sorted.map(d => DAY_KEYS[d]).join('/');
  };

  const startEdit = () => {
    const hasCycling = !!(compound.cycleOnDays && compound.cycleOnDays > 0 && compound.cycleOffDays && compound.cycleOffDays > 0);
    
    // Determine the stored dose unit from doseLabel
    const dl = compound.doseLabel.toLowerCase();
    let storedUnit: string;
    if (dl.includes('iu')) storedUnit = 'iu';
    else if (dl.includes('mcg') || dl.includes('µg')) storedUnit = 'mcg';
    else if (dl === 'drops' || dl === 'drop') storedUnit = 'drops';
    else if (dl === 'spray' || dl === 'sprays') storedUnit = 'spray';
    else if (dl === 'patch' || dl === 'patches') storedUnit = 'patch';
    else if (dl === 'tbsp') storedUnit = 'tbsp';
    else if (dl === 'tsp') storedUnit = 'tsp';
    else if (dl === 'oz') storedUnit = 'oz';
    else if (dl === 'fl oz' || dl === 'floz') storedUnit = 'floz';
    else if (dl === 'softgel' || dl === 'softgels') storedUnit = 'softgels';
    else if (dl === 'units' || dl === 'unit') storedUnit = 'units';
    else if (dl.includes('scoop') || (compound.category === 'powder' && dl.includes('serving'))) storedUnit = 'scoop';
    else if (dl.includes('pill') || dl.includes('cap') || dl.includes('softgel') || dl.includes('tab') || dl.includes('serving')) storedUnit = 'pills';
    else if (dl.includes('ml')) storedUnit = 'ml';
    else if (dl === 'g') storedUnit = 'g';
    else storedUnit = compound.category === 'powder' ? 'scoop' : 'mg';

    // Use the stored unit as the edit unit so overview and edit match
    const editDoseUnit = storedUnit;
    let editDose = compound.dosePerUse; // already in stored unit

    // Derive daysPerWeek from the timing note (same logic the UI displays),
    // so Save always writes what the user SEES, not a stale DB value.
    const timingNote = compound.timingNote || '';
    const parsedDays = (() => {
      const lower = timingNote.toLowerCase();
      if (/\bdaily\b|\bnightl?y?\b|\bevery\s*day\b/i.test(lower)) return 7;
      const dayMap: Record<string, number> = { su:0, sun:0, mo:1, mon:1, tu:2, tue:2, tues:2, we:3, wed:3, th:4, thu:4, thurs:4, fr:5, fri:5, sa:6, sat:6 };
      const pats: [RegExp, number[]][] = [
        [/\bm[\/-]f\b|mon[\s-]*fri/i, [1,2,3,4,5]],
        [/\bm\/w\/f\b/i, [1,3,5]],
        [/\bt\/th\b/i, [2,4]],
        [/M\/T\/W\/Th\/F/i, [1,2,3,4,5]],
      ];
      const ds = new Set<number>();
      for (const [pat, idxs] of pats) { if (pat.test(timingNote)) idxs.forEach(i => ds.add(i)); }
      const matches = lower.match(/\b(su(?:n(?:day)?)?|mo(?:n(?:day)?)?|tu(?:e(?:s(?:day)?)?)?|we(?:d(?:nesday)?)?|th(?:u(?:rs(?:day)?)?)?|fr(?:i(?:day)?)?|sa(?:t(?:urday)?)?)\b/gi);
      if (matches) matches.forEach(m => { const i = dayMap[m.toLowerCase()]; if (i !== undefined) ds.add(i); });
      return ds.size > 0 ? ds.size : compound.daysPerWeek;
    })();

    const state: Record<string, string> = {
      name: compound.name,
      category: compound.category,
      timing: timingNote,
      daysPerWeek: parsedDays.toString(),
      currentQuantity: compound.currentQuantity.toString(),
      unitSize: compound.unitSize.toString(),
      dosePerUse: editDose.toString(),
      reorderQuantity: compound.reorderQuantity.toString(),
      reorderType: compound.reorderType || 'single',
      cyclingEnabled: hasCycling ? 'true' : 'false',
      cycleOnDays: (compound.cycleOnDays || 0).toString(),
      cycleOffDays: (compound.cycleOffDays || 0).toString(),
      cycleStartDate: compound.cycleStartDate || '',
      editDoseUnit: editDoseUnit,
      vialSizeMl: (compound.vialSizeMl || 10).toString(),
      unitLabel: compound.unitLabel,
      // Initialize container type from notes tag or infer from unitLabel
      containerType: (() => {
        const containerKind = getCompoundContainerKind(compound);
        return containerKind === 'bag' ? 'bags' : 'bottles';
      })(),
      weightPerUnit: (() => {
        const wpu = compound.weightPerUnit || 0;
        if (wpu === 0) return '';
        const su = compound.weightUnit || 'mg';
        if (su === 'mcg') return (wpu * 1000).toString();
        if (su === 'g') return (wpu / 1000).toString();
        if (su === 'oz') return (wpu / 28349.5).toFixed(4).replace(/\.?0+$/, '');
        if (su === 'lb') return (wpu / 453592).toFixed(6).replace(/\.?0+$/, '');
        return wpu.toString(); // mg
      })(),
      strengthUnit: compound.weightUnit || (() => {
        const wpu = compound.weightPerUnit || 0;
        if (wpu === 0) return 'mg';
        if (wpu < 0.1) return 'mcg';
        if (wpu >= 1000 && wpu % 1000 === 0) return 'g';
        return 'mg';
      })(),
    };
    if (isPeptide) {
      state.kitPrice = (compound.kitPrice || 0).toString();
      state.unitPrice = compound.unitPrice.toString();
    } else {
      state.unitPrice = compound.unitPrice.toString();
    }
    state.purchaseDate = compound.purchaseDate;
    state.dosesPerDay = compound.dosesPerDay.toString();
    // Dilution fields
    state.solventType = compound.solventType || '';
    state.solventVolume = compound.solventVolume?.toString() || '';
    state.solventUnit = compound.solventUnit || 'mL';
    state.resultingConcentration = compound.resultingConcentration?.toString() || '';
    state.concentrationUnit = compound.concentrationUnit || 'mg/mL';
    state.storageInstructions = compound.storageInstructions || '';
    state.prepNotes = compound.prepNotes || '';
    setEditState(state);
    setEditing(true);
  };

  const saveEdit = () => {
    const qty = parseFloat(editState.currentQuantity);
    const size = parseFloat(editState.unitSize);
    let dose = parseFloat(editState.dosePerUse);
    const reorder = parseInt(editState.reorderQuantity);
    if (isNaN(qty) || isNaN(size) || isNaN(dose) || isNaN(reorder) || qty < 0 || size <= 0 || dose < 0 || reorder < 0) return;

    // Convert dose back from edit unit to stored doseLabel unit
    const eu = editState.editDoseUnit || 'mg';
    const dl = compound.doseLabel.toLowerCase();
    const editCat = editState.category || compound.category;
    let storedUnit: string;
    if (dl.includes('iu')) storedUnit = 'iu';
    else if (dl.includes('mcg') || dl.includes('µg')) storedUnit = 'mcg';
    else if (dl === 'drops' || dl === 'drop') storedUnit = 'drops';
    else if (dl === 'spray' || dl === 'sprays') storedUnit = 'spray';
    else if (dl === 'patch' || dl === 'patches') storedUnit = 'patch';
    else if (dl === 'tbsp') storedUnit = 'tbsp';
    else if (dl === 'tsp') storedUnit = 'tsp';
    else if (dl === 'oz') storedUnit = 'oz';
    else if (dl === 'fl oz' || dl === 'floz') storedUnit = 'floz';
    else if (dl === 'softgel' || dl === 'softgels') storedUnit = 'softgels';
    else if (dl === 'units' || dl === 'unit') storedUnit = 'units';
    else if (dl.includes('scoop') || (editCat === 'powder' && dl.includes('serving'))) storedUnit = 'scoop';
    else if (dl.includes('pill') || dl.includes('cap') || dl.includes('softgel') || dl.includes('tab') || dl.includes('serving')) storedUnit = 'pills';
    else if (dl.includes('ml')) storedUnit = 'ml';
    else if (dl === 'g') storedUnit = 'g';
    else storedUnit = editCat === 'powder' ? 'scoop' : 'mg';

    // If edit unit matches stored unit, no conversion needed
    if (eu !== storedUnit) {
      const catIsPeptide = editState.category === 'peptide';
      const catIsOil = editState.category === 'injectable-oil';
      const reconVolIU = (compound.reconVolume || 2) * 100;

      // Convert edit value to mg first
      let mgValue = dose;
      if (eu === 'iu') {
        if (catIsPeptide && size > 0) mgValue = (dose / reconVolIU) * size;
        else if (catIsOil && size > 0) mgValue = (dose / 200) * size;
      } else if (eu === 'ml') {
        if (catIsPeptide) mgValue = (dose * 100 / reconVolIU) * size;
        else if (catIsOil) mgValue = dose * size;
      } else if (eu === 'mcg') {
        mgValue = dose / 1000;
      } else if (eu === 'pills') {
        mgValue = dose;
      }

      // Convert mg to stored unit
      dose = mgValue;
      if (storedUnit === 'iu') {
        if (catIsPeptide && size > 0) dose = (mgValue / size) * reconVolIU;
        else if (catIsOil && size > 0) dose = (mgValue / size) * 200;
      } else if (storedUnit === 'ml') {
        if (catIsPeptide) dose = ((mgValue / size) * reconVolIU) / 100;
        else if (catIsOil && size > 0) dose = mgValue / size;
      } else if (storedUnit === 'mcg') {
        dose = mgValue * 1000;
      } else if (storedUnit === 'pills') {
        dose = mgValue;
      }
      dose = Math.round(dose * 1000) / 1000;
    }

    // When user changes quantity via edit form, reset compliance offset so
    // the new quantity is treated as "what I have right now"
    const qtyChanged = qty !== compound.currentQuantity;
    const ci = qtyChanged ? getCI(compound.id) : undefined;

    const updates: Partial<Compound> = {
      name: editState.name?.trim() || compound.name,
      category: (editState.category as CompoundCategory) || compound.category,
      currentQuantity: qty,
      unitSize: size,
      dosePerUse: dose,
      reorderQuantity: reorder,
      reorderType: (editState.reorderType as 'single' | 'kit') || 'single',
      ...(qtyChanged ? {
        complianceDoseOffset: ci?.checkedDoses || 0,
        purchaseDate: new Date().toISOString().split('T')[0],
      } : {}),
    };

    const editIsPeptide = editState.category === 'peptide';
    const editIsOil = editState.category === 'injectable-oil';

    // Persist unit label for all categories
    if (editState.unitLabel) {
      updates.unitLabel = editState.unitLabel;
    }
    // Persist dose label from the dose unit dropdown
    if (editState.editDoseUnit) {
      const unitMap: Record<string, string> = { mg: 'mg', mcg: 'mcg', g: 'g', iu: 'IU', ml: 'mL', floz: 'fl oz', drops: 'drops', pills: 'pills', caps: 'caps', tabs: 'tabs', softgels: 'softgels', scoop: 'scoop', spray: 'spray', patch: 'patch', tbsp: 'tbsp', tsp: 'tsp', oz: 'oz', units: 'units' };
      updates.doseLabel = unitMap[editState.editDoseUnit] || compound.doseLabel;
    }
    // Strength (weight per unit) — available for all categories
    const rawVal = parseFloat(editState.weightPerUnit || '');
    if (isNaN(rawVal) || rawVal <= 0) {
      updates.weightPerUnit = undefined;
      updates.weightUnit = undefined;
    } else {
      const su = editState.strengthUnit || 'mg';
      let mgVal = rawVal;
      if (su === 'mcg') mgVal = rawVal / 1000;
      else if (su === 'g') mgVal = rawVal * 1000;
      else if (su === 'oz') mgVal = rawVal * 28349.5;
      else if (su === 'lb') mgVal = rawVal * 453592;
      updates.weightPerUnit = mgVal;
      updates.weightUnit = su;
    }

    if (editIsOil) {
      const vialMl = parseFloat(editState.vialSizeMl || '10');
      updates.vialSizeMl = isNaN(vialMl) || vialMl <= 0 ? 10 : vialMl;
    }

    if (editIsPeptide) {
      if (editState.reorderType === 'single') {
        const unit = parseFloat(editState.unitPrice || '0');
        if (isNaN(unit) || unit < 0) return;
        updates.unitPrice = unit;
        updates.kitPrice = Math.round(unit * 10 * 100) / 100;
      } else {
        const kit = parseFloat(editState.kitPrice || '0');
        if (isNaN(kit) || kit < 0) return;
        updates.kitPrice = kit;
        updates.unitPrice = Math.round((kit / 10) * 100) / 100;
      }
    } else {
      const price = parseFloat(editState.unitPrice || '0');
      if (isNaN(price) || price < 0) return;
      updates.unitPrice = price;
    }

    updates.purchaseDate = editState.purchaseDate || '';

    if (editState.cyclingEnabled === 'true') {
      const on = parseInt(editState.cycleOnDays);
      const off = parseInt(editState.cycleOffDays);
      if (!isNaN(on) && on > 0 && !isNaN(off) && off > 0) {
        updates.cycleOnDays = on;
        updates.cycleOffDays = off;
        updates.cycleStartDate = editState.cycleStartDate || compound.cycleStartDate || new Date().toISOString().split('T')[0];
      }
    } else {
      // Cycling disabled — clear it
      updates.cycleOnDays = undefined;
      updates.cycleOffDays = undefined;
      updates.cycleStartDate = undefined;
    }

    if (editState.timing !== undefined) {
      updates.timingNote = editState.timing.trim() || undefined;
    }

    if (editState.daysPerWeek !== undefined) {
      const dpw = parseInt(editState.daysPerWeek);
      if (!isNaN(dpw) && dpw >= 0 && dpw <= 7) {
        updates.daysPerWeek = dpw;
      }
    }

    if (editState.dosesPerDay !== undefined) {
      const dpd = parseFloat(editState.dosesPerDay);
      if (!isNaN(dpd) && dpd > 0) {
        updates.dosesPerDay = dpd;
      }
    }

    // Persist container type for powders in notes
    if (editState.category === 'powder' && editState.containerType) {
      let currentNotes = compound.notes || '';
      currentNotes = currentNotes.replace(/\[CONTAINER:(bag|bottle)\]/gi, '').trim();
      const tag = editState.containerType === 'bottles' ? '[CONTAINER:bottle]' : '[CONTAINER:bag]';
      updates.notes = currentNotes ? `${tag} ${currentNotes}` : tag;
    }

    // Dilution fields
    updates.solventType = editState.solventType?.trim() || undefined;
    const sv = parseFloat(editState.solventVolume || '');
    updates.solventVolume = isNaN(sv) || sv <= 0 ? undefined : sv;
    updates.solventUnit = editState.solventUnit || undefined;
    const rc = parseFloat(editState.resultingConcentration || '');
    updates.resultingConcentration = isNaN(rc) || rc <= 0 ? undefined : rc;
    updates.concentrationUnit = editState.concentrationUnit || undefined;
    updates.storageInstructions = editState.storageInstructions?.trim() || undefined;
    updates.prepNotes = editState.prepNotes?.trim() || undefined;

    onUpdate(compound.id, updates);
    setEditing(false);
    toast.success(`${updates.name || compound.name} updated`);
  };

  const cancelEdit = () => setEditing(false);

  const isSingleUnit = compound.reorderType === 'single';
  const reorderLabel = isPeptide
    ? isSingleUnit
      ? `${compound.reorderQuantity} vial${compound.reorderQuantity !== 1 ? 's' : ''}`
      : `${compound.reorderQuantity} kit${compound.reorderQuantity !== 1 ? 's' : ''} (${compound.reorderQuantity * 10} vials)`
    : `${compound.reorderQuantity} ${compound.reorderType === 'kit' ? 'kit' : 'unit'}${compound.reorderQuantity !== 1 ? 's' : ''}`;

  return (
    <div className={`bg-card rounded-lg border p-2.5 sm:p-3 card-glow transition-opacity ${
      compoundIsPaused ? 'opacity-60 border-accent/30' :
      status === 'critical' ? 'border-destructive/40' :
      status === 'warning' ? 'border-accent/30' :
      'border-border/50'
    }`}>
      {/* Row 1: Name + action buttons */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-foreground truncate">{compound.name}</h4>
          <p className="text-[10px] text-muted-foreground truncate">
            {compoundIsPaused
              ? `Paused${compound.pauseRestartDate ? ` → resumes ${new Date(compound.pauseRestartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' (manual resume)'}`
              : compound.timingNote}
          </p>
        </div>
        {!editing && (
          <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
            <button onClick={startEdit} className="p-1.5 rounded active:bg-secondary/80 transition-colors text-muted-foreground touch-manipulation">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {/* Pause/Resume toggle */}
            <button
              onClick={() => {
                if (compoundIsPaused) {
                  onUpdate(compound.id, { pausedAt: undefined, pauseRestartDate: undefined });
                  toast.success(`${compound.name} resumed`);
                } else {
                  setShowPauseDialog(true);
                }
              }}
              className={`p-1.5 rounded active:bg-secondary/80 transition-colors touch-manipulation ${compoundIsPaused ? 'text-status-warning' : 'text-muted-foreground'}`}
              title={compoundIsPaused ? 'Resume compound' : 'Pause compound'}
            >
              {compoundIsPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
            {/* Dormant toggle */}
            <button
              onClick={() => {
                const isDormant = compound.notes?.includes('[DORMANT]');
                if (isDormant) {
                  const newNotes = (compound.notes || '').replace('[DORMANT]', '').trim();
                  onUpdate(compound.id, { notes: newNotes });
                } else {
                  setConfirmDormant(true);
                }
              }}
              className="p-1.5 rounded active:bg-secondary/80 transition-colors text-muted-foreground touch-manipulation"
              title={compound.notes?.includes('[DORMANT]') ? 'Reactivate compound' : 'Set dormant'}
            >
              <MoonIcon className="w-3.5 h-3.5" />
            </button>
            {/* Delete — spaced away from other actions */}
            {onDelete && !confirmDelete && (
              <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded active:bg-secondary/80 transition-colors text-muted-foreground touch-manipulation ml-2">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Row 2: Status badges */}
      <div className="flex flex-wrap items-center gap-1 mb-2">
        {compound.weightPerUnit && compound.weightPerUnit > 0 && !isPeptide && !isOil && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/40" title="Weight per unit">
            {(() => {
              const su = compound.weightUnit || 'mg';
              if (su === 'mcg') return `${Math.round(compound.weightPerUnit * 1000)}mcg`;
              if (su === 'g') { const gv = compound.weightPerUnit / 1000; return `${gv % 1 === 0 ? gv : gv.toFixed(2).replace(/\.?0+$/, '')}g`; }
              if (su === 'oz') return `${(compound.weightPerUnit / 28349.5).toFixed(3).replace(/\.?0+$/, '')}oz`;
              if (su === 'lb') return `${(compound.weightPerUnit / 453592).toFixed(4).replace(/\.?0+$/, '')}lb`;
              return `${compound.weightPerUnit}mg`;
            })()}/unit
          </span>
        )}
        {compoundIsPaused && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-accent/20 text-status-warning">
            PAUSED{compound.pauseRestartDate
              ? ` → ${new Date(compound.pauseRestartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : ''}
          </span>
        )}
        {/* OUT OF STOCK badge for paused/dormant compounds with no supply */}
        {(compoundIsPaused || compound.notes?.includes('[DORMANT]')) && compound.currentQuantity <= 0 && (
          <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-full bg-destructive/25 text-status-critical border border-destructive/40 uppercase tracking-wider">
            Out of Stock
          </span>
        )}
        {!compoundIsPaused && cycleStatus.hasCycle && compound.cycleOnDays && compound.cycleOnDays > 0 && compound.cycleOffDays && compound.cycleOffDays > 0 && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
            cycleStatus.isOn
              ? 'bg-status-good/15 text-status-good'
              : 'bg-status-warning/15 text-status-warning'
          }`} title={cycleStatus.isOn ? `${cycleStatus.daysLeftInPhase} days left in ON phase` : `${cycleStatus.daysLeftInPhase} days left in OFF phase`}>
            {cycleStatus.isOn
              ? `ON ${cycleStatus.daysLeftInPhase}d`
              : (() => {
                  const resume = new Date();
                  resume.setDate(resume.getDate() + cycleStatus.daysLeftInPhase);
                  const label = resume.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  return `OFF ${cycleStatus.daysLeftInPhase}d → ${label}`;
                })()
            }
          </span>
        )}
        {/* "no date" badge */}
        {!compoundIsPaused && !compound.purchaseDate && !isPeptide && !isOil && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50"
            title="Set a purchase date to activate depletion tracking"
          >
            no date
          </span>
        )}
        {/* Depletion action badge */}
        {!compoundIsPaused && compound.depletionAction && (
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              compound.depletionAction === 'pause' ? 'bg-accent/15 text-status-warning' : 'bg-muted text-muted-foreground'
            }`}
            title={compound.depletionAction === 'pause' ? 'Will auto-pause when depleted' : 'Will go dormant when depleted'}
          >
            {compound.depletionAction === 'pause' ? '⏸ on empty' : '💤 on empty'}
          </span>
        )}
        {!compoundIsPaused && (compound.purchaseDate || isPeptide || isOil) && (
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full cursor-help ${
              status === 'critical' ? 'bg-destructive/20 text-status-critical' :
              status === 'warning' ? 'bg-accent/20 text-status-warning' :
              'bg-status-good/10 text-status-good'
            }`}
            title={getDaysMathTooltip()}
          >
            {days}d left
          </span>
        )}
        {(() => {
          const ci = getCI(compound.id);
          if (!ci || !ci.firstCheckDate) return null;
          const start = new Date(ci.firstCheckDate);
          const end = ci.lastCheckDate ? new Date(ci.lastCheckDate) : new Date();
          const trackingDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (86400000)) + 1);
          const expectedDoses = trackingDays * compound.dosesPerDay * (compound.daysPerWeek / 7);
          if (expectedDoses <= 0) return null;
          const rate = Math.min(100, Math.round((ci.checkedDoses / expectedDoses) * 100));
          const color = rate >= 90 ? 'bg-status-good/10 text-status-good' :
                        rate >= 70 ? 'bg-accent/15 text-status-warning' :
                        'bg-destructive/15 text-status-critical';
          return (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${color}`} title={`${ci.checkedDoses} of ~${Math.round(expectedDoses)} expected doses checked`}>
              ✓ {rate}% taken
            </span>
          );
        })()}
        {/* Titration badge */}
        {titrationBadge && titrationBadge.status === 'active' && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20" title={`Titration: Step ${titrationBadge.currentStep}/${titrationBadge.totalSteps} — ${titrationBadge.currentDose} ${titrationBadge.doseUnit}`}>
            <TrendingUp className="w-2.5 h-2.5" />
            {titrationBadge.currentStep}/{titrationBadge.totalSteps}
          </span>
        )}
      </div>

      {/* Compound Scores — bioavailability, efficacy, effectiveness */}
      {!editing && (() => {
        const staticScores = getCompoundScores(compound.name, compound.category);
        const scores = cachedScores || staticScores;
        if (!scores) return null;
        const scoreColor = (v: number) =>
          v >= 80 ? 'text-status-good' : v >= 60 ? 'text-primary' : v >= 40 ? 'text-status-warning' : 'text-status-critical';
        const tierColors: Record<string, string> = {
          RCT: 'text-status-good', Meta: 'text-status-good', Clinical: 'text-primary',
          Anecdotal: 'text-status-warning', Theoretical: 'text-muted-foreground', Mixed: 'text-primary',
        };
        return (
          <>
            <button
              onClick={() => setShowScoreDrawer(true)}
              className="flex flex-wrap items-center gap-1.5 mb-2 cursor-pointer hover:opacity-80 transition-opacity active:scale-[0.98]"
            >
              <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-border/40 bg-secondary/30" title="Bioavailability — tap for details">
                <Beaker className="w-2.5 h-2.5 text-primary" />
                <span className="text-muted-foreground">Bio</span>
                <span className={scoreColor(scores.bioavailability)}>{scores.bioavailability}%</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-border/40 bg-secondary/30" title="Efficacy — tap for details">
                <FlaskConical className="w-2.5 h-2.5 text-primary" />
                <span className="text-muted-foreground">Eff</span>
                <span className={scoreColor(scores.efficacy)}>{scores.efficacy}%</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-border/40 bg-secondary/30" title="Effectiveness — tap for details">
                <Target className="w-2.5 h-2.5 text-primary" />
                <span className="text-muted-foreground">Ovr</span>
                <span className={scoreColor(scores.effectiveness)}>{scores.effectiveness}%</span>
              </span>
              <span className={`text-[8px] font-mono ${tierColors[scores.evidenceTier] || 'text-muted-foreground'}`}>
                {scores.evidenceTier}
              </span>
              {typeof scores.confidencePct === 'number' && (
                <span className={`text-[8px] font-mono px-1 py-0.5 rounded-full border border-border/30 bg-secondary/20 ${
                  scores.confidencePct >= 80 ? 'text-status-good' : scores.confidencePct >= 60 ? 'text-primary' : scores.confidencePct >= 40 ? 'text-status-warning' : 'text-status-critical'
                }`} title="AI confidence in score accuracy">
                  {scores.confidencePct}% conf
                </span>
              )}
            </button>
            <CompoundScoreDrawer
              open={showScoreDrawer}
              onOpenChange={(open) => { setShowScoreDrawer(open); if (!open) onScoreDrawerClose?.(); }}
              compoundName={compound.name}
              scores={staticScores || scores}
              deliveryMethod={getDeliveryLabel(compound.category)}
              category={compound.category}
              dosePerUse={compound.dosePerUse}
              dosesPerDay={compound.dosesPerDay}
              daysPerWeek={compound.daysPerWeek}
              unitLabel={compound.unitLabel}
              doseLabel={compound.doseLabel}
            />
          </>
        );
      })()}

      {!compoundIsPaused && cycleStatus.hasCycle && compound.cycleOnDays && compound.cycleOffDays && compound.cycleStartDate && (
        <div className="mb-2">
          <button
            onClick={() => setShowCycleTimeline(v => !v)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors w-full"
          >
            <RefreshCcw className="w-2.5 h-2.5" />
            <span>Cycle timeline</span>
            {showCycleTimeline ? <ChevronUp className="w-2.5 h-2.5 ml-auto" /> : <ChevronDown className="w-2.5 h-2.5 ml-auto" />}
          </button>
          {showCycleTimeline && (
            <div className="mt-1.5">
              <CycleTimelineBar compound={compound} />
            </div>
          )}
        </div>
      )}

      {confirmDelete && (
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 mb-2">
          <span className="text-[11px] text-destructive font-medium">Remove from protocol?</span>
          <div className="flex gap-1">
            <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded text-[10px] bg-secondary text-muted-foreground">
              Cancel
            </button>
            <button onClick={() => onDelete?.(compound.id)} className="px-2 py-1 rounded text-[10px] bg-destructive text-destructive-foreground font-medium">
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Dormant confirmation */}
      <ConfirmDialog
        open={confirmDormant}
        onOpenChange={setConfirmDormant}
        title="Set Compound Dormant?"
        description={`Mark "${compound.name}" as dormant? It will be moved to the dormant section but kept in your inventory for future use.`}
        confirmLabel="Set Dormant"
        onConfirm={() => {
          const newNotes = `[DORMANT] ${compound.notes || ''}`.trim();
          onUpdate(compound.id, { notes: newNotes });
          setConfirmDormant(false);
        }}
      />

      {/* Pause dialog */}
      {showPauseDialog && (
        <div className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-2.5 mb-2 space-y-2">
          <div className="flex items-center gap-2">
            <Pause className="w-3.5 h-3.5 text-status-warning flex-shrink-0" />
            <span className="text-xs font-semibold text-foreground">Pause {compound.name}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Inventory depletion and cost projections will freeze. {cycleStatus.hasCycle ? 'Your current cycle will resume from where it left off when you unpause.' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground">Restart date (optional):</span>
            <DatePickerInput
              value={pauseDate}
              onChange={setPauseDate}
              min={new Date().toISOString().split('T')[0]}
              className="flex-1 text-[11px] py-1"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                onUpdate(compound.id, {
                  pausedAt: new Date().toISOString(),
                  pauseRestartDate: pauseDate || undefined,
                });
                toast.success(`${compound.name} paused${pauseDate ? ` until ${new Date(pauseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}`);
                setShowPauseDialog(false);
                setPauseDate('');
              }}
              className="flex-1 py-1.5 rounded-lg bg-accent/20 text-status-warning text-[11px] font-semibold hover:bg-accent/30 transition-colors"
            >
              Pause Now
            </button>
            <button
              onClick={() => { setShowPauseDialog(false); setPauseDate(''); }}
              className="px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground text-[11px] font-medium hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Depletion Action selector — what happens when stock runs out */}
      {!editing && !compoundIsPaused && !compound.notes?.includes('[DORMANT]') && (
        <div className="mb-2 flex items-center gap-2 bg-secondary/30 border border-border/30 rounded-lg px-2.5 py-1.5">
          <TrendingDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className="text-[10px] text-muted-foreground flex-1">When depleted:</span>
          <select
            value={compound.depletionAction || ''}
            onChange={e => {
              const val = e.target.value || null;
              onUpdate(compound.id, { depletionAction: val as 'pause' | 'dormant' | null });
              toast.success(
                val === 'pause' ? `${compound.name} will auto-pause on depletion`
                : val === 'dormant' ? `${compound.name} will go dormant on depletion`
                : `${compound.name} depletion action cleared`
              );
            }}
            className="bg-secondary border border-border/50 rounded px-2 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
          >
            <option value="">Continue (reorder)</option>
            <option value="pause">Auto-pause</option>
            <option value="dormant">Go dormant</option>
          </select>
        </div>
      )}

      {/* Purchase date prompt — only for orals/powders/vitamins/etc where you need to know
          how many units are in the current bottle. Peptides and oils burn at a known rate
          from dose × frequency alone, so no purchase date is required. */}
      {!compound.purchaseDate && !editing && !isPeptide && !isOil && (
        <div className="mb-2 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-2.5 py-1.5">
          <Calendar className="w-3 h-3 text-primary/70 flex-shrink-0" />
          <span className="text-[10px] text-muted-foreground flex-1">Set purchase date to track pills remaining</span>
          <DatePickerInput
            value=""
            onChange={v => {
              if (v) onUpdate(compound.id, { purchaseDate: v });
            }}
            max={new Date().toISOString().split('T')[0]}
            placeholder="Set date"
            className="text-[10px] py-1 w-28 bg-transparent border-0"
          />
        </div>
      )}


      {/* Dilution / Reconstitution Prep Guide */}
      {!editing && (() => {
        const guide = buildPrepGuide(compound);
        if (!guide) return null;
        return (
          <div className="mb-2 bg-primary/5 border border-primary/15 rounded-lg px-2.5 py-2 space-y-1.5">
            {/* Header row: solvent info + concentration */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Droplets className="w-3 h-3 text-primary/60 flex-shrink-0" />
              <span className="text-[10px] font-semibold text-foreground/80">Prep Guide</span>
              {guide.solventVolume > 0 && (
                <>
                  <span className="text-[10px] text-muted-foreground/50">·</span>
                  <span className="text-[10px] text-muted-foreground">
                    {guide.solventVolume}{guide.solventUnit} {guide.solventType}
                  </span>
                </>
              )}
              {guide.concentration && (
                <>
                  <span className="text-[10px] text-muted-foreground/50">→</span>
                  <span className="text-[10px] font-mono text-foreground/80">{guide.concentration}</span>
                </>
              )}
            </div>
            {/* Dose math row */}
            {(guide.doseVolume || guide.dosesPerVial) && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Syringe className="w-3 h-3 text-primary/40 flex-shrink-0" />
                {guide.doseVolume && (
                  <span className="text-[10px] font-mono text-foreground/70">{guide.doseVolume}</span>
                )}
                {guide.doseVolume && guide.dosesPerVial && (
                  <span className="text-[10px] text-muted-foreground/50">·</span>
                )}
                {guide.dosesPerVial && (
                  <span className="text-[10px] font-mono text-foreground/70">{guide.dosesPerVial} doses/vial</span>
                )}
              </div>
            )}
            {/* Prep notes */}
            {guide.prepNotes && (
              <p className="text-[9px] text-muted-foreground leading-relaxed">{guide.prepNotes}</p>
            )}
            {/* Storage */}
            {guide.storageInstructions && (
              <div className="flex items-start gap-1">
                <Thermometer className="w-2.5 h-2.5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                <p className="text-[9px] text-muted-foreground/70 leading-relaxed">{guide.storageInstructions}</p>
              </div>
            )}
          </div>
        );
      })()}

      {editing ? (
        <div className="space-y-1.5">
          <EditRow label="Name" value={editState.name || compound.name}
            onChange={v => setEditState(s => ({ ...s, name: v }))} type="text" />
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Category</span>
            <div className="flex gap-1 flex-1 flex-wrap">
              {categoryOrder.map(cat => (
                <button
                  key={cat}
                  onClick={() => setEditState(s => ({ ...s, category: cat }))}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                    editState.category === cat
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-secondary text-muted-foreground border border-border/50'
                  }`}
                >
                  {categoryLabels[cat] || cat}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Timing</span>
            <div className="flex gap-1 flex-1 flex-wrap">
              {(['morning', 'afternoon', 'evening'] as const).map(t => {
                const current = (editState.timing || '').toLowerCase();
                // Match plurals and variants
                const timingKeywords = /\b(mornings?|am|evenings?|pm|nightl?y?|nights?|afternoons?|pre[- ]?workouts?|post[- ]?workouts?)\b/gi;
                const isActive = 
                  (t === 'morning' && (/\b(mornings?|am)\b/i.test(current))) ||
                  (t === 'evening' && (/\b(evenings?|pm|nightl?y?|nights?)\b/i.test(current))) ||
                  (t === 'afternoon' && (/\b(afternoons?|pre[- ]?workouts?|post[- ]?workouts?)\b/i.test(current)));
                return (
                  <button
                    key={t}
                    onClick={() => {
                      const note = editState.timing || '';
                      // Strip ALL timing keywords (including plurals)
                      const stripped = note.replace(timingKeywords, '').replace(/[,\s]+/g, ' ').trim();
                      // Determine active set from current text
                      const active = new Set<string>();
                      if (/\b(mornings?|am)\b/i.test(current)) active.add('morning');
                      if (/\b(afternoons?|pre[- ]?workouts?|post[- ]?workouts?)\b/i.test(current)) active.add('afternoon');
                      if (/\b(evenings?|pm|nightl?y?|nights?)\b/i.test(current)) active.add('evening');
                      // Toggle
                      if (active.has(t)) active.delete(t); else active.add(t);
                      // Rebuild
                      const timingStr = Array.from(active).join(', ');
                      const newNote = stripped ? (timingStr ? `${timingStr}, ${stripped}` : stripped) : timingStr;
                      setEditState(s => ({ ...s, timing: newNote }));
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                      isActive
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-secondary text-muted-foreground border border-border/50'
                    }`}
                  >
                    {t === 'morning' ? <><Sun className="w-3 h-3 inline mr-0.5" />AM</> : t === 'afternoon' ? <><Dumbbell className="w-3 h-3 inline mr-0.5" />Mid</> : <><MoonIcon className="w-3 h-3 inline mr-0.5" />PM</>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Days</span>
            <div className="flex gap-0.5 flex-1">
              {(() => {
                const activeDays = parseDaysFromNote(editState.timing || '');
                const allSelected = activeDays.size === 7;
                const toggleDay = (idx: number) => {
                  const days = new Set(activeDays);
                  if (days.has(idx)) days.delete(idx);
                  else days.add(idx);
                  const note = editState.timing || '';
                  let cleaned = note
                    .replace(/\b(daily|nightl?y?|every\s*day|m[\/-]f|mon[\s-]*fri|m\/w\/f|t\/th|M\/T\/W\/Th\/F\/?)\b/gi, '')
                    .replace(/\b(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sa)\b/gi, '')
                    .replace(/[,\/]\s*[,\/]/g, ',')
                    .replace(/^[,\s]+|[,\s]+$/g, '')
                    .trim();
                  const dayStr = days.size === 7 ? 'daily' : buildDayString(days);
                  const newNote = cleaned ? (dayStr ? `${dayStr}, ${cleaned}` : cleaned) : dayStr;
                  setEditState(s => ({ ...s, timing: newNote, daysPerWeek: days.size.toString() }));
                };
                const toggleAll = () => {
                  const note = editState.timing || '';
                  let cleaned = note
                    .replace(/\b(daily|nightl?y?|every\s*day|m[\/-]f|mon[\s-]*fri|m\/w\/f|t\/th|M\/T\/W\/Th\/F\/?)\b/gi, '')
                    .replace(/\b(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sa)\b/gi, '')
                    .replace(/[,\/]\s*[,\/]/g, ',')
                    .replace(/^[,\s]+|[,\s]+$/g, '')
                    .trim();
                  if (allSelected) {
                    // Deselect all
                    setEditState(s => ({ ...s, timing: cleaned, daysPerWeek: '0' }));
                  } else {
                    const newNote = cleaned ? `daily, ${cleaned}` : 'daily';
                    setEditState(s => ({ ...s, timing: newNote, daysPerWeek: '7' }));
                  }
                };
                return (
                  <>
                    <button
                      onClick={toggleAll}
                      className={`h-7 px-1.5 rounded text-[10px] font-medium transition-all ${
                        allSelected
                          ? 'bg-primary/15 text-primary border border-primary/30'
                          : 'bg-secondary text-muted-foreground border border-border/50'
                      }`}
                    >
                      Daily
                    </button>
                    {DAY_LABELS.map((label, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleDay(idx)}
                        className={`w-7 h-7 rounded text-[10px] font-medium transition-all ${
                          activeDays.has(idx)
                            ? 'bg-primary/15 text-primary border border-primary/30'
                            : 'bg-secondary text-muted-foreground border border-border/50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
          <EditRow label="Note" value={editState.timing || ''}
            onChange={v => setEditState(s => ({ ...s, timing: v }))} type="text" />
          {/* On Hand with unit dropdown */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">{isPeptide ? 'Vials' : 'On Hand'}</span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                value={editState.currentQuantity}
                onChange={e => setEditState(s => ({ ...s, currentQuantity: e.target.value }))}
                className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
               />
              {editState.category === 'powder' ? (
                <select
                  value={editState.containerType || 'bags'}
                  onChange={e => setEditState(s => ({ ...s, containerType: e.target.value }))}
                  className="bg-secondary border border-border/50 rounded px-1.5 py-1 text-foreground font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-[52px]"
                >
                  <option value="bags">bags</option>
                  <option value="bottles">bottles</option>
                </select>
              ) : (
                <span className="text-muted-foreground text-[10px] whitespace-nowrap">
                  {isPeptide ? 'vials' : isOil ? 'vials' : 'bottles'}
                </span>
              )}
            </div>
          </div>
          {/* Volume (peptides only) or Per Unit (others) */}
          {editState.category === 'peptide' ? (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-muted-foreground w-16 flex-shrink-0">Volume</span>
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number"
                  value={editState.unitSize}
                  onChange={e => setEditState(s => ({ ...s, unitSize: e.target.value }))}
                  className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <select
                  value={editState.unitLabel || compound.unitLabel}
                  onChange={e => setEditState(s => ({ ...s, unitLabel: e.target.value }))}
                  className="bg-secondary border border-border/50 rounded px-1.5 py-1 text-foreground font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-[52px]"
                >
                  <option value="mg vial">mg vial</option>
                  <option value="mL vial">mL vial</option>
                  <option value="mg/mL">mg/mL</option>
                  <option value="IU">IU</option>
                  <option value="mL">mL</option>
                </select>
                <span className="text-muted-foreground text-[10px] whitespace-nowrap">/vial</span>
              </div>
            </div>
          ) : editState.category === 'injectable-oil' ? (
            <>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground w-16 flex-shrink-0">Conc.</span>
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="number"
                    value={editState.unitSize}
                    onChange={e => setEditState(s => ({ ...s, unitSize: e.target.value }))}
                    className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  <span className="text-muted-foreground text-[10px] whitespace-nowrap">mg/mL</span>
                </div>
              </div>
              <EditRow label="Vial Size" value={editState.vialSizeMl || '10'} suffix="mL"
                onChange={v => setEditState(s => ({ ...s, vialSizeMl: v }))} type="number" />
            </>
          ) : (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-muted-foreground w-16 flex-shrink-0 flex items-center gap-0.5">
                Per Unit
                <InfoTooltip text="How much is in each container/bottle. For liquids dosed by drops, enter the volume (e.g. 2 fl oz) — the system auto-converts to drops." />
              </span>
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number"
                  value={editState.unitSize}
                  onChange={e => setEditState(s => ({ ...s, unitSize: e.target.value }))}
                  className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <select
                  value={editState.unitLabel || compound.unitLabel}
                  onChange={e => setEditState(s => ({ ...s, unitLabel: e.target.value }))}
                  className="bg-secondary border border-border/50 rounded px-1.5 py-1 text-foreground font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-[52px]"
                >
                  <option value="caps">caps</option>
                  <option value="tabs">tabs</option>
                  <option value="softgels">softgels</option>
                  <option value="drops">drops</option>
                  <option value="servings">servings</option>
                  <option value="scoops">scoops</option>
                  <option value="pills">pills</option>
                  <option value="spray">spray</option>
                  <option value="patch">patch</option>
                  <option value="mg">mg</option>
                  <option value="mcg">mcg</option>
                  <option value="g">g</option>
                  <option value="mL">mL</option>
                  <option value="fl oz">fl oz</option>
                  <option value="mg/mL">mg/mL</option>
                  <option value="tbsp">tbsp</option>
                  <option value="tsp">tsp</option>
                  <option value="oz">oz</option>
                  <option value="IU">IU</option>
                  <option value="units">units</option>
                </select>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Dose</span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                value={editState.dosePerUse}
                onChange={e => setEditState(s => ({ ...s, dosePerUse: e.target.value }))}
                className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <select
                value={editState.editDoseUnit || 'mg'}
                onChange={e => {
                  const newUnit = e.target.value;
                  const oldUnit = editState.editDoseUnit || 'mg';
                  if (newUnit === oldUnit) return;
                  // Convert current dose value between units
                  let currentDose = parseFloat(editState.dosePerUse) || 0;
                  const unitSize = parseFloat(editState.unitSize) || compound.unitSize;
                  const reconVolIU = (compound.reconVolume || 2) * 100;
                  const catIsPeptide = (editState.category || compound.category) === 'peptide';
                  const catIsOil = (editState.category || compound.category) === 'injectable-oil';

                  // First convert current value back to mg (base unit)
                  let mgValue = currentDose;
                  if (oldUnit === 'iu') {
                    if (catIsPeptide && unitSize > 0) mgValue = (currentDose / reconVolIU) * unitSize;
                    else if (catIsOil && unitSize > 0) mgValue = (currentDose / 200) * unitSize;
                  } else if (oldUnit === 'ml') {
                    if (catIsPeptide) mgValue = (currentDose * 100 / reconVolIU) * unitSize;
                    else if (catIsOil) mgValue = currentDose * unitSize;
                  } else if (oldUnit === 'mcg') {
                    mgValue = currentDose / 1000;
                   } else if (oldUnit === 'g') {
                     mgValue = currentDose * 1000;
                   } else if (['pills','caps','tabs','scoop','drops','spray','patch','tbsp','tsp','oz','units'].includes(oldUnit)) {
                     mgValue = currentDose; // raw dose — no conversion
                   }

                  // Then convert mg to new unit
                  let newDose = mgValue;
                  if (newUnit === 'iu') {
                    if (catIsPeptide && unitSize > 0) newDose = (mgValue / unitSize) * reconVolIU;
                    else if (catIsOil && unitSize > 0) newDose = (mgValue / unitSize) * 200;
                  } else if (newUnit === 'ml') {
                    if (catIsPeptide) newDose = ((mgValue / unitSize) * reconVolIU) / 100;
                    else if (catIsOil && unitSize > 0) newDose = mgValue / unitSize;
                  } else if (newUnit === 'mcg') {
                    newDose = mgValue * 1000;
                   } else if (newUnit === 'g') {
                     newDose = mgValue / 1000;
                   } else if (['pills','caps','tabs','scoop','drops','spray','patch','tbsp','tsp','oz','units'].includes(newUnit)) {
                     newDose = mgValue;
                   }

                  newDose = Math.round(newDose * 1000) / 1000;
                  setEditState(s => ({ ...s, editDoseUnit: newUnit, dosePerUse: newDose.toString() }));
                }}
                className="bg-secondary border border-border/50 rounded px-1.5 py-1 text-foreground font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-[52px]"
              >
                <option value="mg">mg</option>
                <option value="mcg">mcg</option>
                <option value="g">g</option>
                <option value="iu">IU</option>
                <option value="ml">mL</option>
                <option value="floz">fl oz</option>
                <option value="drops">drops</option>
                <option value="pills">pills</option>
                <option value="caps">caps</option>
                <option value="tabs">tabs</option>
                <option value="softgels">softgels</option>
                <option value="scoop">scoop</option>
                <option value="spray">spray</option>
                <option value="patch">patch</option>
                <option value="tbsp">tbsp</option>
                <option value="tsp">tsp</option>
                <option value="oz">oz</option>
                <option value="units">units</option>
              </select>
           </div>
          </div>
          <EditRow label="Doses/Day" value={editState.dosesPerDay || '1'}
            onChange={v => setEditState(s => ({ ...s, dosesPerDay: v }))} type="number" />
          {isPeptide ? (
            editState.reorderType === 'single' ? (
              <EditRow label="Unit Price" value={editState.unitPrice || (parseFloat(editState.kitPrice || '0') / 10).toString()} prefix="$" suffix="/vial"
                onChange={v => setEditState(s => ({ ...s, unitPrice: v }))} type="number" />
            ) : (
              <EditRow label="Kit Price" value={editState.kitPrice} prefix="$" suffix="/kit (10 vials)"
                onChange={v => setEditState(s => ({ ...s, kitPrice: v }))} type="number" />
            )
          ) : (
            <EditRow label="Price" value={editState.unitPrice} prefix="$" suffix={`/${isOil ? 'vial' : 'bottle'}`}
              onChange={v => setEditState(s => ({ ...s, unitPrice: v }))} type="number" />
          )}
          {/* Weight per unit — available for all non-peptide/oil categories */}
          {!isPeptide && !isOil && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0 flex items-center gap-0.5">
              Weight/Unit
              <InfoTooltip text="Weight per individual pill, cap, or drop — NOT total container weight. Use the calculator (🧮) to derive this from total weight ÷ count." />
            </span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                value={editState.weightPerUnit || ''}
                onChange={e => setEditState(s => ({ ...s, weightPerUnit: e.target.value }))}
                placeholder="e.g. 500"
                className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <select
                value={editState.strengthUnit || 'mg'}
                onChange={e => setEditState(s => ({ ...s, strengthUnit: e.target.value }))}
                className="bg-secondary border border-border/50 rounded px-1.5 py-1 text-foreground font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-[48px]"
              >
                <option value="mg">mg</option>
                <option value="mcg">mcg</option>
                <option value="g">g</option>
                <option value="oz">oz</option>
                <option value="lb">lb</option>
              </select>
              <button
                type="button"
                onClick={() => setShowCalculator(true)}
                className="p-1 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex-shrink-0"
                title="Open compounding calculator"
              >
                <Calculator className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          )}
          <CompoundingCalculator
            open={showCalculator}
            onOpenChange={setShowCalculator}
            onApply={(result) => {
              if (result.weightPerUnit !== undefined) {
                setEditState(s => ({ ...s, weightPerUnit: result.weightPerUnit!.toString(), strengthUnit: 'mg' }));
              }
              if (result.concentration !== undefined) {
                setEditState(s => ({
                  ...s,
                  ...(result.solventType ? { solventType: result.solventType } : {}),
                  ...(result.solventVolume ? { solventVolume: result.solventVolume.toString() } : {}),
                  resultingConcentration: result.concentration!.toString(),
                  concentrationUnit: result.concentrationUnit || 'mg/mL',
                }));
              }
            }}
          />
          {!isPeptide && !isOil && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Purchased</span>
            <div className="flex items-center gap-1 flex-1">
              <DatePickerInput
                value={editState.purchaseDate || ''}
                onChange={v => setEditState(s => ({ ...s, purchaseDate: v }))}
                className="text-[11px] py-1"
              />
              {editState.purchaseDate && (
                <button
                  onClick={() => setEditState(s => ({ ...s, purchaseDate: '' }))}
                  className="p-1 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground flex-shrink-0"
                  title="Clear date"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          )}
          <EditRow
            label="Reorder Qty"
            value={editState.reorderQuantity}
            onChange={v => setEditState(s => ({ ...s, reorderQuantity: v }))}
            type="number"
            suffix={editState.reorderType === 'kit' ? 'kits' : 'units'}
          />
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Order As</span>
            <div className="flex gap-1 flex-1">
              {(['single', 'kit'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setEditState(s => ({ ...s, reorderType: t }))}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    editState.reorderType === t
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-secondary text-muted-foreground border border-border/50'
                  }`}
                >
                  {t === 'single' ? 'Single Unit' : 'Kit'}
                </button>
              ))}
            </div>
          </div>
          {/* Cycling toggle */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">Cycling</span>
            <div className="flex gap-1 flex-1">
              <button
                onClick={() => {
                  if (editState.cyclingEnabled === 'true') {
                    setEditState(s => ({ ...s, cyclingEnabled: 'false', cycleOnDays: '0', cycleOffDays: '0', cycleStartDate: '' }));
                  } else {
                    setEditState(s => ({
                      ...s,
                      cyclingEnabled: 'true',
                      cycleOnDays: s.cycleOnDays && s.cycleOnDays !== '0' ? s.cycleOnDays : '28',
                      cycleOffDays: s.cycleOffDays && s.cycleOffDays !== '0' ? s.cycleOffDays : '14',
                      cycleStartDate: s.cycleStartDate || new Date().toISOString().split('T')[0],
                    }));
                  }
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  editState.cyclingEnabled === 'true'
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-secondary text-muted-foreground border border-border/50'
                }`}
              >
                <RefreshCcw className="w-3 h-3 inline mr-0.5" />
                {editState.cyclingEnabled === 'true' ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
          {editState.cyclingEnabled === 'true' && (
            <>
              <EditRow label="Cycle ON" value={editState.cycleOnDays || ''} suffix="days"
                onChange={v => setEditState(s => ({ ...s, cycleOnDays: v }))} type="number" />
              <EditRow label="Cycle OFF" value={editState.cycleOffDays || ''} suffix="days"
                onChange={v => setEditState(s => ({ ...s, cycleOffDays: v }))} type="number" />
              <EditRow label="Cycle Start" value={editState.cycleStartDate || ''}
                onChange={v => setEditState(s => ({ ...s, cycleStartDate: v }))} type="date" />
            </>
          )}
          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="border-t border-border/30 pt-1.5 mt-1.5 space-y-1">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Custom Fields</span>
              {customFields.map((f, fIdx) => (
                <div key={f.id} className="flex items-center gap-1 text-[11px] group/field">
                  {/* Drag handle with reorder controls */}
                  {onReorderCustomField && (
                    <div className="flex items-center gap-0 flex-shrink-0">
                      <GripVertical className="w-3 h-3 text-muted-foreground/40 cursor-grab" />
                      <div className="flex flex-col gap-0">
                        <button
                          onClick={() => onReorderCustomField(f.id, 'up')}
                          disabled={fIdx === 0}
                          className="p-0 text-muted-foreground/50 hover:text-primary disabled:opacity-20 transition-colors"
                          title="Move up"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onReorderCustomField(f.id, 'down')}
                          disabled={fIdx === customFields.length - 1}
                          className="p-0 text-muted-foreground/50 hover:text-primary disabled:opacity-20 transition-colors"
                          title="Move down"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                  <span className="text-muted-foreground w-14 flex-shrink-0 truncate" title={f.field_name}>{f.field_name}</span>
                  <div className="flex items-center gap-1 flex-1">
                    {f.field_type === 'select' && f.options ? (
                      <select
                        value={customFieldValues.get(f.id) || f.default_value || ''}
                        onChange={e => onSetCustomFieldValue?.(compound.id, f.id, e.target.value)}
                        className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                      >
                        {(f.options as string[]).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                        value={customFieldValues.get(f.id) || f.default_value || ''}
                        onChange={e => onSetCustomFieldValue?.(compound.id, f.id, e.target.value)}
                        placeholder={f.default_value || ''}
                        className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    )}
                    {f.field_unit && <span className="text-muted-foreground text-[10px] whitespace-nowrap">{f.field_unit}</span>}
                    {onRemoveCustomField && !f.is_predefined && (
                      <button
                        onClick={async () => {
                          await onRemoveCustomField(f.id);
                          toast.success(`Removed "${f.field_name}" field`);
                        }}
                        className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                        title={`Remove ${f.field_name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    {onRemoveCustomField && f.is_predefined && (
                      <button
                        onClick={async () => {
                          await onRemoveCustomField(f.id);
                          toast.success(`Removed "${f.field_name}" field`);
                        }}
                        className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                        title={`Remove ${f.field_name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Add Field */}
          {onAddCustomField && (
            <div className="pt-1">
              {showAddField ? (
                <div className="space-y-1.5 border border-dashed border-primary/20 rounded-lg p-2 bg-primary/5">
                  <div className="flex gap-1 flex-wrap mb-1">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold w-full">Quick Add</span>
                    {PREDEFINED_FIELDS.filter(pf => !customFields.some(cf => cf.field_name === pf.field_name)).slice(0, 4).map(pf => (
                      <button
                        key={pf.field_name}
                        onClick={async () => {
                          await onAddCustomField(pf);
                          toast.success(`Added "${pf.field_name}" field`);
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground border border-border/50 hover:text-primary hover:border-primary/30 transition-all"
                      >
                        + {pf.field_name}
                      </button>
                    ))}
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Custom</span>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newFieldName}
                      onChange={e => setNewFieldName(e.target.value)}
                      placeholder="Field name"
                      className="flex-1 bg-secondary border border-border/50 rounded px-2 py-1 text-foreground text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <select
                      value={newFieldType}
                      onChange={e => setNewFieldType(e.target.value as any)}
                      className="bg-secondary border border-border/50 rounded px-1 py-1 text-[10px] text-foreground focus:outline-none"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                    </select>
                  </div>
                  {newFieldType === 'number' && (
                    <input
                      type="text"
                      value={newFieldUnit}
                      onChange={e => setNewFieldUnit(e.target.value)}
                      placeholder="Unit (e.g. mg, hours, $)"
                      className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  )}
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => { setShowAddField(false); setNewFieldName(''); setNewFieldUnit(''); }} className="px-2 py-0.5 rounded text-[10px] text-muted-foreground bg-secondary">Cancel</button>
                    <button
                      onClick={async () => {
                        if (!newFieldName.trim()) return;
                        await onAddCustomField({
                          field_name: newFieldName.trim(),
                          field_type: newFieldType,
                          field_unit: newFieldUnit.trim() || null,
                          affects_calculation: newFieldType === 'number',
                          is_predefined: false,
                        });
                        toast.success(`Added "${newFieldName}" to all compounds`);
                        setNewFieldName('');
                        setNewFieldUnit('');
                        setShowAddField(false);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] text-primary bg-primary/10 border border-primary/20 font-medium"
                    >Add</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddField(true)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                >
                  <PlusCircle className="w-3 h-3" /> Add Field
                </button>
              )}
            </div>
          )}
          {/* Dilution / Reconstitution Fields */}
          <div className="border-t border-border/30 pt-1.5 mt-1.5 space-y-1">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
              <Droplets className="w-3 h-3" /> Dilution / Reconstitution
            </span>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-muted-foreground w-16 flex-shrink-0">Solvent</span>
              <select
                value={editState.solventType || ''}
                onChange={e => setEditState(s => ({ ...s, solventType: e.target.value }))}
                className="flex-1 bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="">None</option>
                <option value="Bacteriostatic Water">Bacteriostatic Water</option>
                <option value="Sterile Water">Sterile Water</option>
                <option value="Reverse Osmosis Water">Reverse Osmosis Water</option>
                <option value="Sterile Saline">Sterile Saline</option>
                <option value="MCT Oil">MCT Oil</option>
                <option value="DMSO">DMSO</option>
                <option value="Propylene Glycol">Propylene Glycol</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {editState.solventType && editState.solventType !== '' && (
              <>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground w-16 flex-shrink-0">Volume</span>
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      type="number"
                      value={editState.solventVolume || ''}
                      onChange={e => setEditState(s => ({ ...s, solventVolume: e.target.value }))}
                      placeholder="e.g. 2"
                      className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <select
                      value={editState.solventUnit || 'mL'}
                      onChange={e => setEditState(s => ({ ...s, solventUnit: e.target.value }))}
                      className="bg-secondary border border-border/50 rounded px-1.5 py-1 text-foreground font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-[48px]"
                    >
                      <option value="mL">mL</option>
                      <option value="fl oz">fl oz</option>
                      <option value="oz">oz</option>
                      <option value="L">L</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground w-16 flex-shrink-0">Conc.</span>
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      type="number"
                      value={editState.resultingConcentration || ''}
                      onChange={e => setEditState(s => ({ ...s, resultingConcentration: e.target.value }))}
                      placeholder="auto"
                      className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <select
                      value={editState.concentrationUnit || 'mg/mL'}
                      onChange={e => setEditState(s => ({ ...s, concentrationUnit: e.target.value }))}
                      className="bg-secondary border border-border/50 rounded px-1.5 py-1 text-foreground font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-[56px]"
                    >
                      <option value="mg/mL">mg/mL</option>
                      <option value="mcg/mL">mcg/mL</option>
                      <option value="g/mL">g/mL</option>
                      <option value="IU/mL">IU/mL</option>
                      <option value="mg/fl oz">mg/fl oz</option>
                      <option value="g/fl oz">g/fl oz</option>
                      <option value="mg/L">mg/L</option>
                      <option value="%">% (w/v)</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground w-16 flex-shrink-0">Storage</span>
                  <input
                    type="text"
                    value={editState.storageInstructions || ''}
                    onChange={e => setEditState(s => ({ ...s, storageInstructions: e.target.value }))}
                    placeholder="e.g. Refrigerate after reconstitution"
                    className="flex-1 bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground w-16 flex-shrink-0">Prep Notes</span>
                  <textarea
                    value={editState.prepNotes || ''}
                    onChange={e => setEditState(s => ({ ...s, prepNotes: e.target.value }))}
                    placeholder="Reconstitution instructions..."
                    rows={2}
                    className="flex-1 bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-1 pt-1">
            <button onClick={cancelEdit} className="p-1 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
            <button onClick={saveEdit} className="p-1 rounded bg-primary/20 hover:bg-primary/30 text-primary">
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Per-card dose unit toggle for injectables/peptides */}
          {(isPeptide || isOil) && (
            <div className="flex justify-end mb-1.5">
              <button
                onClick={() => setDoseUnit(u => u === 'mg' ? 'ml' : u === 'ml' ? 'iu' : 'mg')}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
              >
                <Syringe className="w-2.5 h-2.5" />
                {doseUnit === 'mg' ? 'mg/mcg' : doseUnit === 'ml' ? 'mg/mL' : 'IU'}
              </button>
            </div>
          )}
          {isPeptide ? (() => {
            const storedIsIu = compound.doseLabel.toLowerCase().includes('iu');
            const storedIsMg = compound.doseLabel.toLowerCase().includes('mg') || compound.doseLabel.toLowerCase().includes('mcg');
            const reconVolIU = (compound.reconVolume || 2) * 100; // mL → IU (1mL = 100 IU)
            const vialMg = compound.unitSize;

            let displayDose = `${compound.dosePerUse} ${compound.doseLabel}`;
            if (doseUnit === 'ml') {
              // Convert to mL: IU / 100 or mg-based
              if (storedIsIu) {
                const ml = Math.round((compound.dosePerUse / 100) * 1000) / 1000;
                displayDose = `${ml} mL`;
              } else if (storedIsMg && vialMg > 0) {
                const iu = (compound.dosePerUse / vialMg) * reconVolIU;
                const ml = Math.round((iu / 100) * 1000) / 1000;
                displayDose = `${ml} mL`;
              }
            } else if (doseUnit === 'iu' && storedIsMg && vialMg > 0) {
              const iu = Math.round((compound.dosePerUse / vialMg) * reconVolIU * 100) / 100;
              displayDose = `${iu} IU`;
            } else if (doseUnit === 'mg' && storedIsIu && vialMg > 0) {
              const mg = Math.round((compound.dosePerUse / reconVolIU) * vialMg * 1000) / 1000;
              displayDose = `${mg} mg`;
            }

            return (
              <div className="grid grid-cols-2 gap-x-3 text-[10px]">
              <InlineQuantityEditor
                compound={compound}
                status={status}
                isOil={false}
                isPeptide={true}
                onUpdate={onUpdate}
              />
                <div>
                  <span className="text-muted-foreground">Per Vial:</span>{' '}
                  <span className="font-mono text-foreground">{compound.unitSize} {(() => {
                    const ul = (compound.unitLabel || 'mg vial').toLowerCase();
                    if (ul.includes('ml')) return 'mL';
                    if (ul.includes('iu')) return 'IU';
                    if (ul.includes('mg/ml')) return 'mg/mL';
                    return 'mg';
                  })()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Dose:</span>{' '}
                  <span className="font-mono text-foreground">{displayDose}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{isSingleUnit ? 'Unit Price:' : 'Kit Price:'}</span>{' '}
                  <span className="font-mono text-foreground">${isSingleUnit ? compound.unitPrice : (compound.kitPrice || 0)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Reorder:</span>{' '}
                  <span className="font-mono text-foreground">{reorderLabel}</span>
                </div>
                {compound.purchaseDate && (
                  <div>
                    <span className="text-muted-foreground">Purchased:</span>{' '}
                    <span className="font-mono text-foreground">{compound.purchaseDate}</span>
                  </div>
                )}
                {!compoundIsPaused && !compound.notes?.includes('[DORMANT]') && (
                <div>
                  <span className="text-muted-foreground">Reorder by:</span>{' '}
                  <span className="font-mono text-accent">{reorderDate}</span>
                </div>
                )}
              </div>
            );
          })() : (
            <div className="grid grid-cols-2 gap-x-3 text-[10px]">
              <InlineQuantityEditor
                compound={compound}
                status={status}
                isOil={isOil}
                isPeptide={false}
                onUpdate={onUpdate}
              />
              <div>
                <span className="text-muted-foreground">Price:</span>{' '}
                <span className="font-mono text-foreground">${compound.unitPrice}/{isOil ? 'vial' : getCompoundContainerKind(compound)}</span>
              </div>
              {isOil && (
                <div>
                  <span className="text-muted-foreground">Per Vial:</span>{' '}
                  <span className="font-mono text-foreground">{compound.unitSize} {(() => {
                    const ul = (compound.unitLabel || 'mg/mL').toLowerCase();
                    if (ul.includes('ml vial')) return 'mL';
                    if (ul.includes('iu')) return 'IU';
                    if (ul.includes('mg/ml')) return 'mg/mL';
                    return 'mg';
                  })()}</span>
                </div>
              )}
              {!isOil && (
                <div>
                  <span className="text-muted-foreground">Contents:</span>{' '}
                  <span className="font-mono text-foreground">{compound.unitSize} {compound.unitLabel || 'caps'}/{getCompoundContainerKind(compound)}</span>
                </div>
              )}
              {!isOil && compound.weightPerUnit && compound.weightPerUnit > 0 && (
                <div>
                  <span className="text-muted-foreground">Per {(compound.unitLabel || 'cap').replace(/s$/, '')}:</span>{' '}
                  <span className="font-mono text-foreground">{(() => {
                    const su = compound.weightUnit || 'mg';
                    const wpu = compound.weightPerUnit!;
                    if (su === 'mcg') return `${Math.round(wpu * 1000)}mcg`;
                    if (su === 'g') { const gv = wpu / 1000; return `${gv % 1 === 0 ? gv : gv.toFixed(2).replace(/\.?0+$/, '')}g`; }
                    if (su === 'oz') return `${(wpu / 28349.5).toFixed(3).replace(/\.?0+$/, '')}oz`;
                    if (su === 'lb') return `${(wpu / 453592).toFixed(4).replace(/\.?0+$/, '')}lb`;
                    return `${wpu}mg`;
                  })()}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Dose:</span>{' '}
                <span className="font-mono text-foreground">
                  {(() => {
                    // For non-oil compounds with weight per unit, show both weight and unit count
                    if (!isOil && compound.weightPerUnit && compound.weightPerUnit > 0) {
                      const doseLabel = compound.doseLabel.toLowerCase();
                    // Helper: display weight in user's chosen unit
                      const wpu = compound.weightPerUnit; // always stored as mg internally
                      const su = compound.weightUnit || 'mg';
                      const formatWt = (mgVal: number) => {
                        if (su === 'mcg') return `${Math.round(mgVal * 1000)}mcg`;
                        if (su === 'g') { const gVal = mgVal / 1000; return `${gVal % 1 === 0 ? gVal : gVal.toFixed(2).replace(/\.?0+$/, '')}g`; }
                        if (su === 'oz') return `${(mgVal / 28349.5).toFixed(3).replace(/\.?0+$/, '')}oz`;
                        if (su === 'lb') return `${(mgVal / 453592).toFixed(4).replace(/\.?0+$/, '')}lb`;
                        // mg — always show as mg (user explicitly chose mg)
                        return `${mgVal}mg`;
                      };
                      // If dose is in pills/caps/tabs, show total serving weight
                      if (doseLabel.includes('pill') || doseLabel.includes('cap') || doseLabel.includes('tab') || doseLabel.includes('softgel') || doseLabel.includes('serving')) {
                        const totalMg = compound.dosePerUse * wpu;
                        return `${formatWt(totalMg)} (${compound.dosePerUse} ${compound.doseLabel})`;
                      }
                      // If dose is in mg/mcg/g, show how many units that is
                      if (doseLabel.includes('mg') || doseLabel.includes('mcg') || doseLabel === 'g') {
                        let doseMg = compound.dosePerUse;
                        if (doseLabel.includes('mcg')) doseMg = compound.dosePerUse / 1000;
                        else if (doseLabel === 'g') doseMg = compound.dosePerUse * 1000;
                        const pillCount = Math.round((doseMg / wpu) * 10) / 10;
                        const unitSingular = (compound.unitLabel || 'cap').replace(/s$/, '');
                        return `${compound.dosePerUse} ${compound.doseLabel} (${pillCount} ${pillCount !== 1 ? compound.unitLabel || 'caps' : unitSingular})`;
                      }
                    }
                    if (!isOil || doseUnit === 'mg') return `${compound.dosePerUse} ${compound.doseLabel}`;
                    if (doseUnit === 'ml') {
                      const concMgPerMl = compound.unitSize;
                      if (concMgPerMl > 0) {
                        const ml = Math.round((compound.dosePerUse / concMgPerMl) * 1000) / 1000;
                        return `${ml} mL`;
                      }
                      return `${compound.dosePerUse} ${compound.doseLabel}`;
                    }
                    const storedIsIu = compound.doseLabel.toLowerCase().includes('iu');
                    if (storedIsIu) return `${compound.dosePerUse} ${compound.doseLabel}`;
                    const iu = compound.unitSize > 0
                      ? Math.round((compound.dosePerUse / compound.unitSize) * 200 * 100) / 100
                      : compound.dosePerUse;
                    return `${iu} IU`;
                  })()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Reorder Qty:</span>{' '}
                <span className="font-mono text-foreground">{compound.reorderQuantity} {compound.reorderType === 'kit' ? 'kit' : getCompoundContainerKind(compound)}{compound.reorderQuantity !== 1 ? 's' : ''}</span>
              </div>
              {compound.purchaseDate && (
                <div>
                  <span className="text-muted-foreground">Purchased:</span>{' '}
                  <span className="font-mono text-foreground">{compound.purchaseDate}</span>
                </div>
              )}
              {!compoundIsPaused && !compound.notes?.includes('[DORMANT]') && (
              <div>
                <span className="text-muted-foreground">Reorder by:</span>{' '}
                <span className="font-mono text-accent">{reorderDate}</span>
              </div>
              )}
            </div>
          )}

          {/* Custom field values display */}
          {customFields.length > 0 && Array.from(customFieldValues.entries()).filter(([,v]) => v).length > 0 && (
            <div className="grid grid-cols-2 gap-x-3 text-[10px] mt-1">
              {customFields.map(f => {
                const val = customFieldValues.get(f.id);
                if (!val) return null;
                return (
                  <div key={f.id}>
                    <span className="text-muted-foreground">{f.field_name}:</span>{' '}
                    <span className="font-mono text-foreground">{val}{f.field_unit ? ` ${f.field_unit}` : ''}</span>
                  </div>
                );
              })}
            </div>
          )}

          {(compound.cycleOnDays && compound.cycleOnDays > 0 && compound.cycleOffDays && compound.cycleOffDays > 0) ? (
            <p className="text-[10px] text-accent mt-1.5 italic flex items-center gap-1">
              <RefreshCcw className="w-3 h-3" /> {compound.cycleOnDays} days on / {compound.cycleOffDays} days off{compound.cyclingNote && !compound.cyclingNote.match(/^\d+\s*days?\s*(on|off)/i) ? ` (${compound.cyclingNote})` : ''}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};

// --- Inline Quantity Editor ---

const hapticTap = (ms = 10) => {
  try { navigator?.vibrate?.(ms); } catch {}
};

const InlineQuantityEditor = ({ compound, status, isOil, isPeptide, onUpdate }: {
  compound: Compound; status: string; isOil: boolean; isPeptide: boolean;
  onUpdate: (id: string, updates: Partial<Compound>) => void;
}) => {
  const [inlineEditing, setInlineEditing] = useState(false);
  const [inlineValue, setInlineValue] = useState(compound.currentQuantity.toString());
  const [justSaved, setJustSaved] = useState(false);

  const label = isPeptide ? 'Vials' : 'On Hand';

  // Effective quantity = currentQuantity minus actual consumed (compliance-aware)
  const { getEffectiveQtyAdjusted, getConsumedAdjusted, getComplianceInfo } = useCompliance();
  const effectiveQty = getEffectiveQtyAdjusted(compound);
  const consumedUnits = consumedToContainerUnits(compound, getConsumedAdjusted(compound));
  const hasDepletion = compound.purchaseDate ? true : consumedUnits > 0.005;

  const formatQty = (qty: number) => {
    if (isPeptide) return `${Math.round(qty * 100) / 100}`;
    if (isOil) return `${Math.round(qty * 100) / 100} vial${qty !== 1 ? 's' : ''} (${compound.vialSizeMl || 10}mL)`;
    const container = getCompoundContainerKind(compound);
    return `${Math.round(qty * 100) / 100} ${container}${qty !== 1 ? 's' : ''}`;
  };

  const isFrozenForDisplay = isPaused(compound) || (compound.notes || '').includes('[DORMANT]');
  const displayValue = formatQty(isFrozenForDisplay ? compound.currentQuantity : effectiveQty);

  const saveInline = () => {
    const val = parseFloat(inlineValue);
    if (!isNaN(val) && val >= 0) {
      // When user manually sets quantity, treat it as "as of today" by resetting
      // complianceDoseOffset to current checked doses so past consumption is zeroed out,
      // and setting purchaseDate to today so theoretical pre-tracking is also zeroed.
      const ci = getComplianceInfo(compound.id);
      onUpdate(compound.id, {
        currentQuantity: val,
        purchaseDate: new Date().toISOString().split('T')[0],
        complianceDoseOffset: ci?.checkedDoses || 0,
      });
      hapticTap(15);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 600);
    }
    setInlineEditing(false);
  };

  const stepValue = (delta: number) => {
    hapticTap(6);
    const v = Math.max(0, parseFloat(inlineValue) + delta);
    setInlineValue(v.toString());
  };

  if (inlineEditing) {
    return (
      <div className="flex items-center gap-1 animate-scale-in">
        <span className="text-muted-foreground text-[10px]">{label}:</span>
        <button
          onClick={() => stepValue(-1)}
          className="w-5 h-5 rounded bg-secondary text-foreground text-xs flex items-center justify-center active:scale-90 active:bg-secondary/60 transition-transform duration-100"
        >−</button>
        <input
          type="number"
          value={inlineValue}
          onChange={e => setInlineValue(e.target.value)}
          onBlur={saveInline}
          onKeyDown={e => e.key === 'Enter' && saveInline()}
          autoFocus
          className="w-12 bg-secondary border border-primary/30 rounded px-1 py-0.5 text-foreground font-mono text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors duration-150"
        />
        <button
          onClick={() => stepValue(1)}
          className="w-5 h-5 rounded bg-secondary text-foreground text-xs flex items-center justify-center active:scale-90 active:bg-secondary/60 transition-transform duration-100"
        >+</button>
        <button onClick={saveInline} className="p-0.5 text-primary active:scale-90 transition-transform duration-100">
          <Check className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // For paused/dormant compounds, freeze depletion — no consumption
  const isFrozen = isPaused(compound) || (compound.notes || '').includes('[DORMANT]');

  // Calculate units remaining for depletion bar
  const totalUnitsInStock = compound.currentQuantity * compound.unitSize;
  const effectiveUnitsRemaining = isFrozen ? totalUnitsInStock : effectiveQty * compound.unitSize;
  const pctRemaining = totalUnitsInStock > 0 ? Math.max(0, Math.min(100, (effectiveUnitsRemaining / totalUnitsInStock) * 100)) : 100;
  const unitsConsumed = Math.round((totalUnitsInStock - effectiveUnitsRemaining) * 10) / 10;
  const unitsLeft = Math.round(effectiveUnitsRemaining * 10) / 10;

  // Determine unit label for display
  const unitDisplayLabel = (() => {
    if (isPeptide) return compound.bacstatPerVial ? 'IU' : 'doses';
    if (isOil) return 'mL';
    const ul = (compound.unitLabel || 'caps').toLowerCase();
    if (ul.includes('pill')) return 'pills';
    if (ul.includes('cap')) return 'caps';
    if (ul.includes('tab')) return 'tabs';
    if (ul.includes('softgel')) return 'softgels';
    if (ul.includes('scoop')) return 'scoops';
    if (ul.includes('serving')) return 'servings';
    return ul;
  })();

  // For peptides/oils, calculate supply in dose units
  const supplyInDoseUnits = (() => {
    if (isPeptide && compound.bacstatPerVial) {
      return { total: compound.currentQuantity * compound.bacstatPerVial, remaining: effectiveQty * compound.bacstatPerVial };
    }
    if (isOil && compound.vialSizeMl) {
      return { total: compound.currentQuantity * compound.unitSize * compound.vialSizeMl, remaining: effectiveQty * compound.unitSize * compound.vialSizeMl };
    }
    return { total: totalUnitsInStock, remaining: effectiveUnitsRemaining };
  })();

  const supplyPct = supplyInDoseUnits.total > 0 ? Math.max(0, Math.min(100, (supplyInDoseUnits.remaining / supplyInDoseUnits.total) * 100)) : 100;
  const barColor = supplyPct > 50 ? 'bg-status-good' : supplyPct > 20 ? 'bg-status-warning' : 'bg-destructive';

  return (
    <div className="col-span-2 space-y-1">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-muted-foreground text-[10px]">{label}:</span>{' '}
          <button
            onClick={() => { hapticTap(8); setInlineValue(compound.currentQuantity.toString()); setInlineEditing(true); }}
            className={`font-mono text-[10px] text-foreground underline decoration-dotted underline-offset-2 cursor-pointer hover:text-primary transition-all duration-150 ${justSaved ? 'text-primary scale-110' : ''} ${status === 'critical' ? 'animate-pulse text-status-critical' : status === 'warning' ? 'text-status-warning' : ''}`}
            title={hasDepletion ? `Purchased ${compound.currentQuantity} — ~${Math.round(consumedUnits * 100) / 100} consumed since ${compound.purchaseDate}. Tap to set current stock.` : 'Tap to edit quantity'}
          >
            {displayValue}
          </button>
          {hasDepletion && !isFrozen && (
            <span className="text-[9px] text-muted-foreground/60 ml-1">
              (of {compound.currentQuantity} purchased)
            </span>
          )}
        </div>
      </div>
      {/* Supply depletion bar */}
      {(hasDepletion || isPeptide || isOil) && (
        <div className="space-y-0.5">
          <div className="relative h-2 rounded-full overflow-hidden bg-muted/50 border border-border/30">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${supplyPct}%`, opacity: 0.7 }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
            <span>
              {Math.round(supplyInDoseUnits.remaining)} of {Math.round(supplyInDoseUnits.total)} {unitDisplayLabel} left
            </span>
            <span className={supplyPct > 50 ? 'text-status-good' : supplyPct > 20 ? 'text-status-warning' : 'text-status-critical'}>
              {Math.round(supplyPct)}%
            </span>
          </div>
        </div>
      )}
      {/* Supply Forecast */}
      {(() => {
        const { getDaysRemainingAdjusted: getDaysAdj, getEffectiveDailyAdjusted: getDailyAdj } = useCompliance();
        const daysLeft = getDaysAdj(compound);
        const dailyRate = getDailyAdj(compound);
        if (daysLeft <= 0 || daysLeft >= 999 || dailyRate <= 0) return null;

        const now = new Date();
        const runOutDate = new Date(now);
        runOutDate.setDate(runOutDate.getDate() + daysLeft);
        const runOutStr = runOutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: runOutDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });

        // Reorder lead time: order ~14 days before run-out
        const reorderLeadDays = 14;
        const reorderDaysFromNow = Math.max(0, daysLeft - reorderLeadDays);
        const reorderDate = new Date(now);
        reorderDate.setDate(reorderDate.getDate() + reorderDaysFromNow);
        const reorderStr = reorderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: reorderDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });

        const urgency = daysLeft <= 14 ? 'text-status-critical' : daysLeft <= 30 ? 'text-status-warning' : 'text-muted-foreground';

        return (
          <div className="flex items-center gap-2 text-[9px] font-mono mt-0.5">
            <TrendingDown className={`w-2.5 h-2.5 flex-shrink-0 ${urgency}`} />
            <span className={urgency}>
              Runs out <span className="font-semibold">{runOutStr}</span>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground">
              Reorder by <span className="font-semibold text-accent">{reorderStr}</span>
            </span>
          </div>
        );
      })()}
    </div>
  );
};

// --- Edit Row ---

const EditRow = ({ label, value, onChange, type, prefix, suffix }: {
  label: string; value: string; onChange: (v: string) => void; type: string; prefix?: string; suffix?: string;
}) => (
  <div className="flex items-center gap-2 text-[11px]">
    <span className="text-muted-foreground w-16 flex-shrink-0">{label}</span>
    <div className="flex items-center gap-1 flex-1">
      {prefix && <span className="text-muted-foreground">{prefix}</span>}
      {type === 'date' ? (
        <DatePickerInput
          value={value}
          onChange={onChange}
          className="text-[11px] py-1"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-secondary border border-border/50 rounded px-2 py-1 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      )}
      {suffix && <span className="text-muted-foreground text-[10px] whitespace-nowrap">{suffix}</span>}
    </div>
  </div>
);

export default InventoryView;
