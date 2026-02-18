import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Compound } from '@/data/compounds';
import { formatDistanceToNow, parseISO, isAfter, subHours, format, startOfMonth } from 'date-fns';
import { History, ArrowRight, Undo2, Loader2, Brain, Trash2, ChevronDown, ChevronUp, Search, X, Filter, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface ProtocolChange {
  id: string;
  change_date: string;
  created_at: string;
  change_type: string;
  compound_id: string | null;
  description: string;
  previous_value: string | null;
  new_value: string | null;
  user_id: string;
}

interface ProtocolChangeHistoryViewProps {
  compounds: Compound[];
  updateCompound: (id: string, updates: Partial<Compound>) => void;
  refetch: () => Promise<void>;
  userId?: string;
}

const CHANGE_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'adjust_dose', label: 'Dose' },
  { value: 'adjust_frequency', label: 'Frequency' },
  { value: 'adjust_timing', label: 'Timing' },
  { value: 'adjust_cycling', label: 'Cycling' },
  { value: 'add_compound', label: 'Added' },
  { value: 'remove_compound', label: 'Removed' },
];

const changeTypeLabel = (type: string) => {
  switch (type) {
    case 'adjust_dose': return 'Dose';
    case 'adjust_frequency': return 'Frequency';
    case 'adjust_timing': return 'Timing';
    case 'adjust_cycling': return 'Cycling';
    case 'remove_compound': return 'Removed';
    case 'add_compound': return 'Added';
    default: return type.replace(/_/g, ' ');
  }
};

const changeTypeBadge = (type: string) => {
  if (type === 'remove_compound') return 'bg-destructive/15 text-status-critical';
  if (type === 'add_compound') return 'bg-status-good/15 text-status-good';
  return 'bg-primary/10 text-primary';
};

const fieldLabel = (field: string | null | undefined) => {
  switch (field) {
    case 'dosePerUse': return 'dose per use';
    case 'dosesPerDay': return 'doses/day';
    case 'daysPerWeek': return 'days/week';
    case 'timingNote': return 'timing';
    case 'cyclingNote': return 'cycling note';
    case 'cycleOnDays': return 'cycle ON days';
    case 'cycleOffDays': return 'cycle OFF days';
    default: return field ?? 'value';
  }
};

const extractField = (description: string): string | null => {
  const match = description.match(/: (\w+) updated/);
  return match?.[1] ?? null;
};

const isRecent = (createdAt: string) =>
  isAfter(parseISO(createdAt), subHours(new Date(), 48));

