import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import CompoundEditWizard from '@/components/CompoundEditWizard';
import { toast } from 'sonner';
import { Compound, getStatus, CompoundCategory, getEffectiveQuantity, getConsumedSinceDate, consumedToContainerUnits, getCompoundContainerKind, validateCompoundForMath, getMonthlyConsumptionCost } from '@/data/compounds';
import { getCycleStatus, getDaysRemainingWithCycling, isPaused, getReorderDateString } from '@/lib/cycling';
import { useCompliance } from '@/contexts/ComplianceContext';
import { UserProtocol } from '@/hooks/useProtocols';
import { CustomField, CustomFieldValue, PREDEFINED_FIELDS } from '@/hooks/useCustomFields';
import { Pencil, Check, X, Trash2, Plus, ChevronDown, ChevronUp, GripVertical, Syringe, Clock, SortAsc, Moon as MoonIcon, Sun, Dumbbell, RefreshCcw, Package, PlusCircle, AlertTriangle, Pause, Play, Calendar, TrendingDown, Loader2, TrendingUp, ChevronRight } from 'lucide-react';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import ArcGauge from '@/components/ArcGauge';
import DestructiveConfirmSheet from '@/components/DestructiveConfirmSheet';
import { usePageTheme } from '@/contexts/ThemeContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
  scrollToCompoundId?: string | null;
  onScrollToCompoundDone?: () => void;
  titrationInfo?: Map<string, TitrationBadgeInfo>;
}

const categoryLabels: Record<string, string> = {
  'peptide': 'Peptides', 'injectable-oil': 'Injectable Oils', 'oral': 'Oral Supplements',
  'powder': 'Powders', 'prescription': 'Prescription', 'vitamin': 'Vitamins',
  'holistic': 'Holistic', 'adaptogen': 'Adaptogens', 'nootropic': 'Nootropics',
  'essential-oil': 'Essential Oils', 'alternative-medicine': 'Alternative Medicine',
  'probiotic': 'Probiotics', 'topical': 'Topical',
};
const categoryOrder: string[] = ['peptide', 'injectable-oil', 'prescription', 'oral', 'powder', 'vitamin', 'holistic', 'adaptogen', 'nootropic', 'essential-oil', 'alternative-medicine', 'probiotic', 'topical'];

// ═══════════════════════════════════════════
// Main InventoryView — preserved logic, new visual wrapper
// ═══════════════════════════════════════════

