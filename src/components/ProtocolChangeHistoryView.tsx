import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Compound } from '@/data/compounds';
import { formatDistanceToNow, parseISO, isAfter, subHours } from 'date-fns';
import { History, ArrowRight, Undo2, Loader2, Brain, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

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

// Extract field name from description like "BPC-157: dosePerUse updated (AI recommendation)"
const extractField = (description: string): string | null => {
  const match = description.match(/: (\w+) updated/);
  return match?.[1] ?? null;
};

// Recent = within 48 hours
const isRecent = (createdAt: string) =>
  isAfter(parseISO(createdAt), subHours(new Date(), 48));

export default function ProtocolChangeHistoryView({ compounds, updateCompound, refetch, userId }: ProtocolChangeHistoryViewProps) {
  const [changes, setChanges] = useState<ProtocolChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchChanges = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('protocol_changes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Failed to load protocol changes:', error);
    } else {
      setChanges((data ?? []) as ProtocolChange[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

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
      const rawValue = change.previous_value.replace(/[^\d.]/g, ''); // strip units
      const value = numericFields.includes(field) ? parseFloat(rawValue) : change.previous_value;
      updateCompound(compound.id, { [field]: value } as Partial<Compound>);

      // Log the undo as a new protocol change
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

  // Group by date (YYYY-MM-DD)
  const grouped = changes.reduce<Record<string, ProtocolChange[]>>((acc, c) => {
    const day = c.change_date ?? c.created_at.slice(0, 10);
    (acc[day] = acc[day] ?? []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Brain className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">AI Protocol Changes</h2>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
          {changes.length} total
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">Last 100 changes</span>
      </div>

      {Object.entries(grouped).map(([date, dayChanges]) => (
        <div key={date} className="space-y-2">
          {/* Date header */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-[10px] font-mono text-muted-foreground px-2">
              {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <div className="h-px flex-1 bg-border/40" />
          </div>

          {/* Changes for this day */}
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
              <div
                key={change.id}
                className="rounded-xl border border-border/40 bg-card/60 overflow-hidden"
              >
                {/* Main row */}
                <div className="flex items-start gap-3 px-3 py-2.5">
                  {/* Type badge */}
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full mt-0.5 flex-shrink-0 ${changeTypeBadge(change.change_type)}`}>
                    {changeTypeLabel(change.change_type)}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{compoundName}</span>
                      {field && (
                        <span className="text-[10px] text-muted-foreground">· {fieldLabel(field)}</span>
                      )}
                      {recent && (
                        <span className="text-[9px] font-mono px-1 py-0.5 rounded-full bg-primary/10 text-primary">recent</span>
                      )}
                    </div>

                    {/* Before → After */}
                    {change.previous_value && change.new_value && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[11px] text-muted-foreground line-through opacity-70">{change.previous_value}</span>
                        <ArrowRight className="w-3 h-3 text-primary flex-shrink-0" />
                        <span className="text-[11px] text-primary font-semibold">{change.new_value}</span>
                      </div>
                    )}

                    {/* Timestamp + expand */}
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

                  {/* Undo button */}
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

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-border/30 bg-secondary/20 animate-fade-in">
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
                      <span className="font-semibold text-foreground/70">Description:</span> {change.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">
                      ID: {change.id.slice(0, 8)}…
                    </p>
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