export default function ProtocolChangeHistoryView({ compounds, updateCompound, refetch, userId }: ProtocolChangeHistoryViewProps) {
  const [changes, setChanges] = useState<ProtocolChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const fetchChanges = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('protocol_changes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Failed to load protocol changes:', error);
    } else {
      setChanges((data ?? []) as ProtocolChange[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchChanges(); }, [fetchChanges]);

  const handleUndo = useCallback(async (change: ProtocolChange) => {
    if (!change.compound_id || !change.previous_value) {
      toast.error('Cannot undo — no previous value recorded');
      return;
    }
    const compound = compounds.find(c => c.id === change.compound_id);
    if (!compound) {
      toast.error('Compound no longer in your protocol');
      return;
    }

    const field = extractField(change.description);
    if (!field) {
      toast.error('Cannot determine which field to revert');
      return;
    }

    setUndoing(change.id);
    try {
      const numericFields = ['dosePerUse', 'dosesPerDay', 'daysPerWeek', 'cycleOnDays', 'cycleOffDays'];
      const rawValue = change.previous_value.replace(/[^\d.]/g, '');
      const value = numericFields.includes(field) ? parseFloat(rawValue) : change.previous_value;
      updateCompound(compound.id, { [field]: value } as Partial<Compound>);

      await supabase.from('protocol_changes').insert({
        user_id: userId!,
        change_type: change.change_type,
        compound_id: compound.id,
        description: `${compound.name}: reverted ${field} (undo AI change)`,
        previous_value: change.new_value,
        new_value: change.previous_value,
      });

      await refetch();
      await fetchChanges();
      toast.success(`Reverted ${compound.name}: ${fieldLabel(field)} → ${change.previous_value}`);
    } catch (e) {
      console.error('Undo failed:', e);
      toast.error('Undo failed');
    } finally {
      setUndoing(null);
    }
  }, [compounds, updateCompound, refetch, fetchChanges, userId]);

  // Derived: unique compound names for search suggestions
  const compoundNames = useMemo(() => {
    const names = new Set<string>();
    changes.forEach(c => names.add(c.description.split(':')[0].trim()));
    return Array.from(names).sort();
  }, [changes]);

  // Filtered changes
  const filtered = useMemo(() => {
    return changes.filter(c => {
      const compoundName = c.description.split(':')[0].trim().toLowerCase();
      if (search && !compoundName.includes(search.toLowerCase())) return false;
      if (typeFilter !== 'all' && c.change_type !== typeFilter) return false;
      const changeDate = parseISO(c.created_at);
      if (dateFrom && changeDate < dateFrom) return false;
      if (dateTo) {
        const toEnd = new Date(dateTo);
        toEnd.setHours(23, 59, 59, 999);
        if (changeDate > toEnd) return false;
      }
      return true;
    });
  }, [changes, search, typeFilter, dateFrom, dateTo]);

  const hasActiveFilters = search || typeFilter !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  // --- Stats computations (must be before early returns) ---
  const stats = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    const thisMonth = changes.filter(c => parseISO(c.created_at) >= monthStart);

    const freq: Record<string, number> = {};
    changes.forEach(c => {
      const name = c.description.split(':')[0].trim();
      freq[name] = (freq[name] ?? 0) + 1;
    });
    const topCompound = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    let up = 0, down = 0;
    changes.forEach(c => {
      if (c.change_type !== 'adjust_dose') return;
      const prev = parseFloat(c.previous_value ?? '');
      const next = parseFloat(c.new_value ?? '');
      if (isNaN(prev) || isNaN(next)) return;
      if (next > prev) up++;
      else if (next < prev) down++;
    });

    const netDir = up > down ? 'up' : down > up ? 'down' : 'neutral';
    return { thisMonth: thisMonth.length, topCompound, netDir, up, down };
  }, [changes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <History className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">No AI changes yet</h3>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
          When you accept protocol changes from the AI advisor, they'll appear here with full history and undo support.
        </p>
      </div>
    );
  }

  // Group by date
  const grouped = filtered.reduce<Record<string, ProtocolChange[]>>((acc, c) => {
    const day = c.change_date ?? c.created_at.slice(0, 10);
    (acc[day] = acc[day] ?? []).push(c);
    return acc;
  }, {});


  return (
    <div className="space-y-3 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Brain className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">AI Protocol Changes</h2>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
          {filtered.length}{filtered.length !== changes.length ? `/${changes.length}` : ''}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border/40 bg-card/60 px-3 py-2.5 flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">This month</span>
          <span className="text-lg font-bold text-foreground leading-none">{stats.thisMonth}</span>
          <span className="text-[9px] text-muted-foreground">changes</span>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/60 px-3 py-2.5 flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] text-muted-foreground">Top compound</span>
          <span className="text-[11px] font-semibold text-foreground leading-tight truncate">
            {stats.topCompound ?? '—'}
          </span>
          <span className="text-[9px] text-muted-foreground">most modified</span>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/60 px-3 py-2.5 flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">Net dose</span>
          <div className="flex items-center gap-1 mt-0.5">
            {stats.netDir === 'up' && <TrendingUp className="w-4 h-4 text-status-good" />}
            {stats.netDir === 'down' && <TrendingDown className="w-4 h-4 text-status-critical" />}
            {stats.netDir === 'neutral' && <Minus className="w-4 h-4 text-muted-foreground" />}
            <span className={cn(
              'text-sm font-bold leading-none',
              stats.netDir === 'up' ? 'text-status-good' : stats.netDir === 'down' ? 'text-status-critical' : 'text-muted-foreground'
            )}>
              {stats.netDir === 'up' ? '↑' : stats.netDir === 'down' ? '↓' : '—'}
            </span>
          </div>
          <span className="text-[9px] text-muted-foreground">{stats.up}↑ {stats.down}↓</span>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search compound name…"
            className="pl-8 h-8 text-xs bg-card/60 border-border/50"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Type filter chips + date range */}
        <div className="flex gap-1.5 flex-wrap items-center">
          <Filter className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          {CHANGE_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all',
                typeFilter === t.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card/60 text-muted-foreground border-border/40 hover:border-primary/40 hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Date range pickers */}
        <div className="flex gap-2 items-center">
          <Popover open={fromOpen} onOpenChange={setFromOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('h-7 text-[10px] border-border/50 bg-card/60 font-normal', dateFrom && 'border-primary/50 text-primary')}>
                {dateFrom ? format(dateFrom, 'MMM d') : 'From date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={d => { setDateFrom(d); setFromOpen(false); }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <span className="text-[10px] text-muted-foreground">–</span>
          <Popover open={toOpen} onOpenChange={setToOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('h-7 text-[10px] border-border/50 bg-card/60 font-normal', dateTo && 'border-primary/50 text-primary')}>
                {dateTo ? format(dateTo, 'MMM d') : 'To date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={d => { setDateTo(d); setToOpen(false); }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 ml-auto transition-colors">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Search className="w-6 h-6 text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">No changes match your filters.</p>
          <button onClick={clearFilters} className="text-xs text-primary mt-1 hover:underline">Clear filters</button>
        </div>
      )}

      {/* Grouped results */}
      {Object.entries(grouped).map(([date, dayChanges]) => (
        <div key={date} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-[10px] font-mono text-muted-foreground px-2">
              {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <div className="h-px flex-1 bg-border/40" />
          </div>

          {dayChanges.map((change) => {
            const field = extractField(change.description);
            const recent = isRecent(change.created_at);
            const canUndo = recent
              && change.change_type !== 'remove_compound'
              && change.change_type !== 'add_compound'
              && !!change.previous_value
              && !!change.compound_id
              && !!field;

            const compoundName = change.description.split(':')[0].trim();
            const isExpanded = expanded === change.id;

            return (
              <div key={change.id} className="rounded-xl border border-border/40 bg-card/60 overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5">
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full mt-0.5 flex-shrink-0 ${changeTypeBadge(change.change_type)}`}>
                    {changeTypeLabel(change.change_type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{compoundName}</span>
                      {field && <span className="text-[10px] text-muted-foreground">· {fieldLabel(field)}</span>}
                      {recent && <span className="text-[9px] font-mono px-1 py-0.5 rounded-full bg-primary/10 text-primary">recent</span>}
                    </div>
                    {change.previous_value && change.new_value && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[11px] text-muted-foreground line-through opacity-70">{change.previous_value}</span>
                        <ArrowRight className="w-3 h-3 text-primary flex-shrink-0" />
                        <span className="text-[11px] text-primary font-semibold">{change.new_value}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground/60">
                        {formatDistanceToNow(parseISO(change.created_at), { addSuffix: true })}
                      </span>
                      <button
                        onClick={() => setExpanded(isExpanded ? null : change.id)}
                        className="flex items-center gap-0.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        details
                      </button>
                    </div>
                  </div>
                  {canUndo && (
                    <button
                      onClick={() => handleUndo(change)}
                      disabled={undoing === change.id}
                      className="flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-lg bg-secondary/70 text-muted-foreground hover:bg-accent/20 hover:text-status-warning border border-border/40 transition-all flex-shrink-0 disabled:opacity-40"
                      title="Revert this change"
                    >
                      {undoing === change.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Undo2 className="w-3 h-3" />
                      }
                      Undo
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-border/30 bg-secondary/20 animate-fade-in">
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
                      <span className="font-semibold text-foreground/70">Description:</span> {change.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">ID: {change.id.slice(0, 8)}…</p>
                    {!canUndo && recent && change.change_type === 'remove_compound' && (
                      <p className="text-[10px] text-status-warning mt-1.5 flex items-center gap-1">
                        <Trash2 className="w-3 h-3" />
                        Compound removal cannot be undone automatically — re-add via the + button.
                      </p>
                    )}
                    {!recent && (
                      <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                        Undo only available within 48 hours of the change.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
