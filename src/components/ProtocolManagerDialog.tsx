import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserProtocol, SUGGESTED_PROTOCOLS, UserGoalSummary } from '@/hooks/useProtocols';
import { Compound } from '@/data/compounds';
import { Plus, Trash2, ChevronRight, ArrowLeft, Check, X, Sparkles, Pencil, Copy, StickyNote, Target } from 'lucide-react';
import ProtocolIcon from '@/components/ProtocolIcon';

interface ProtocolManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  protocols: UserProtocol[];
  compounds: Compound[];
  onCreateProtocol: (name: string, icon: string, description?: string) => Promise<any>;
  onDeleteProtocol: (id: string) => Promise<void>;
  onCloneProtocol: (id: string) => Promise<any>;
  onUpdateProtocol: (id: string, updates: { name?: string; icon?: string; description?: string; notes?: string }) => Promise<void>;
  onAddCompound: (protocolId: string, compoundId: string) => Promise<void>;
  onRemoveCompound: (protocolId: string, compoundId: string) => Promise<void>;
  onUpdateCompound?: (id: string, updates: Partial<Compound>) => void;
  goals?: UserGoalSummary[];
  protocolGoalLinks?: Map<string, string[]>;
  onLinkGoal?: (protocolId: string, goalId: string) => Promise<void>;
  onUnlinkGoal?: (protocolId: string, goalId: string) => Promise<void>;
}

type View = 'list' | 'create' | 'detail' | 'assign' | 'bulk-edit' | 'link-goals';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseDaysFromNote(note: string, daysPerWeek: number): Set<number> {
  const lower = note.toLowerCase();
  const days = new Set<number>();
  const patterns: [RegExp, number[]][] = [
    [/\bm[\/-]f\b|mon[\s-]*fri/i, [1,2,3,4,5]],
    [/\bm\/w\/f\b/i, [1,3,5]],
    [/\bt\/th\b/i, [2,4]],
  ];
  for (const [pat, idxs] of patterns) {
    if (pat.test(lower)) { idxs.forEach(i => days.add(i)); return days; }
  }
  const dayMap: Record<string, number> = { su: 0, sun: 0, mo: 1, mon: 1, tu: 2, tue: 2, tues: 2, we: 3, wed: 3, th: 4, thu: 4, thurs: 4, fr: 5, fri: 5, sa: 6, sat: 6 };
  const matches = lower.match(/\b(su(?:n(?:day)?)?|mo(?:n(?:day)?)?|tu(?:e(?:s(?:day)?)?)?|we(?:d(?:nesday)?)?|th(?:u(?:rs(?:day)?)?)?|fr(?:i(?:day)?)?|sa(?:t(?:urday)?)?)\b/gi);
  if (matches) matches.forEach(m => { const i = dayMap[m.toLowerCase()]; if (i !== undefined) days.add(i); });
  if (days.size === 0 && (/\bdaily\b|\bnightly\b|\bevery\s*day\b/i.test(lower) || daysPerWeek === 7)) {
    [0,1,2,3,4,5,6].forEach(i => days.add(i));
  }
  return days;
}

function buildDayString(days: Set<number>): string {
  if (days.size === 7) return 'daily';
  if (days.size === 0) return '';
  const sorted = Array.from(days).sort();
  if (sorted.join(',') === '1,2,3,4,5') return 'M-F';
  if (sorted.join(',') === '1,3,5') return 'M/W/F';
  if (sorted.join(',') === '2,4') return 'T/Th';
  return sorted.map(d => DAY_KEYS[d]).join('/');
}

