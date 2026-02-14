import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserProtocol, SUGGESTED_PROTOCOLS } from '@/hooks/useProtocols';
import { Compound } from '@/data/compounds';
import { Plus, Trash2, ChevronRight, ArrowLeft, Check, X, Sparkles } from 'lucide-react';

interface ProtocolManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  protocols: UserProtocol[];
  compounds: Compound[];
  onCreateProtocol: (name: string, icon: string, description?: string) => Promise<any>;
  onDeleteProtocol: (id: string) => Promise<void>;
  onAddCompound: (protocolId: string, compoundId: string) => Promise<void>;
  onRemoveCompound: (protocolId: string, compoundId: string) => Promise<void>;
}

type View = 'list' | 'create' | 'detail' | 'assign';

const ProtocolManagerDialog = ({
  open,
  onOpenChange,
  protocols,
  compounds,
  onCreateProtocol,
  onDeleteProtocol,
  onAddCompound,
  onRemoveCompound,
}: ProtocolManagerDialogProps) => {
  const [view, setView] = useState<View>('list');
  const [selectedProtocol, setSelectedProtocol] = useState<UserProtocol | null>(null);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('💊');
  const [newDesc, setNewDesc] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleClose = (o: boolean) => {
    if (!o) {
      setView('list');
      setSelectedProtocol(null);
      setNewName('');
      setNewIcon('💊');
      setNewDesc('');
      setConfirmDelete(null);
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
    setView('detail');
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
                <span>{selectedProtocol.icon} {selectedProtocol.name}</span>
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
                          <span className="text-lg">{p.icon}</span>
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
                        <span className="text-base">{s.icon}</span>
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

              <button
                onClick={() => setView('assign')}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-primary text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Compounds
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProtocolManagerDialog;