const InventoryView = ({ compounds, onUpdateCompound, onDeleteCompound, onAddCompound, protocols = [], toleranceLevel, onToleranceChange, customFields = [], customFieldValues = new Map(), onAddCustomField, onRemoveCustomField, onReorderCustomField, onSetCustomFieldValue, scrollToCompoundId, onScrollToCompoundDone, titrationInfo }: InventoryViewProps) => {
  const { getDaysRemainingAdjusted, getEffectiveQtyAdjusted, getConsumedAdjusted, getComplianceInfo, refetchCompliance, complianceLoading } = useCompliance();

  useEffect(() => { refetchCompliance(); }, [refetchCompliance]);
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
      if (compound.depletionAction === 'pause') {
        onUpdateCompound(compound.id, { pausedAt: new Date().toISOString(), depletionAction: null });
        toast.info(`${compound.name} auto-paused (stock depleted)`);
      } else if (compound.depletionAction === 'dormant') {
        onUpdateCompound(compound.id, { notes: `[DORMANT] ${compound.notes || ''}`.trim(), depletionAction: null });
        toast.info(`${compound.name} set dormant (stock depleted)`);
      }
    });
  }, [activeCompounds, getDaysRemainingAdjusted, onUpdateCompound]);

  // Fetch cached personalized scores
  const [cachedScoresMap, setCachedScoresMap] = useState<Map<string, CompoundScores>>(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);
  const refreshCachedScores = useCallback(() => setCacheVersion(v => v + 1), []);
  useEffect(() => {
    let cancelled = false;
    const fetchCached = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase.from('personalized_score_cache').select('compound_name, scores').eq('user_id', user.id);
      if (cancelled || !data) return;
      const map = new Map<string, CompoundScores>();
      for (const row of data) {
        const s = row.scores as any;
        if (s && typeof s.bioavailability === 'number') {
          map.set(row.compound_name, { bioavailability: s.bioavailability, efficacy: s.efficacy, effectiveness: s.effectiveness, evidenceTier: s.evidenceTier || 'Mixed', confidencePct: s.confidencePct, confidenceNote: s.confidenceNote });
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
    let success = 0, failed = 0;
    for (let i = 0; i < toRefresh.length; i++) {
      const c = toRefresh[i];
      setRefreshProgress({ current: i + 1, total: toRefresh.length, name: c.name });
      try {
        const { error } = await supabase.functions.invoke('personalized-scores', {
          body: { compoundName: c.name, category: c.category, dosePerUse: c.dosePerUse || 0, dosesPerDay: c.dosesPerDay || 1, daysPerWeek: c.daysPerWeek || 7, unitLabel: c.unitLabel || '', doseLabel: c.doseLabel || '', forceRefresh: true },
        });
        if (error) throw error;
        success++;
      } catch { failed++; }
    }
    setRefreshingAll(false);
    setRefreshProgress(null);
    refreshCachedScores();
    toast[failed === 0 ? 'success' : 'warning'](`${success} refreshed${failed ? `, ${failed} failed` : ''}`);
  }, [activeCompounds, refreshCachedScores]);

  const scrollToCompound = useCallback((id: string) => {
    setHighlightId(id);
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = cardRefs.current.get(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightId(null), 2000);
      }, 100);
    });
  }, []);

  useEffect(() => {
    if (!scrollToCompoundId) return;
    const timer = setTimeout(() => { scrollToCompound(scrollToCompoundId); onScrollToCompoundDone?.(); }, 350);
    return () => clearTimeout(timer);
  }, [scrollToCompoundId, scrollToCompound, onScrollToCompoundDone]);

  const filtered = (() => {
    let base = filter === 'all' ? activeCompounds : activeCompounds.filter(c => c.category === filter);
    if (showOffOnly) base = base.filter(c => { const cs = getCycleStatus(c); return cs.hasCycle && !cs.isOn; });
    return base;
  })();
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'days') return getDaysRemainingAdjusted(a) - getDaysRemainingAdjusted(b);
    return a.name.localeCompare(b.name);
  });

  const alertCompounds = useMemo(() => {
    return activeCompounds
      .filter(c => !c.depletionAction)
      .map(c => ({ compound: c, days: getDaysRemainingAdjusted(c), status: getStatus(getDaysRemainingAdjusted(c)) }))
      .filter(a => a.status === 'critical' || a.status === 'warning')
      .sort((a, b) => a.days - b.days);
  }, [activeCompounds, getDaysRemainingAdjusted]);

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

  const buildGroups = () => {
    if (sortBy === 'days') return [{ label: 'all', items: sorted }];
    const groups: { label: string; items: Compound[] }[] = [];
    const protocolCompoundIds = new Set<string>();
    protocols.forEach(p => {
      const pItems = sorted.filter(c => p.compoundIds.includes(c.id));
      if (pItems.length > 0) { groups.push({ label: `${p.icon} ${p.name}`, items: pItems }); pItems.forEach(c => protocolCompoundIds.add(c.id)); }
    });
    categoryOrder.forEach(cat => {
      const items = sorted.filter(c => c.category === cat && !protocolCompoundIds.has(c.id));
      if (items.length > 0) groups.push({ label: categoryLabels[cat], items });
    });
    return groups;
  };
  const groups = buildGroups();
  const [dormantExpanded, setDormantExpanded] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('pg_dormant_expanded') === 'true';
  });
  const toggleDormant = () => {
    setDormantExpanded(v => {
      localStorage.setItem('pg_dormant_expanded', String(!v));
      return !v;
    });
  };

  return (
    <div className="space-y-3">
      {/* Theme Selector + Header */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--pg-text-primary)', fontFamily: "'DM Sans', sans-serif" }}>Compounds</h2>
      </div>

      {/* Stock Alert Banner */}
      {alertCompounds.length > 0 && (
        <div className="rounded-lg p-2.5 space-y-1.5" style={{ background: 'hsl(var(--destructive) / 0.08)', border: '1px solid hsl(var(--destructive) / 0.25)' }}>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--pg-crit)' }} />
            <span className="text-[11px] font-semibold" style={{ color: 'var(--pg-crit)' }}>
              {alertCompounds.length} compound{alertCompounds.length !== 1 ? 's' : ''} need attention
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {alertCompounds.map(a => (
              <button key={a.compound.id} onClick={() => scrollToCompound(a.compound.id)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono cursor-pointer transition-all hover:scale-105 active:scale-95"
                style={{
                  background: a.status === 'critical' ? 'rgba(248,113,113,0.15)' : 'rgba(251,146,60,0.15)',
                  color: a.status === 'critical' ? 'var(--pg-crit)' : 'var(--pg-warn)',
                  border: `1px solid ${a.status === 'critical' ? 'var(--pg-crit)' : 'var(--pg-warn)'}`,
                  borderColor: a.status === 'critical' ? 'rgba(248,113,113,0.3)' : 'rgba(251,146,60,0.3)',
                }}
              >
                <Package className="w-2.5 h-2.5" /> {a.compound.name} — {a.days}d
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cycling Config Health Check */}
      {incompleteCyclingCompounds.length > 0 && (
        <div className="rounded-lg p-2.5 space-y-1.5" style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.2)' }}>
          <div className="flex items-center gap-1.5">
            <RefreshCcw className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--pg-accent)' }} />
            <span className="text-[11px] font-semibold" style={{ color: 'var(--pg-accent)' }}>
              {incompleteCyclingCompounds.length} incomplete cycling config{incompleteCyclingCompounds.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {incompleteCyclingCompounds.map(c => (
              <button key={c.id} onClick={() => fixCycleConfig(c)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono cursor-pointer transition-all hover:scale-105 active:scale-95"
                style={{ background: 'rgba(56,189,248,0.1)', color: 'var(--pg-accent)', border: '1px solid rgba(56,189,248,0.2)' }}
              >
                <Check className="w-2.5 h-2.5" /> Fix {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-thin -mx-1 px-1">
          {(['all', ...categoryOrder.filter(cat => activeCompounds.some(c => c.category === cat) || dormantCompounds.some(c => c.category === cat))]).map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className="px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] sm:text-xs transition-all whitespace-nowrap touch-manipulation"
              style={{
                background: filter === cat ? 'rgba(56,189,248,0.12)' : 'var(--pg-card)',
                color: filter === cat ? 'var(--pg-accent)' : 'var(--pg-text-secondary)',
                border: `1px solid ${filter === cat ? 'rgba(56,189,248,0.3)' : 'var(--pg-card-border)'}`,
              }}
            >
              {cat === 'all' ? 'All' : (categoryLabels[cat] || cat)}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setShowOffOnly(v => !v)}
            className="px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] sm:text-xs transition-all touch-manipulation"
            style={{
              background: showOffOnly ? 'rgba(251,146,60,0.15)' : 'var(--pg-card)',
              color: showOffOnly ? 'var(--pg-warn)' : 'var(--pg-text-secondary)',
              border: `1px solid ${showOffOnly ? 'rgba(251,146,60,0.3)' : 'var(--pg-card-border)'}`,
            }}
          >
            <RefreshCcw className="w-3 h-3 inline mr-0.5" /> OFF
          </button>
          <button onClick={() => setSortBy(s => s === 'days' ? 'name' : 'days')}
            className="px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] sm:text-xs transition-all touch-manipulation"
            style={{ background: 'var(--pg-card)', color: 'var(--pg-text-secondary)', border: '1px solid var(--pg-card-border)' }}
          >
            {sortBy === 'days' ? <><Clock className="w-3 h-3 inline mr-0.5" /> Days</> : <><SortAsc className="w-3 h-3 inline mr-0.5" /> Name</>}
          </button>
        </div>
      </div>

      {/* Add button + Refresh All */}
      <div className="flex gap-2">
        {onAddCompound && (
          <button onClick={onAddCompound}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'rgba(56,189,248,0.05)', color: 'var(--pg-accent)', border: '1px dashed rgba(56,189,248,0.3)' }}
          >
            <Plus className="w-4 h-4" /> Add Compound
          </button>
        )}
        <button onClick={refreshAllScores} disabled={refreshingAll}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
          style={{ background: 'var(--pg-card)', color: 'var(--pg-text-secondary)', border: '1px solid var(--pg-card-border)' }}
        >
          {refreshingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
          {refreshingAll && refreshProgress ? <span className="truncate max-w-[120px]">{refreshProgress.current}/{refreshProgress.total} {refreshProgress.name}</span> : 'Refresh Scores'}
        </button>
      </div>

      {/* Compound Cards */}
      {groups.map(group => (
        <Collapsible key={group.label}>
          {group.label !== 'all' && (
            <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left mb-2 group">
              <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200 group-data-[state=closed]:-rotate-90" style={{ color: 'var(--pg-text-muted)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--pg-text-primary)', fontFamily: "'DM Sans', sans-serif" }}>{group.label}</h3>
              <span className="text-[10px] font-mono" style={{ color: 'var(--pg-text-muted)' }}>({group.items.length})</span>
            </CollapsibleTrigger>
          )}
          <CollapsibleContent className="animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="space-y-1">
              {group.items.map((compound, compoundIdx) => (
                <div key={compound.id}
                  ref={(el) => { if (el) cardRefs.current.set(compound.id, el); else cardRefs.current.delete(compound.id); }}
                  className={`transition-all duration-500 rounded-lg ${highlightId === compound.id ? 'ring-2 ring-offset-1' : ''}`}
                  style={highlightId === compound.id ? { '--tw-ring-color': 'var(--pg-accent)' } as any : {}}
                  {...(compoundIdx === 0 && groups.indexOf(group) === 0 ? { 'data-tour': 'compound-card' } : {})}
                >
                  <CompoundCard compound={compound} onUpdate={onUpdateCompound} onDelete={onDeleteCompound} customFields={customFields} customFieldValues={customFieldValues.get(compound.id) || new Map()} onAddCustomField={onAddCustomField} onRemoveCustomField={onRemoveCustomField} onReorderCustomField={onReorderCustomField} onSetCustomFieldValue={onSetCustomFieldValue} cachedScores={cachedScoresMap.get(compound.name)} onScoreDrawerClose={refreshCachedScores} titrationBadge={titrationInfo?.get(compound.id)} toleranceLevel={toleranceLevel} onToleranceChange={onToleranceChange} />
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}

      {/* Dormant Compounds */}
      {dormantCompounds.length > 0 && (
        <div>
          <button onClick={toggleDormant} className="flex items-center gap-1.5 w-full text-left mb-2">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${dormantExpanded ? '' : '-rotate-90'}`} style={{ color: 'var(--pg-text-muted)' }} />
            <MoonIcon className="w-3.5 h-3.5" style={{ color: 'var(--pg-text-muted)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--pg-text-muted)' }}>Dormant</h3>
            <span className="text-[10px] font-mono" style={{ color: 'var(--pg-text-muted)' }}>({dormantCompounds.length})</span>
          </button>
          {dormantExpanded && (
            <div className="space-y-1 opacity-60">
              {dormantCompounds.map(compound => (
                <CompoundCard key={compound.id} compound={compound} onUpdate={onUpdateCompound} onDelete={onDeleteCompound} customFields={customFields} customFieldValues={customFieldValues.get(compound.id) || new Map()} onAddCustomField={onAddCustomField} onRemoveCustomField={onRemoveCustomField} onReorderCustomField={onReorderCustomField} onSetCustomFieldValue={onSetCustomFieldValue} cachedScores={cachedScoresMap.get(compound.name)} onScoreDrawerClose={refreshCachedScores} isDormant />
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog open={showToleranceConfirm} onOpenChange={setShowToleranceConfirm}
        title="Confirm Tolerance Level"
        description={`Lock your dosing tolerance to "${pendingTolerance}"? This will update all pages with this tolerance level.`}
        confirmLabel="Lock It In"
        onConfirm={() => {
          if (pendingTolerance && onToleranceChange) { onToleranceChange(pendingTolerance); toast.success(`Tolerance locked to ${pendingTolerance}`); }
          setShowToleranceConfirm(false);
        }}
      />
    </div>
  );
};

// ═══════════════════════════════════════════
// CompoundCard — Collapsed Row + Expanded Tabs
// ═══════════════════════════════════════════

const CompoundCard = ({ compound, onUpdate, onDelete, customFields = [], customFieldValues = new Map(), onAddCustomField, onRemoveCustomField, onReorderCustomField, onSetCustomFieldValue, cachedScores, onScoreDrawerClose, titrationBadge, toleranceLevel, onToleranceChange, isDormant }: {
  compound: Compound; onUpdate: (id: string, updates: Partial<Compound>) => void; onDelete?: (id: string) => void;
  customFields?: CustomField[]; customFieldValues?: Map<string, string>;
  onAddCustomField?: (field: Partial<CustomField>) => Promise<CustomField | null>;
  onRemoveCustomField?: (fieldId: string) => Promise<void>;
  onReorderCustomField?: (fieldId: string, direction: 'up' | 'down') => Promise<void>;
  onSetCustomFieldValue?: (compoundId: string, fieldId: string, value: string) => Promise<void>;
  cachedScores?: CompoundScores; onScoreDrawerClose?: () => void; titrationBadge?: TitrationBadgeInfo;
  toleranceLevel?: string; onToleranceChange?: (level: ToleranceLevel) => void;
  isDormant?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'prep' | 'inventory' | 'reorder'>('overview');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [showPauseSheet, setShowPauseSheet] = useState(false);
  const [pauseDate, setPauseDate] = useState('');
  const [showDormantSheet, setShowDormantSheet] = useState(false);
  const [doseUnit, setDoseUnit] = useState<'mg' | 'ml' | 'iu'>('mg');
  const [showScoreDrawer, setShowScoreDrawer] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editState, setEditState] = useState<Record<string, string>>({});
  const [showCalculator, setShowCalculator] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'date'>('text');
  const [newFieldUnit, setNewFieldUnit] = useState('');
  const cycleStatus = getCycleStatus(compound);
  const [showCycleTimeline, setShowCycleTimeline] = useState(cycleStatus.hasCycle && !cycleStatus.isOn);

  const { getDaysRemainingAdjusted: getDaysAdj, getEffectiveQtyAdjusted: getQtyAdj, getConsumedAdjusted: getConsumedAdj, getComplianceInfo: getCI, complianceLoading: ciLoading } = useCompliance();
  const compoundIsPaused = isPaused(compound);
  const validationErrors = validateCompoundForMath(compound);
  const hasValidationErrors = validationErrors.length > 0;
  const days = hasValidationErrors ? 0 : getDaysAdj(compound);
  const status = compoundIsPaused ? 'good' as const : hasValidationErrors ? 'warning' as const : getStatus(days);
  const isPeptide = compound.category === 'peptide';
  const isOil = compound.category === 'injectable-oil';
  const reorderDate = hasValidationErrors ? '—' : getReorderDateString(compound, getCI(compound.id));

  // Urgency color
  const urgencyColor = days <= 14 ? 'var(--pg-crit)' : days <= 30 ? 'var(--pg-warn)' : 'var(--pg-good)';
  const urgencyPulse = days <= 14 && !compoundIsPaused;

  // Status dot
  const statusDotColor = compoundIsPaused ? 'var(--pg-text-muted)' :
    cycleStatus.hasCycle && cycleStatus.isOn ? 'var(--pg-good)' :
    cycleStatus.hasCycle && !cycleStatus.isOn ? 'var(--pg-warn)' :
    'var(--pg-accent)';
  const statusDotGlow = !compoundIsPaused && cycleStatus.hasCycle;

  // Compliance arc
  const compliancePct = (() => {
    const ci = getCI(compound.id);
    if (!ci || !ci.firstCheckDate) return null;
    const start = new Date(ci.firstCheckDate);
    const end = ci.lastCheckDate ? new Date(ci.lastCheckDate) : new Date();
    const trackingDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
    const expectedDoses = trackingDays * compound.dosesPerDay * (compound.daysPerWeek / 7);
    if (expectedDoses <= 0) return null;
    return Math.min(100, Math.round((ci.checkedDoses / expectedDoses) * 100));
  })();
  const arcColor = compliancePct !== null ? (compliancePct >= 85 ? 'var(--pg-good)' : compliancePct >= 70 ? 'var(--pg-warn)' : 'var(--pg-crit)') : 'var(--pg-text-muted)';

  // Inventory percentage
  const effectiveQty = getQtyAdj(compound);
  const invPct = compound.currentQuantity > 0 ? Math.max(0, Math.min(100, (effectiveQty / compound.currentQuantity) * 100)) : 0;

  // Supply dates
  const runsOutDate = (() => {
    if (days <= 0 || days >= 999) return null;
    const d = new Date(); d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  })();
  const reorderByDate = (() => {
    if (days <= 0 || days >= 999) return null;
    const d = new Date(); d.setDate(d.getDate() + Math.max(0, days - 14));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  })();

  const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  const parseDaysFromNote = (note: string): Set<number> => {
    const lower = note.toLowerCase();
    const days = new Set<number>();
    if (/\bdaily\b|\bnightl?y?\b|\bevery\s*day\b/i.test(lower)) { [0,1,2,3,4,5,6].forEach(i => days.add(i)); return days; }
    const patterns: [RegExp, number[]][] = [[/\bm[\/-]f\b|mon[\s-]*fri/i, [1,2,3,4,5]], [/\bm\/w\/f\b/i, [1,3,5]], [/\bt\/th\b/i, [2,4]], [/M\/T\/W\/Th\/F/i, [1,2,3,4,5]]];
    for (const [pat, idxs] of patterns) { if (pat.test(note)) idxs.forEach(i => days.add(i)); }
    const dayMap: Record<string, number> = { su: 0, sun: 0, mo: 1, mon: 1, tu: 2, tue: 2, tues: 2, we: 3, wed: 3, th: 4, thu: 4, thurs: 4, fr: 5, fri: 5, sa: 6, sat: 6 };
    const matches = lower.match(/\b(su(?:n(?:day)?)?|mo(?:n(?:day)?)?|tu(?:e(?:s(?:day)?)?)?|we(?:d(?:nesday)?)?|th(?:u(?:rs(?:day)?)?)?|fr(?:i(?:day)?)?|sa(?:t(?:urday)?)?)\b/gi);
    if (matches) matches.forEach(m => { const i = dayMap[m.toLowerCase()]; if (i !== undefined) days.add(i); });
    if (days.size === 0 && parseInt(editState.daysPerWeek || '0') === 7) [0,1,2,3,4,5,6].forEach(i => days.add(i));
    return days;
  };

  const parseTimingsFromNote = (note: string): Set<string> => {
    const lower = note.toLowerCase();
    const timings = new Set<string>();
    if (/\b(morning|am)\b/.test(lower)) timings.add('morning');
    if (/\b(evening|pm|nightl?y?|night)\b/.test(lower)) timings.add('evening');
    if (/\b(midday|noon)\b/.test(lower)) timings.add('midday');
    if (/\b(pre[- ]?workout)\b/.test(lower)) timings.add('pre-workout');
    if (/\b(pre[- ]?sleep|bedtime)\b/.test(lower)) timings.add('pre-sleep');
    if (/\b(with[- ]?meal|with food)\b/.test(lower)) timings.add('with-meal');
    if (/\b(fasted|empty stomach)\b/.test(lower)) timings.add('fasted');
    return timings;
  };

  const EDIT_TIMING_OPTIONS = [
    { id: 'morning', icon: '🌅', label: 'AM' },
    { id: 'evening', icon: '🌙', label: 'PM' },
    { id: 'midday', icon: '☀️', label: 'Midday' },
    { id: 'pre-workout', icon: '💪', label: 'Pre-WO' },
    { id: 'pre-sleep', icon: '😴', label: 'Pre-Sleep' },
    { id: 'with-meal', icon: '🍽️', label: 'W/ Meal' },
    { id: 'fasted', icon: '⏰', label: 'Fasted' },
  ];

  const timingIdToKeyword: Record<string, string> = {
    morning: 'morning',
    evening: 'evening',
    midday: 'midday',
    'pre-workout': 'pre-workout',
    'pre-sleep': 'pre-sleep',
    'with-meal': 'with meal',
    fasted: 'fasted',
  };

  const buildDayString = (days: Set<number>, timings?: Set<string>): string => {
    let dayPart = '';
    if (days.size === 7) dayPart = 'daily';
    else if (days.size === 0) dayPart = '';
    else {
      const sorted = Array.from(days).sort();
      if (sorted.join(',') === '1,2,3,4,5') dayPart = 'M-F';
      else if (sorted.join(',') === '1,3,5') dayPart = 'M/W/F';
      else if (sorted.join(',') === '2,4') dayPart = 'T/Th';
      else dayPart = sorted.map(d => DAY_KEYS[d]).join('/');
    }
    const timingPart = timings && timings.size > 0
      ? Array.from(timings).map(t => timingIdToKeyword[t] || t).join(', ')
      : '';
    return [dayPart, timingPart].filter(Boolean).join(' ');
  };

  // ═══ startEdit — preserved exactly ═══
  const startEdit = () => {
    const hasCycling = !!(compound.cycleOnDays && compound.cycleOnDays > 0 && compound.cycleOffDays && compound.cycleOffDays > 0);
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
    const editDoseUnit = storedUnit;
    let editDose = compound.dosePerUse;
    const timingNote = compound.timingNote || '';
    const parsedDays = (() => {
      const lower = timingNote.toLowerCase();
      if (/\bdaily\b|\bnightl?y?\b|\bevery\s*day\b/i.test(lower)) return 7;
      const dayMap: Record<string, number> = { su:0, sun:0, mo:1, mon:1, tu:2, tue:2, tues:2, we:3, wed:3, th:4, thu:4, thurs:4, fr:5, fri:5, sa:6, sat:6 };
      const pats: [RegExp, number[]][] = [[/\bm[\/-]f\b|mon[\s-]*fri/i, [1,2,3,4,5]], [/\bm\/w\/f\b/i, [1,3,5]], [/\bt\/th\b/i, [2,4]], [/M\/T\/W\/Th\/F/i, [1,2,3,4,5]]];
      const ds = new Set<number>();
      for (const [pat, idxs] of pats) { if (pat.test(timingNote)) idxs.forEach(i => ds.add(i)); }
      const matches = lower.match(/\b(su(?:n(?:day)?)?|mo(?:n(?:day)?)?|tu(?:e(?:s(?:day)?)?)?|we(?:d(?:nesday)?)?|th(?:u(?:rs(?:day)?)?)?|fr(?:i(?:day)?)?|sa(?:t(?:urday)?)?)\b/gi);
      if (matches) matches.forEach(m => { const i = dayMap[m.toLowerCase()]; if (i !== undefined) ds.add(i); });
      return ds.size > 0 ? ds.size : compound.daysPerWeek;
    })();
    const state: Record<string, string> = {
      name: compound.name, category: compound.category, timing: timingNote, daysPerWeek: parsedDays.toString(),
      currentQuantity: compound.currentQuantity.toString(), unitSize: compound.unitSize.toString(),
      dosePerUse: editDose.toString(), reorderQuantity: compound.reorderQuantity.toString(),
      reorderType: compound.reorderType || 'single', cyclingEnabled: hasCycling ? 'true' : 'false',
      cycleOnDays: (compound.cycleOnDays || 0).toString(), cycleOffDays: (compound.cycleOffDays || 0).toString(),
      cycleStartDate: compound.cycleStartDate || '', editDoseUnit, vialSizeMl: (compound.vialSizeMl || 10).toString(),
      unitLabel: compound.unitLabel,
      containerType: (() => { const ck = getCompoundContainerKind(compound); return ck === 'bag' ? 'bags' : 'bottles'; })(),
      weightPerUnit: (() => { const wpu = compound.weightPerUnit || 0; if (wpu === 0) return ''; const su = compound.weightUnit || 'mg'; if (su === 'mcg') return (wpu * 1000).toString(); if (su === 'g') return (wpu / 1000).toString(); if (su === 'oz') return (wpu / 28349.5).toFixed(4).replace(/\.?0+$/, ''); if (su === 'lb') return (wpu / 453592).toFixed(6).replace(/\.?0+$/, ''); return wpu.toString(); })(),
      strengthUnit: compound.weightUnit || (() => { const wpu = compound.weightPerUnit || 0; if (wpu === 0) return 'mg'; if (wpu < 0.1) return 'mcg'; if (wpu >= 1000 && wpu % 1000 === 0) return 'g'; return 'mg'; })(),
    };
    if (isPeptide) { state.kitPrice = (compound.kitPrice || 0).toString(); state.unitPrice = compound.unitPrice.toString(); }
    else { state.unitPrice = compound.unitPrice.toString(); }
    state.purchaseDate = compound.purchaseDate;
    state.dosesPerDay = compound.dosesPerDay.toString();
    state.solventType = compound.solventType || ''; state.solventVolume = compound.solventVolume?.toString() || '';
    state.solventUnit = compound.solventUnit || 'mL'; state.resultingConcentration = compound.resultingConcentration?.toString() || '';
    state.concentrationUnit = compound.concentrationUnit || 'mg/mL'; state.storageInstructions = compound.storageInstructions || '';
    state.prepNotes = compound.prepNotes || '';
    setEditState(state);
    setEditSheetOpen(true);
  };

  // ═══ saveEdit — preserved CHARACTER-FOR-CHARACTER ═══
  const saveEdit = () => {
    const qty = parseFloat(editState.currentQuantity);
    const size = parseFloat(editState.unitSize);
    let dose = parseFloat(editState.dosePerUse);
    const reorder = parseInt(editState.reorderQuantity);
    if (isNaN(qty) || isNaN(size) || isNaN(dose) || isNaN(reorder) || qty < 0 || size <= 0 || dose < 0 || reorder < 0) return;
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
    if (eu !== storedUnit) {
      const catIsPeptide = editState.category === 'peptide';
      const catIsOil = editState.category === 'injectable-oil';
      const reconVolIU = (compound.reconVolume || 2) * 100;
      let mgValue = dose;
      if (eu === 'iu') { if (catIsPeptide && size > 0) mgValue = (dose / reconVolIU) * size; else if (catIsOil && size > 0) mgValue = (dose / 200) * size; }
      else if (eu === 'ml') { if (catIsPeptide) mgValue = (dose * 100 / reconVolIU) * size; else if (catIsOil) mgValue = dose * size; }
      else if (eu === 'mcg') { mgValue = dose / 1000; }
      else if (eu === 'pills') { mgValue = dose; }
      dose = mgValue;
      if (storedUnit === 'iu') { if (catIsPeptide && size > 0) dose = (mgValue / size) * reconVolIU; else if (catIsOil && size > 0) dose = (mgValue / size) * 200; }
      else if (storedUnit === 'ml') { if (catIsPeptide) dose = ((mgValue / size) * reconVolIU) / 100; else if (catIsOil && size > 0) dose = mgValue / size; }
      else if (storedUnit === 'mcg') { dose = mgValue * 1000; }
      else if (storedUnit === 'pills') { dose = mgValue; }
      dose = Math.round(dose * 1000) / 1000;
    }
    const qtyChanged = qty !== compound.currentQuantity;
    if (qtyChanged && ciLoading) { toast.error('Syncing dose history — please try again in a moment.'); return; }
    const ci = qtyChanged ? getCI(compound.id) : undefined;
    const updates: Partial<Compound> = {
      name: editState.name?.trim() || compound.name,
      category: (editState.category as CompoundCategory) || compound.category,
      currentQuantity: qty, unitSize: size, dosePerUse: dose, reorderQuantity: reorder,
      reorderType: (editState.reorderType as 'single' | 'kit') || 'single',
      ...(qtyChanged ? { complianceDoseOffset: ci?.checkedDoses ?? 0, purchaseDate: new Date().toISOString().split('T')[0] } : {}),
    };
    const editIsPeptide = editState.category === 'peptide';
    const editIsOil = editState.category === 'injectable-oil';
    if (editState.unitLabel) updates.unitLabel = editState.unitLabel;
    if (editState.editDoseUnit) {
      const unitMap: Record<string, string> = { mg: 'mg', mcg: 'mcg', g: 'g', iu: 'IU', ml: 'mL', floz: 'fl oz', drops: 'drops', pills: 'pills', caps: 'caps', tabs: 'tabs', softgels: 'softgels', scoop: 'scoop', spray: 'spray', patch: 'patch', tbsp: 'tbsp', tsp: 'tsp', oz: 'oz', units: 'units' };
      updates.doseLabel = unitMap[editState.editDoseUnit] || compound.doseLabel;
    }
    const rawVal = parseFloat(editState.weightPerUnit || '');
    if (isNaN(rawVal) || rawVal <= 0) { updates.weightPerUnit = undefined; updates.weightUnit = undefined; }
    else {
      const su = editState.strengthUnit || 'mg';
      let mgVal = rawVal;
      if (su === 'mcg') mgVal = rawVal / 1000; else if (su === 'g') mgVal = rawVal * 1000; else if (su === 'oz') mgVal = rawVal * 28349.5; else if (su === 'lb') mgVal = rawVal * 453592;
      updates.weightPerUnit = mgVal; updates.weightUnit = su;
    }
    if (editIsOil) { const vialMl = parseFloat(editState.vialSizeMl || '10'); updates.vialSizeMl = isNaN(vialMl) || vialMl <= 0 ? 10 : vialMl; }
    if (editIsPeptide) {
      if (editState.reorderType === 'single') { const unit = parseFloat(editState.unitPrice || '0'); if (isNaN(unit) || unit < 0) return; updates.unitPrice = unit; updates.kitPrice = Math.round(unit * 10 * 100) / 100; }
      else { const kit = parseFloat(editState.kitPrice || '0'); if (isNaN(kit) || kit < 0) return; updates.kitPrice = kit; updates.unitPrice = Math.round((kit / 10) * 100) / 100; }
    } else { const price = parseFloat(editState.unitPrice || '0'); if (isNaN(price) || price < 0) return; updates.unitPrice = price; }
    if (!qtyChanged) { updates.purchaseDate = editState.purchaseDate || ''; }
    if (editState.cyclingEnabled === 'true') {
      const on = parseInt(editState.cycleOnDays); const off = parseInt(editState.cycleOffDays);
      if (!isNaN(on) && on > 0 && !isNaN(off) && off > 0) { updates.cycleOnDays = on; updates.cycleOffDays = off; updates.cycleStartDate = editState.cycleStartDate || compound.cycleStartDate || new Date().toISOString().split('T')[0]; }
    } else { updates.cycleOnDays = undefined; updates.cycleOffDays = undefined; updates.cycleStartDate = undefined; }
    if (editState.timing !== undefined) updates.timingNote = editState.timing.trim() || undefined;
    if (editState.daysPerWeek !== undefined) { const dpw = parseInt(editState.daysPerWeek); if (!isNaN(dpw) && dpw >= 0 && dpw <= 7) updates.daysPerWeek = dpw; }
    if (editState.dosesPerDay !== undefined) { const dpd = parseFloat(editState.dosesPerDay); if (!isNaN(dpd) && dpd > 0) updates.dosesPerDay = dpd; }
    if (editState.category === 'powder' && editState.containerType) {
      let currentNotes = compound.notes || ''; currentNotes = currentNotes.replace(/\[CONTAINER:(bag|bottle)\]/gi, '').trim();
      const tag = editState.containerType === 'bottles' ? '[CONTAINER:bottle]' : '[CONTAINER:bag]';
      updates.notes = currentNotes ? `${tag} ${currentNotes}` : tag;
    }
    updates.solventType = editState.solventType?.trim() || undefined;
    const sv = parseFloat(editState.solventVolume || ''); updates.solventVolume = isNaN(sv) || sv <= 0 ? undefined : sv;
    updates.solventUnit = editState.solventUnit || undefined;
    const rc = parseFloat(editState.resultingConcentration || ''); updates.resultingConcentration = isNaN(rc) || rc <= 0 ? undefined : rc;
    updates.concentrationUnit = editState.concentrationUnit || undefined;
    updates.storageInstructions = editState.storageInstructions?.trim() || undefined;
    updates.prepNotes = editState.prepNotes?.trim() || undefined;
    onUpdate(compound.id, updates);
    setEditSheetOpen(false);
    if (qtyChanged) { toast.success(`Stock updated. Depletion tracking reset to your new inventory of ${qty} ${compound.unitLabel || 'units'}.`); }
    else { toast.success(`${updates.name || compound.name} updated`); }
  };

  const guide = buildPrepGuide(compound);

  // Scores
  const staticScores = getCompoundScores(compound.name, compound.category);
  const scores = cachedScores || staticScores;

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'prep' as const, label: 'Prep', hidden: !guide },
    { key: 'inventory' as const, label: 'Inventory' },
    { key: 'reorder' as const, label: 'Reorder' },
  ].filter(t => !t.hidden);

  return (
    <>
      <div className="overflow-hidden transition-all" style={{ background: 'var(--pg-card)', border: '1px solid var(--pg-card-border)', borderRadius: 'var(--pg-radius)' }}>
        {/* ═══ COLLAPSED ROW ═══ */}
        <button onClick={() => setExpanded(v => !v)} className="flex items-center w-full text-left" style={{ minHeight: 52 }}>
          {/* Urgency bar */}
          <div className={`w-[3px] self-stretch rounded-l-sm flex-shrink-0 ${urgencyPulse ? 'urgency-pulse' : ''}`} style={{ background: compoundIsPaused ? 'var(--pg-text-muted)' : urgencyColor }} />

          {/* Status dot */}
          <div className="flex items-center px-2.5 py-2 flex-1 min-w-0 gap-2.5">
            <div className="flex-shrink-0 w-[7px] h-[7px] rounded-full" style={{
              background: statusDotColor,
              boxShadow: statusDotGlow ? `0 0 6px ${statusDotColor}` : 'none',
            }} />

            {/* Name + timing */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--pg-text-primary)', fontFamily: "'DM Sans', sans-serif" }}>{compound.name}</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--pg-text-muted)', fontFamily: "'DM Sans', sans-serif" }}>
                {compoundIsPaused ? `Paused${compound.pauseRestartDate ? ` → ${new Date(compound.pauseRestartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}` : compound.timingNote || `${compound.dosesPerDay}×/day · ${compound.daysPerWeek}×/wk`}
              </p>
            </div>

            {/* Days remaining */}
            {!compoundIsPaused && !hasValidationErrors && (
              <div className="flex-shrink-0 text-right mr-1">
                <span className="text-[16px] font-bold" style={{ color: urgencyColor, fontFamily: "'DM Mono', monospace" }}>{days}</span>
                <p className="text-[9px]" style={{ color: 'var(--pg-text-muted)', fontFamily: "'DM Mono', monospace" }}>d</p>
              </div>
            )}

            {/* Compliance arc */}
            {compliancePct !== null && (
              <ArcGauge pct={compliancePct} size={34} color={arcColor} className="flex-shrink-0" />
            )}

            {/* Chevron */}
            <ChevronDown className="w-[10px] h-[10px] flex-shrink-0 transition-transform duration-200" style={{ color: 'var(--pg-text-muted)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </div>
        </button>

        {/* ═══ EXPANDED STATE ═══ */}
        {expanded && (
          <div className="px-3 pb-3">
            {/* Action buttons */}
            <div className="flex items-center justify-end gap-0.5 mb-2">
              <button onClick={() => startEdit()} className="p-1.5 rounded transition-colors" style={{ color: 'var(--pg-text-secondary)' }}><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => { if (compoundIsPaused) { onUpdate(compound.id, { pausedAt: undefined, pauseRestartDate: undefined }); toast.success(`${compound.name} resumed`); } else setShowPauseSheet(true); }}
                className="p-1.5 rounded transition-colors" style={{ color: compoundIsPaused ? 'var(--pg-warn)' : 'var(--pg-text-secondary)' }}
              >
                {compoundIsPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => {
                const isDor = compound.notes?.includes('[DORMANT]');
                if (isDor) { onUpdate(compound.id, { notes: (compound.notes || '').replace('[DORMANT]', '').trim() }); }
                else setShowDormantSheet(true);
              }}
                className="p-1.5 rounded transition-colors" style={{ color: 'var(--pg-text-secondary)' }}
              ><MoonIcon className="w-3.5 h-3.5" /></button>
              {onDelete && <button onClick={() => setConfirmDeleteOpen(true)} className="p-1.5 rounded transition-colors ml-2" style={{ color: 'var(--pg-text-secondary)' }}><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>

            {/* Dormant reactivate button */}
            {isDormant && (
              <button onClick={() => { onUpdate(compound.id, { notes: (compound.notes || '').replace('[DORMANT]', '').trim() }); toast.success(`${compound.name} reactivated`); }}
                className="w-full mb-2 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(52,211,153,0.1)', color: 'var(--pg-good)', border: '1px solid rgba(52,211,153,0.2)' }}
              >Reactivate</button>
            )}

            {/* Tab bar */}
            <div className="flex border-b mb-3" style={{ borderColor: 'var(--pg-card-border)', height: 36 }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className="px-3 text-[10px] uppercase tracking-wider font-medium transition-all"
                  style={{
                    color: activeTab === t.key ? 'var(--pg-accent)' : 'var(--pg-text-muted)',
                    borderBottom: activeTab === t.key ? '2px solid var(--pg-accent)' : '2px solid transparent',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ═══ OVERVIEW TAB ═══ */}
            {activeTab === 'overview' && (
              <div className="space-y-3">
                {/* Score row */}
                {scores && (
                  <button onClick={() => setShowScoreDrawer(true)} className="grid grid-cols-4 gap-2 w-full text-left hover:opacity-80 transition-opacity active:scale-[0.98]">
                    {[
                      { label: 'Bio', value: scores.bioavailability },
                      { label: 'Eff', value: scores.efficacy },
                      { label: 'Ovr', value: scores.effectiveness },
                      { label: 'Conf', value: scores.confidencePct ?? 0 },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className="text-[9px] uppercase" style={{ color: 'var(--pg-text-muted)', fontFamily: "'DM Mono', monospace" }}>{s.label}</p>
                        <p className="text-[17px] font-bold" style={{
                          color: s.value >= 80 ? 'var(--pg-good)' : s.value >= 60 ? 'var(--pg-accent)' : s.value >= 40 ? 'var(--pg-warn)' : 'var(--pg-crit)',
                          fontFamily: "'DM Mono', monospace",
                        }}>{s.value}%</p>
                      </div>
                    ))}
                  </button>
                )}

                {/* Cycle timeline */}
                {!compoundIsPaused && cycleStatus.hasCycle && compound.cycleOnDays && compound.cycleOffDays && compound.cycleStartDate && (
                  <div>
                    <button onClick={() => setShowCycleTimeline(v => !v)} className="flex items-center gap-1 text-[10px] w-full" style={{ color: 'var(--pg-text-muted)' }}>
                      <RefreshCcw className="w-2.5 h-2.5" /><span>Cycle timeline</span>
                      {showCycleTimeline ? <ChevronUp className="w-2.5 h-2.5 ml-auto" /> : <ChevronDown className="w-2.5 h-2.5 ml-auto" />}
                    </button>
                    {showCycleTimeline && <div className="mt-1.5"><CycleTimelineBar compound={compound} /></div>}
                  </div>
                )}

                {/* Depletion action */}
                {!compoundIsPaused && !compound.notes?.includes('[DORMANT]') && (
                  <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: 'var(--pg-card)', border: '1px solid var(--pg-card-border)' }}>
                    <TrendingDown className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--pg-text-muted)' }} />
                    <span className="text-[10px] flex-1" style={{ color: 'var(--pg-text-muted)' }}>When depleted:</span>
                    <select value={compound.depletionAction || ''} onChange={e => {
                      const val = e.target.value || null;
                      onUpdate(compound.id, { depletionAction: val as 'pause' | 'dormant' | null });
                      toast.success(val === 'pause' ? `${compound.name} will auto-pause on depletion` : val === 'dormant' ? `${compound.name} will go dormant on depletion` : `${compound.name} depletion action cleared`);
                    }}
                      className="rounded px-2 py-0.5 text-[10px] cursor-pointer focus:outline-none"
                      style={{ background: 'var(--pg-card)', color: 'var(--pg-text-primary)', border: '1px solid var(--pg-card-border)' }}
                    >
                      <option value="">Continue (reorder)</option>
                      <option value="pause">Auto-pause</option>
                      <option value="dormant">Go dormant</option>
                    </select>
                  </div>
                )}

                {/* Tolerance (global) */}
                {onToleranceChange && (
                  <div className="rounded-lg px-2.5 py-2 space-y-1.5" style={{ background: 'var(--pg-card)', border: '1px solid var(--pg-card-border)' }}>
                    <div className="flex items-center gap-1">
                      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--pg-text-muted)' }}>Protocol Grading Tolerance (global)</p>
                      <InfoTooltip text="Affects AI protocol grading for all compounds." />
                    </div>
                    <div className="flex gap-1">
                      {(['conservative', 'moderate', 'performance'] as const).map(level => (
                        <button key={level} onClick={() => onToleranceChange(level as ToleranceLevel)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all capitalize"
                          style={{
                            background: toleranceLevel === level ? 'var(--pg-accent)' : 'var(--pg-card)',
                            color: toleranceLevel === level ? '#fff' : 'var(--pg-text-secondary)',
                            border: `1px solid ${toleranceLevel === level ? 'var(--pg-accent)' : 'var(--pg-card-border)'}`,
                          }}
                        >{level}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Paused info */}
                {compoundIsPaused && (
                  <div className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}>
                    <p className="text-[10px]" style={{ color: 'var(--pg-warn)' }}>
                      Paused{compound.pauseRestartDate ? ` → resumes ${new Date(compound.pauseRestartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' (manual resume)'}
                    </p>
                  </div>
                )}

                {/* Titration badge */}
                {titrationBadge && titrationBadge.status === 'active' && (
                  <div className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-full" style={{ background: 'rgba(56,189,248,0.08)', color: 'var(--pg-accent)', border: '1px solid rgba(56,189,248,0.2)' }}>
                    <TrendingUp className="w-2.5 h-2.5" /> Titration: Step {titrationBadge.currentStep}/{titrationBadge.totalSteps} — {titrationBadge.currentDose} {titrationBadge.doseUnit}
                  </div>
                )}
              </div>
            )}

            {/* ═══ PREP TAB ═══ */}
            {activeTab === 'prep' && guide && (
              <div className="space-y-2" style={{ color: 'var(--pg-text-secondary)' }}>
                {guide.solventVolume > 0 && <p className="text-[11px]"><span style={{ color: 'var(--pg-text-muted)' }}>Solvent:</span> {guide.solventVolume}{guide.solventUnit} {guide.solventType}</p>}
                {guide.concentration && <p className="text-[11px]"><span style={{ color: 'var(--pg-text-muted)' }}>Concentration:</span> <span className="font-mono">{guide.concentration}</span></p>}
                {guide.doseVolume && <p className="text-[11px]"><span style={{ color: 'var(--pg-text-muted)' }}>Draw volume:</span> <span className="font-mono">{guide.doseVolume}</span></p>}
                {guide.dosesPerVial && <p className="text-[11px]"><span style={{ color: 'var(--pg-text-muted)' }}>Doses/vial:</span> <span className="font-mono">{guide.dosesPerVial}</span></p>}
                {guide.prepNotes && <p className="text-[10px] leading-relaxed" style={{ color: 'var(--pg-text-muted)' }}>{guide.prepNotes}</p>}
                {guide.storageInstructions && (
                  <div className="flex items-start gap-1"><Thermometer className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--pg-text-muted)' }} />
                    <p className="text-[10px]" style={{ color: 'var(--pg-text-muted)' }}>{guide.storageInstructions}</p>
                  </div>
                )}
                <p className="text-[9px] italic" style={{ color: 'var(--pg-text-muted)' }}>Tap any row to edit in the compound form</p>
              </div>
            )}

            {/* ═══ INVENTORY TAB ═══ */}
            {activeTab === 'inventory' && (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <ArcGauge pct={invPct} size={64} color={urgencyColor} />
                  <div>
                    <p className="text-[18px] font-bold" style={{ color: 'var(--pg-text-primary)', fontFamily: "'DM Mono', monospace" }}>
                      {Math.round(effectiveQty * 100) / 100}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--pg-text-muted)' }}>
                      of {compound.currentQuantity} {isPeptide ? 'vials' : isOil ? 'vials' : getCompoundContainerKind(compound) + 's'}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--pg-card-border)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${invPct}%`, background: urgencyColor, opacity: 0.7 }} />
                </div>

                {/* Date chips */}
                <div className="flex gap-2">
                  {runsOutDate && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex-1 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-left"
                          style={{ background: 'rgba(248,113,113,0.08)', color: 'var(--pg-crit)', border: '1px solid rgba(248,113,113,0.15)' }}>
                          Runs out {runsOutDate}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="text-xs p-3 max-w-[250px]" style={{ background: 'var(--pg-card)', border: '1px solid var(--pg-card-border)', color: 'var(--pg-text-secondary)' }}>
                        Calculated from your current stock, dose, and compliance rate. Edit dose or quantity to change.
                      </PopoverContent>
                    </Popover>
                  )}
                  {reorderByDate && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex-1 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-left"
                          style={{ background: 'rgba(251,146,60,0.08)', color: 'var(--pg-warn)', border: '1px solid rgba(251,146,60,0.15)' }}>
                          Reorder by {reorderByDate}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="text-xs p-3 max-w-[250px]" style={{ background: 'var(--pg-card)', border: '1px solid var(--pg-card-border)', color: 'var(--pg-text-secondary)' }}>
                        Calculated from your current stock, dose, and compliance rate. Edit dose or quantity to change.
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {/* Calculator */}
                <button onClick={() => { setShowCalculator(v => !v); }}
                  className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-lg"
                  style={{ background: 'var(--pg-card)', color: 'var(--pg-accent)', border: '1px solid var(--pg-card-border)' }}
                >
                  <Calculator className="w-3 h-3" /> Calculator
                </button>
                <CompoundingCalculator
                  open={showCalculator}
                  onOpenChange={setShowCalculator}
                  onApply={(r: CalculatorResult) => {
                    if (r.weightPerUnit !== undefined) onUpdate(compound.id, { weightPerUnit: r.weightPerUnit, weightUnit: 'mg' });
                    if (r.concentration !== undefined) onUpdate(compound.id, { resultingConcentration: r.concentration, solventType: r.solventType, solventVolume: r.solventVolume });
                  }}
                />

                {/* Purchase date prompt */}
                {!compound.purchaseDate && !isPeptide && !isOil && (
                  <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)' }}>
                    <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--pg-accent)' }} />
                    <span className="text-[10px] flex-1" style={{ color: 'var(--pg-text-muted)' }}>Set purchase date to track pills remaining</span>
                    <DatePickerInput value="" onChange={v => { if (v) onUpdate(compound.id, { purchaseDate: v }); }}
                      max={new Date().toISOString().split('T')[0]} placeholder="Set date" className="text-[10px] py-1 w-28 bg-transparent border-0" />
                  </div>
                )}
              </div>
            )}

            {/* ═══ REORDER TAB ═══ */}
            {activeTab === 'reorder' && (
              <div className="space-y-2" style={{ color: 'var(--pg-text-secondary)' }}>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between"><span style={{ color: 'var(--pg-text-muted)' }}>Price</span><span className="font-mono">${compound.unitPrice}/{isPeptide ? 'vial' : isOil ? 'vial' : getCompoundContainerKind(compound)}</span></div>
                  {isPeptide && compound.kitPrice && <div className="flex justify-between"><span style={{ color: 'var(--pg-text-muted)' }}>Kit price</span><span className="font-mono">${compound.kitPrice}/kit (10)</span></div>}
                  <div className="flex justify-between"><span style={{ color: 'var(--pg-text-muted)' }}>Dose</span><span className="font-mono">{compound.dosePerUse} {compound.doseLabel}</span></div>
                  <div className="flex justify-between"><span style={{ color: 'var(--pg-text-muted)' }}>Reorder qty</span><span className="font-mono">{compound.reorderQuantity} {compound.reorderType === 'kit' ? 'kit' : 'unit'}{compound.reorderQuantity !== 1 ? 's' : ''}</span></div>
                  <div className="flex justify-between"><span style={{ color: 'var(--pg-text-muted)' }}>Est. monthly</span><span className="font-mono">${Math.round(getMonthlyConsumptionCost(compound, getCI(compound.id)))}</span></div>
                  {!compoundIsPaused && !compound.notes?.includes('[DORMANT]') && (
                    <div className="flex justify-between"><span style={{ color: 'var(--pg-text-muted)' }}>Reorder by</span><span className="font-mono" style={{ color: 'var(--pg-warn)' }}>{reorderDate}</span></div>
                  )}
                </div>

                {/* Custom fields */}
                {customFields.length > 0 && (
                  <div className="space-y-1 pt-2" style={{ borderTop: '1px solid var(--pg-card-border)' }}>
                    <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: 'var(--pg-text-muted)' }}>Custom Fields</p>
                    {customFields.map(f => {
                      const val = customFieldValues.get(f.id);
                      return (
                        <div key={f.id} className="flex items-center justify-between text-[10px]">
                          <span style={{ color: 'var(--pg-text-muted)' }}>{f.field_name}</span>
                          <span className="font-mono">{val || '—'}{f.field_unit ? ` ${f.field_unit}` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ EDIT FORM SHEET ═══ */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent side="bottom" className="max-h-[92vh] rounded-t-2xl flex flex-col" style={{ background: 'var(--pg-bg)', color: 'var(--pg-text-primary)' }}>
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-3"><div className="w-10 h-1 rounded-full" style={{ background: 'var(--pg-card-border)' }} /></div>
          <SheetHeader>
            <SheetTitle style={{ color: 'var(--pg-text-primary)', fontFamily: "'DM Sans', sans-serif", fontSize: 20 }}>
              {editState.name || compound.name}
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--pg-card)', color: 'var(--pg-text-secondary)', border: '1px solid var(--pg-card-border)' }}>
                {categoryLabels[editState.category || compound.category] || compound.category}
              </span>
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-4 overflow-y-auto flex-1">
            {/* Section A: Identity */}
            <SectionHeader label="Identity" />
            <EditField label="Name" value={editState.name || ''} onChange={v => setEditState(s => ({ ...s, name: v }))} placeholder="Compound name" />
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--pg-text-primary)', opacity: 0.65 }}>Category</label>
              <div className="grid grid-cols-3 gap-1">
                {categoryOrder.map(cat => (
                  <button key={cat} onClick={() => setEditState(s => ({ ...s, category: cat }))}
                    className="px-2 py-1 rounded text-[10px] font-medium transition-all"
                    style={{
                      background: editState.category === cat ? 'rgba(56,189,248,0.12)' : 'var(--pg-card)',
                      color: editState.category === cat ? 'var(--pg-accent)' : 'var(--pg-text-secondary)',
                      border: `1px solid ${editState.category === cat ? 'rgba(56,189,248,0.3)' : 'var(--pg-card-border)'}`,
                    }}
                  >{categoryLabels[cat] || cat}</button>
                ))}
              </div>
            </div>
            <EditField label="Timing note" value={editState.timing || ''} onChange={v => setEditState(s => ({ ...s, timing: v }))} placeholder="e.g. daily AM, Mon/Wed/Fri" />
            {/* Days/week — interactive Su-Sa pill picker */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--pg-text-primary)', opacity: 0.65 }}>Days / week</label>
              <div className="flex gap-1">
                {DAY_LABELS.map((lbl, idx) => {
                  const activeDaySet = parseDaysFromNote(editState.timing || '');
                  const isActive = activeDaySet.has(idx);
                  return (
                    <button key={idx} type="button"
                      onClick={() => {
                        const current = parseDaysFromNote(editState.timing || '');
                        const currentTimings = parseTimingsFromNote(editState.timing || '');
                        if (isActive) current.delete(idx); else current.add(idx);
                        const newTiming = buildDayString(current, currentTimings);
                        setEditState(s => ({ ...s, timing: newTiming, daysPerWeek: current.size.toString() }));
                      }}
                      className="flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-all"
                      style={{
                        background: isActive ? 'rgba(56,189,248,0.15)' : 'var(--pg-card)',
                        color: isActive ? 'var(--pg-accent)' : 'var(--pg-text-muted)',
                        border: `1px solid ${isActive ? 'rgba(56,189,248,0.4)' : 'var(--pg-card-border)'}`,
                      }}
                    >{lbl}</button>
                  );
                })}
              </div>
            </div>
            {/* AM/PM Timing toggles */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--pg-text-primary)', opacity: 0.65 }}>Timing</label>
              <div className="flex flex-wrap gap-1.5">
                {EDIT_TIMING_OPTIONS.map(opt => {
                  const activeTimings = parseTimingsFromNote(editState.timing || '');
                  const isSelected = activeTimings.has(opt.id);
                  return (
                    <button key={opt.id} type="button"
                      onClick={() => {
                        const currentDays = parseDaysFromNote(editState.timing || '');
                        const currentTimings = parseTimingsFromNote(editState.timing || '');
                        if (isSelected) currentTimings.delete(opt.id);
                        else currentTimings.add(opt.id);
                        const newTiming = buildDayString(currentDays, currentTimings);
                        setEditState(s => ({ ...s, timing: newTiming }));
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-medium transition-all"
                      style={{
                        background: isSelected ? 'rgba(56,189,248,0.15)' : 'var(--pg-card)',
                        color: isSelected ? 'var(--pg-accent)' : 'var(--pg-text-muted)',
                        border: `1px solid ${isSelected ? 'rgba(56,189,248,0.4)' : 'var(--pg-card-border)'}`,
                      }}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <EditField label="Doses/day" value={editState.dosesPerDay || ''} onChange={v => setEditState(s => ({ ...s, dosesPerDay: v }))} type="number" placeholder="e.g. 1" />

            {/* Section B: Supply */}
            <SectionHeader label="Supply & Container" />
            <EditField label={isPeptide ? 'Vials on hand' : 'On Hand'} value={editState.currentQuantity || ''} onChange={v => setEditState(s => ({ ...s, currentQuantity: v }))} type="number" placeholder="0" />
            <EditField label={isPeptide ? 'Per vial' : isOil ? 'Concentration (mg/mL)' : 'Per container'} value={editState.unitSize || ''} onChange={v => setEditState(s => ({ ...s, unitSize: v }))} type="number" placeholder="e.g. 100" />
            <EditField label="Unit Label" value={editState.unitLabel || ''} onChange={v => setEditState(s => ({ ...s, unitLabel: v }))} placeholder="e.g. caps, mL, servings" />
            {isOil && <EditField label="Vial Size (mL)" value={editState.vialSizeMl || ''} onChange={v => setEditState(s => ({ ...s, vialSizeMl: v }))} type="number" placeholder="10" />}
            <EditField label="Price ($)" value={editState.unitPrice || ''} onChange={v => setEditState(s => ({ ...s, unitPrice: v }))} type="number" placeholder="0.00" />
            {isPeptide && editState.reorderType === 'kit' && <EditField label="Kit Price ($)" value={editState.kitPrice || ''} onChange={v => setEditState(s => ({ ...s, kitPrice: v }))} type="number" placeholder="0.00" />}
            <EditField label="Reorder Qty" value={editState.reorderQuantity || ''} onChange={v => setEditState(s => ({ ...s, reorderQuantity: v }))} type="number" placeholder="1" />

            {/* Section C: Dosing */}
            <SectionHeader label="Dosing" />
            <EditField label="Dose" value={editState.dosePerUse || ''} onChange={v => setEditState(s => ({ ...s, dosePerUse: v }))} type="number" placeholder="e.g. 2.5" />
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--pg-text-primary)', opacity: 0.65 }}>Dose Unit</label>
              <select value={editState.editDoseUnit || 'mg'} onChange={e => setEditState(s => ({ ...s, editDoseUnit: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-[12px] font-mono"
                style={{ background: 'var(--pg-card)', color: 'var(--pg-text-primary)', border: '1px solid var(--pg-card-border)' }}
              >
                <option value="mg">mg</option>
                <option value="mcg">mcg</option>
                <option value="g">g</option>
                <option value="iu">IU</option>
                <option value="ml">mL</option>
                <option value="pills">pills/caps</option>
                <option value="scoop">scoop</option>
                <option value="drops">drops</option>
                <option value="spray">spray</option>
                <option value="patch">patch</option>
                <option value="softgels">softgels</option>
                <option value="units">units</option>
                <option value="tbsp">tbsp</option>
                <option value="tsp">tsp</option>
                <option value="oz">oz</option>
                <option value="floz">fl oz</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <EditField label="Strength/Unit" value={editState.weightPerUnit || ''} onChange={v => setEditState(s => ({ ...s, weightPerUnit: v }))} type="number" placeholder="e.g. 500" />
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--pg-text-primary)', opacity: 0.65 }}>Strength Unit</label>
                <select value={editState.strengthUnit || 'mg'} onChange={e => setEditState(s => ({ ...s, strengthUnit: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-[12px] font-mono"
                  style={{ background: 'var(--pg-card)', color: 'var(--pg-text-primary)', border: '1px solid var(--pg-card-border)' }}
                >
                  <option value="mg">mg</option>
                  <option value="mcg">mcg</option>
                  <option value="g">g</option>
                  <option value="oz">oz</option>
                  <option value="lb">lb</option>
                </select>
              </div>
            </div>

            {/* Section D: Cycling */}
            <SectionHeader label="Cycling" />
            <div className="flex items-center gap-2">
              <span className="text-[11px]" style={{ color: 'var(--pg-text-primary)', opacity: 0.65 }}>Cycling</span>
              <button onClick={() => setEditState(s => ({ ...s, cyclingEnabled: s.cyclingEnabled === 'true' ? 'false' : 'true' }))}
                className="px-3 py-1 rounded-full text-[10px] font-medium"
                style={{
                  background: editState.cyclingEnabled === 'true' ? 'rgba(52,211,153,0.12)' : 'var(--pg-card)',
                  color: editState.cyclingEnabled === 'true' ? 'var(--pg-good)' : 'var(--pg-text-muted)',
                  border: `1px solid ${editState.cyclingEnabled === 'true' ? 'rgba(52,211,153,0.3)' : 'var(--pg-card-border)'}`,
                }}
              >{editState.cyclingEnabled === 'true' ? 'ON' : 'OFF'}</button>
            </div>
            {editState.cyclingEnabled === 'true' && (
              <>
                <EditField label="ON days" value={editState.cycleOnDays || ''} onChange={v => setEditState(s => ({ ...s, cycleOnDays: v }))} type="number" />
                <EditField label="OFF days" value={editState.cycleOffDays || ''} onChange={v => setEditState(s => ({ ...s, cycleOffDays: v }))} type="number" />
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--pg-text-primary)', opacity: 0.65 }}>Cycle Start</label>
                  <DatePickerInput value={editState.cycleStartDate || ''} onChange={v => setEditState(s => ({ ...s, cycleStartDate: v }))} className="text-[11px] py-1.5" />
                </div>
              </>
            )}

            {/* Section F: Dilution (peptides) */}
            {(editState.category || compound.category) === 'peptide' && (
              <>
                <SectionHeader label="Dilution / Reconstitution" />
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--pg-text-primary)', opacity: 0.65 }}>Solvent</label>
                  <select value={editState.solventType || ''} onChange={e => setEditState(s => ({ ...s, solventType: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-[11px] font-mono"
                    style={{ background: 'var(--pg-card)', color: 'var(--pg-text-primary)', border: '1px solid var(--pg-card-border)' }}
                  >
                    <option value="">None</option>
                    <option value="Bacteriostatic Water">Bacteriostatic Water</option>
                    <option value="Sterile Water">Sterile Water</option>
                    <option value="Sterile Saline">Sterile Saline</option>
                    <option value="Acetic Acid 0.6%">Acetic Acid 0.6%</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {editState.solventType && <EditField label="Volume (mL)" value={editState.solventVolume || ''} onChange={v => setEditState(s => ({ ...s, solventVolume: v }))} type="number" />}
                <EditField label="Storage" value={editState.storageInstructions || ''} onChange={v => setEditState(s => ({ ...s, storageInstructions: v }))} />
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--pg-text-primary)', opacity: 0.65 }}>Prep Notes</label>
                  <textarea value={editState.prepNotes || ''} onChange={e => setEditState(s => ({ ...s, prepNotes: e.target.value }))}
                    rows={2} className="w-full px-3 py-2 rounded-lg text-[11px] font-mono resize-none"
                    style={{ background: 'var(--pg-card)', color: 'var(--pg-text-primary)', border: '1px solid var(--pg-card-border)' }} />
                </div>
              </>
            )}

            {/* Section G: Purchase date for non-peptide/oil */}
            {!isPeptide && !isOil && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--pg-text-primary)', opacity: 0.65 }}>Purchase Date</label>
                <DatePickerInput value={editState.purchaseDate || ''} onChange={v => setEditState(s => ({ ...s, purchaseDate: v }))} className="text-[11px] py-1.5" />
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="flex-shrink-0 flex gap-3 p-4" style={{ background: 'var(--pg-bg)', borderTop: '1px solid var(--pg-card-border)' }}>
            <button onClick={() => setEditSheetOpen(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: 'var(--pg-card)', color: 'var(--pg-text-secondary)', border: '1px solid var(--pg-card-border)' }}
            ><X className="w-4 h-4 inline mr-1" />Cancel</button>
            <button onClick={saveEdit}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--pg-accent)', color: '#fff' }}
            ><Check className="w-4 h-4 inline mr-1" />Save</button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ PAUSE SHEET ═══ */}
      <Sheet open={showPauseSheet} onOpenChange={setShowPauseSheet}>
        <SheetContent side="bottom" className="max-h-[50vh] rounded-t-2xl" style={{ background: 'var(--pg-bg)', color: 'var(--pg-text-primary)' }}>
          <SheetHeader><SheetTitle style={{ color: 'var(--pg-text-primary)' }}>Pause {compound.name}</SheetTitle></SheetHeader>
          <div className="mt-3 space-y-3">
            <p className="text-[11px]" style={{ color: 'var(--pg-text-secondary)' }}>
              Inventory depletion and cost projections will freeze. {cycleStatus.hasCycle ? 'Your current cycle will resume from where it left off.' : ''}
            </p>
            <div className="flex items-center gap-2">
              <Calendar className="w-3 h-3" style={{ color: 'var(--pg-text-muted)' }} />
              <span className="text-[10px]" style={{ color: 'var(--pg-text-muted)' }}>Restart date (optional):</span>
              <DatePickerInput value={pauseDate} onChange={setPauseDate} min={new Date().toISOString().split('T')[0]} className="flex-1 text-[11px] py-1" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => {
                onUpdate(compound.id, { pausedAt: new Date().toISOString(), pauseRestartDate: pauseDate || undefined });
                toast.success(`${compound.name} paused${pauseDate ? ` until ${new Date(pauseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}`);
                setShowPauseSheet(false); setPauseDate('');
              }}
                className="flex-1 py-2 rounded-xl text-[12px] font-semibold" style={{ background: 'rgba(251,146,60,0.15)', color: 'var(--pg-warn)' }}
              >Pause Now</button>
              <button onClick={() => { setShowPauseSheet(false); setPauseDate(''); }}
                className="px-4 py-2 rounded-xl text-[12px] font-medium" style={{ background: 'var(--pg-card)', color: 'var(--pg-text-secondary)' }}
              >Cancel</button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ DORMANT SHEET ═══ */}
      <Sheet open={showDormantSheet} onOpenChange={setShowDormantSheet}>
        <SheetContent side="bottom" className="max-h-[40vh] rounded-t-2xl" style={{ background: 'var(--pg-bg)', color: 'var(--pg-text-primary)' }}>
          <SheetHeader><SheetTitle style={{ color: 'var(--pg-text-primary)' }}>Set {compound.name} Dormant?</SheetTitle></SheetHeader>
          <div className="mt-3 space-y-3">
            <p className="text-[11px]" style={{ color: 'var(--pg-text-secondary)' }}>It will be moved to the dormant section but kept in your inventory for future use.</p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => {
                onUpdate(compound.id, { notes: `[DORMANT] ${compound.notes || ''}`.trim() });
                setShowDormantSheet(false);
              }}
                className="flex-1 py-2 rounded-xl text-[12px] font-semibold" style={{ background: 'rgba(251,146,60,0.12)', color: 'var(--pg-warn)' }}
              >Set Dormant</button>
              <button onClick={() => setShowDormantSheet(false)}
                className="px-4 py-2 rounded-xl text-[12px] font-medium" style={{ background: 'var(--pg-card)', color: 'var(--pg-text-secondary)' }}
              >Cancel</button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ DELETE CONFIRM SHEET ═══ */}
      <DestructiveConfirmSheet
        open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}
        title={`Delete ${compound.name}?`}
        body="This permanently deletes all data including dose history and order records. Cannot be undone."
        confirmLabel="Delete" requiresTyping expectedText={compound.name}
        onConfirm={() => onDelete?.(compound.id)} onCancel={() => setConfirmDeleteOpen(false)}
      />

      {/* Score Drawer */}
      {scores && (
        <CompoundScoreDrawer
          open={showScoreDrawer} onOpenChange={(open) => { setShowScoreDrawer(open); if (!open) onScoreDrawerClose?.(); }}
          compoundName={compound.name} scores={staticScores || scores} deliveryMethod={getDeliveryLabel(compound.category)}
          category={compound.category} dosePerUse={compound.dosePerUse} dosesPerDay={compound.dosesPerDay}
          daysPerWeek={compound.daysPerWeek} unitLabel={compound.unitLabel} doseLabel={compound.doseLabel}
        />
      )}
    </>
  );
};

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

const SectionHeader = ({ label }: { label: string }) => (
  <p className="text-[11px] uppercase tracking-wider font-semibold pt-3 pb-1" style={{ color: 'var(--pg-text-primary)', fontFamily: "'DM Mono', monospace", borderTop: '1px solid var(--pg-card-border)', opacity: 0.75 }}>{label}</p>
);

const EditField = ({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) => (
  <div className="space-y-1">
    <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--pg-text-primary)', opacity: 0.65 }}>{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder || `Enter ${label.toLowerCase()}`}
      className="w-full px-3 py-2 rounded-lg text-[12px] font-mono placeholder:text-[var(--pg-text-muted)] placeholder:opacity-50"
      style={{ background: 'var(--pg-card)', color: 'var(--pg-text-primary)', border: '1px solid var(--pg-card-border)' }}
    />
  </div>
);

export default InventoryView;