const ProtocolManagerDialog = ({
  open,
  onOpenChange,
  protocols,
  compounds,
  onCreateProtocol,
  onDeleteProtocol,
  onCloneProtocol,
  onUpdateProtocol,
  onAddCompound,
  onRemoveCompound,
  onUpdateCompound,
  goals = [],
  protocolGoalLinks = new Map(),
  onLinkGoal,
  onUnlinkGoal,
}: ProtocolManagerDialogProps) => {
  const [view, setView] = useState<View>('list');
  const [selectedProtocol, setSelectedProtocol] = useState<UserProtocol | null>(null);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('💊');
  const [newDesc, setNewDesc] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Bulk edit state
  const [bulkTiming, setBulkTiming] = useState<Set<string>>(new Set());
  const [bulkDays, setBulkDays] = useState<Set<number>>(new Set());
  const [bulkApplied, setBulkApplied] = useState(false);

  // Notes state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');

  const handleClose = (o: boolean) => {
    if (!o) {
      setView('list');
      setSelectedProtocol(null);
      setNewName('');
      setNewIcon('💊');
      setNewDesc('');
      setConfirmDelete(null);
      setBulkApplied(false);
      setEditingNotes(false);
    }
    onOpenChange(o);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreateProtocol(newName.trim(), newIcon, newDesc.trim() || undefined);
    setNewName('');
    setNewIcon('💊');
    setNewDesc('');
    setView('list');
  };

  const handleUseSuggestion = (s: typeof SUGGESTED_PROTOCOLS[0]) => {
    setNewName(s.name);
    setNewIcon(s.icon);
    setNewDesc(s.description);
    setView('create');
  };

  const openDetail = (p: UserProtocol) => {
    setSelectedProtocol(p);
    setNotesValue(p.notes || '');
    setEditingNotes(false);
    setView('detail');
  };

  const openBulkEdit = () => {
    setBulkTiming(new Set());
    setBulkDays(new Set());
    setBulkApplied(false);
    setView('bulk-edit');
  };

  const toggleBulkTiming = (t: string) => {
    setBulkTiming(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const toggleBulkDay = (d: number) => {
    setBulkDays(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  const applyBulkEdit = () => {
    if (!selectedProtocol || !onUpdateCompound) return;
    const hasTiming = bulkTiming.size > 0;
    const hasDays = bulkDays.size > 0;
    if (!hasTiming && !hasDays) return;

    selectedProtocol.compoundIds.forEach(cId => {
      const compound = compoundMap.get(cId);
      if (!compound) return;

      const updates: Partial<Compound> = {};

      if (hasDays) {
        const dayStr = buildDayString(bulkDays);
        // Build new timing note: keep timing keywords, replace day part
        const existingNote = compound.timingNote || '';
        // Extract timing words from existing note
        const timingWords: string[] = [];
        if (/\bmorning\b/i.test(existingNote)) timingWords.push('morning');
        if (/\bafternoon\b/i.test(existingNote)) timingWords.push('afternoon');
        if (/\bevening\b/i.test(existingNote)) timingWords.push('evening');

        // If we're also setting timing, use that instead
        const finalTimingWords = hasTiming ? Array.from(bulkTiming) : timingWords;

        const parts = [dayStr, ...finalTimingWords].filter(Boolean);
        updates.timingNote = parts.join(', ') || undefined;
        updates.daysPerWeek = bulkDays.size;
      } else if (hasTiming) {
        // Only updating timing, keep existing day info
        const existingNote = compound.timingNote || '';
        // Remove existing timing keywords
        let cleaned = existingNote
          .replace(/\b(morning|afternoon|evening|am|pm|nightly|night)\b/gi, '')
          .replace(/[,]\s*[,]/g, ',')
          .replace(/^[,\s]+|[,\s]+$/g, '')
          .trim();
        const timingStr = Array.from(bulkTiming).join(', ');
        updates.timingNote = cleaned ? `${cleaned}, ${timingStr}` : timingStr;
      }

      onUpdateCompound(cId, updates);
    });

    setBulkApplied(true);
    setTimeout(() => setBulkApplied(false), 2000);
  };

  const compoundMap = new Map(compounds.map(c => [c.id, c]));

  // Get compounds not yet in this protocol
  const availableForProtocol = selectedProtocol
    ? compounds.filter(c => !selectedProtocol.compoundIds.includes(c.id))
    : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            {view === 'list' && (
              <>
                <Sparkles className="w-4 h-4 text-primary" />
                Protocol Groups
              </>
            )}
            {view === 'create' && (
              <>
                <button onClick={() => setView('list')} className="p-1 rounded hover:bg-secondary transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                Create Protocol
              </>
            )}
            {view === 'detail' && selectedProtocol && (
              <>
                <button onClick={() => { setView('list'); setSelectedProtocol(null); }} className="p-1 rounded hover:bg-secondary transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="flex items-center gap-1.5"><ProtocolIcon icon={selectedProtocol.icon} className="w-4 h-4 text-primary" /> {selectedProtocol.name}</span>
              </>
            )}
            {view === 'assign' && selectedProtocol && (
              <>
                <button onClick={() => setView('detail')} className="p-1 rounded hover:bg-secondary transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                Add Compounds
              </>
            )}
            {view === 'link-goals' && selectedProtocol && (
              <>
                <button onClick={() => setView('detail')} className="p-1 rounded hover:bg-secondary transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                Link Goals
              </>
            )}
            {view === 'bulk-edit' && selectedProtocol && (
              <>
                <button onClick={() => setView('detail')} className="p-1 rounded hover:bg-secondary transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                Bulk Edit — <ProtocolIcon icon={selectedProtocol.icon} className="w-4 h-4 text-primary inline" /> {selectedProtocol.name}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {view === 'list' && (
            <div className="space-y-3">
              {/* Existing protocols */}
              {protocols.length > 0 && (
                <div className="space-y-1.5">
                  {protocols.map(p => (
                    <div key={p.id} className="relative">
                      {confirmDelete === p.id ? (
                        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5">
                          <span className="text-[11px] text-destructive font-medium">Delete "{p.name}"?</span>
                          <div className="flex gap-1">
                            <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 rounded text-[10px] bg-secondary text-muted-foreground">Cancel</button>
                            <button onClick={() => { onDeleteProtocol(p.id); setConfirmDelete(null); }} className="px-2 py-1 rounded text-[10px] bg-destructive text-destructive-foreground font-medium">Delete</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => openDetail(p)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50 bg-card hover:bg-secondary/50 transition-all text-left"
                        >
                          <ProtocolIcon icon={p.icon} className="w-5 h-5 text-primary" />
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-foreground">{p.name}</span>
                            <p className="text-[10px] text-muted-foreground">{p.compoundIds.length} compounds</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={e => { e.stopPropagation(); setConfirmDelete(p.id); }}
                              className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Create new */}
              <button
                onClick={() => setView('create')}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-primary text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Create New Protocol
              </button>

              {/* Suggested templates */}
              <div className="pt-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Suggested Templates
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {SUGGESTED_PROTOCOLS
                    .filter(s => !protocols.some(p => p.name === s.name))
                    .map(s => (
                      <button
                        key={s.name}
                        onClick={() => handleUseSuggestion(s)}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border/50 bg-card hover:bg-secondary/50 transition-all text-left"
                      >
                        <ProtocolIcon icon={s.icon} className="w-4 h-4 text-primary" />
                        <span className="text-[11px] font-medium text-foreground leading-tight">{s.name.replace(' Protocol', '')}</span>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          {view === 'create' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Icon</label>
                  <input
                    type="text"
                    value={newIcon}
                    onChange={e => setNewIcon(e.target.value)}
                    maxLength={4}
                    className="w-14 bg-secondary border border-border/50 rounded-lg px-2 py-2 text-center text-lg focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Heart Health Protocol"
                    className="w-full bg-secondary border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Description (optional)</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="What this protocol targets..."
                  className="w-full bg-secondary border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none h-16"
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Protocol
              </button>
            </div>
          )}

          {view === 'detail' && selectedProtocol && (
            <div className="space-y-3">
              {selectedProtocol.description && (
                <p className="text-[11px] text-muted-foreground italic">{selectedProtocol.description}</p>
              )}

              {/* Current compounds in this protocol */}
              {selectedProtocol.compoundIds.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Compounds in this protocol</p>
                  {selectedProtocol.compoundIds.map(cId => {
                    const c = compoundMap.get(cId);
                    if (!c) return null;
                    return (
                      <div key={cId} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/50 bg-card">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-foreground">{c.name}</span>
                          <p className="text-[10px] text-muted-foreground">{c.dosePerUse} {c.doseLabel} • {c.dosesPerDay}x/day • {c.daysPerWeek}d/wk</p>
                        </div>
                        <button
                          onClick={() => onRemoveCompound(selectedProtocol.id, cId)}
                          className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No compounds assigned yet.</p>
              )}

              {/* Notes / Goals */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Notes & Goals</p>
                  {!editingNotes && (
                    <button onClick={() => { setNotesValue(selectedProtocol.notes || ''); setEditingNotes(true); }} className="text-[10px] text-primary hover:underline">
                      {selectedProtocol.notes ? 'Edit' : 'Add notes'}
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={notesValue}
                      onChange={e => setNotesValue(e.target.value)}
                      placeholder="Target outcomes, progress notes, goals…"
                      className="w-full bg-secondary border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none h-20"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={async () => {
                          await onUpdateProtocol(selectedProtocol.id, { notes: notesValue || undefined });
                          setEditingNotes(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditingNotes(false)} className="px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground text-[11px]">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : selectedProtocol.notes ? (
                  <p className="text-xs text-foreground/80 whitespace-pre-wrap bg-secondary/50 rounded-lg px-3 py-2 border border-border/30">{selectedProtocol.notes}</p>
                ) : null}
              </div>

              {/* Linked Goals */}
              {goals.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Target className="w-3 h-3" /> Linked Goals
                    </p>
                    <button onClick={() => setView('link-goals')} className="text-[10px] text-primary hover:underline">
                      {(protocolGoalLinks.get(selectedProtocol.id) || []).length > 0 ? 'Manage' : 'Link goals'}
                    </button>
                  </div>
                  {(protocolGoalLinks.get(selectedProtocol.id) || []).length > 0 ? (
                    <div className="space-y-1">
                      {(protocolGoalLinks.get(selectedProtocol.id) || []).map(gId => {
                        const goal = goals.find(g => g.id === gId);
                        if (!goal) return null;
                        return (
                          <div key={gId} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-medium text-foreground">{goal.title}</span>
                              <span className="text-[10px] text-muted-foreground ml-1.5">{goal.goal_type.replace(/_/g, ' ')}</span>
                            </div>
                            {onUnlinkGoal && (
                              <button onClick={() => onUnlinkGoal(selectedProtocol.id, gId)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/60 italic">No goals linked yet</p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setView('assign')}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-primary text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Compounds
                </button>
                {onUpdateCompound && selectedProtocol.compoundIds.length > 0 && (
                  <button
                    onClick={openBulkEdit}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-accent/30 bg-accent/5 hover:bg-accent/10 transition-colors text-accent text-sm font-medium"
                  >
                    <Pencil className="w-4 h-4" />
                    Bulk Edit
                  </button>
                )}
              </div>

              {/* Clone */}
              <button
                onClick={async () => {
                  await onCloneProtocol(selectedProtocol.id);
                  setView('list');
                  setSelectedProtocol(null);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-secondary/50 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground text-xs font-medium"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicate Protocol
              </button>
            </div>
          )}

          {view === 'assign' && selectedProtocol && (
            <div className="space-y-1.5">
              {availableForProtocol.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">All your compounds are already in this protocol.</p>
              ) : (
                availableForProtocol.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onAddCompound(selectedProtocol.id, c.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50 bg-card hover:bg-secondary/50 transition-all text-left"
                  >
                    <Plus className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-foreground">{c.name}</span>
                      <p className="text-[10px] text-muted-foreground">{c.dosePerUse} {c.doseLabel}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {view === 'link-goals' && selectedProtocol && onLinkGoal && (
            <div className="space-y-1.5">
              {goals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No goals defined yet. Complete the onboarding interview to set goals.</p>
              ) : (
                goals.map(g => {
                  const linked = (protocolGoalLinks.get(selectedProtocol.id) || []).includes(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => linked ? onUnlinkGoal?.(selectedProtocol.id, g.id) : onLinkGoal(selectedProtocol.id, g.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                        linked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-card border-border/50 hover:bg-secondary/50'
                      }`}
                    >
                      {linked ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Target className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium text-foreground">{g.title}</span>
                        <p className="text-[10px] text-muted-foreground">{g.goal_type.replace(/_/g, ' ')}{g.body_area ? ` · ${g.body_area}` : ''}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {view === 'bulk-edit' && selectedProtocol && (
            <div className="space-y-4">
              <p className="text-[11px] text-muted-foreground">
                Set timing and/or days for all {selectedProtocol.compoundIds.length} compounds in this protocol. Only selected options will be applied.
              </p>

              {/* Timing */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Timing</p>
                <div className="flex gap-1.5">
                  {(['morning', 'afternoon', 'evening'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => toggleBulkTiming(t)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        bulkTiming.has(t)
                          ? 'bg-primary/15 text-primary border border-primary/30'
                          : 'bg-secondary text-muted-foreground border border-border/50'
                      }`}
                    >
                      {t === 'morning' ? 'AM' : t === 'afternoon' ? 'Mid' : 'PM'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Days */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Days of Week</p>
                <div className="flex gap-1">
                  {DAY_LABELS.map((label, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleBulkDay(idx)}
                      className={`w-9 h-9 rounded-lg text-xs font-medium transition-all ${
                        bulkDays.has(idx)
                          ? 'bg-primary/15 text-primary border border-primary/30'
                          : 'bg-secondary text-muted-foreground border border-border/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* Quick presets */}
                <div className="flex gap-1.5 mt-2">
                  {[
                    { label: 'Daily', days: [0,1,2,3,4,5,6] },
                    { label: 'M-F', days: [1,2,3,4,5] },
                    { label: 'M/W/F', days: [1,3,5] },
                    { label: 'T/Th', days: [2,4] },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => setBulkDays(new Set(preset.days))}
                      className="px-2 py-1 rounded text-[10px] font-medium bg-secondary text-muted-foreground hover:bg-secondary/80 border border-border/50 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Will apply to ({selectedProtocol.compoundIds.length} compounds)
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {selectedProtocol.compoundIds.map(cId => {
                    const c = compoundMap.get(cId);
                    if (!c) return null;
                    return (
                      <div key={cId} className="flex items-center justify-between px-3 py-1.5 rounded bg-secondary/50 text-xs">
                        <span className="text-foreground/80 truncate">{c.name}</span>
                        <span className="text-muted-foreground text-[10px]">{c.timingNote || `${c.daysPerWeek}d/wk`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Apply */}
              <button
                onClick={applyBulkEdit}
                disabled={bulkTiming.size === 0 && bulkDays.size === 0}
                className={`w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                  bulkApplied
                    ? 'bg-status-good/15 text-status-good border border-status-good/30'
                    : 'bg-primary text-primary-foreground disabled:opacity-50'
                }`}
              >
                {bulkApplied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Applied to {selectedProtocol.compoundIds.length} compounds
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Apply to All ({selectedProtocol.compoundIds.length})
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProtocolManagerDialog;
