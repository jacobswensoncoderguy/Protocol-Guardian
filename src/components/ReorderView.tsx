import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Compound, getReorderCost } from '@/data/compounds';
import { getDaysRemainingWithCycling, getEffectiveDailyConsumption } from '@/lib/cycling';
import { UserProtocol } from '@/hooks/useProtocols';
import { supabase } from '@/integrations/supabase/client';
import {
  Check, Package, PackageCheck, ShoppingCart, Undo2, Trash2, ChevronDown,
  AlertTriangle, TrendingUp, ExternalLink, ShoppingBag, Info, Calendar,
  Clock, Truck, CalendarIcon, Store,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReorderViewProps {
  compounds: Compound[];
  onUpdateCompound: (id: string, updates: Partial<Compound>) => void;
  userId?: string;
  protocols?: UserProtocol[];
  reorderHorizon?: 30 | 45 | 60;
  onHorizonChange?: (h: 30 | 45 | 60) => void;
}

interface OrderItem {
  id: string;
  compound_id: string;
  quantity: number;
  cost: number;
  status: 'needed' | 'ordered' | 'received';
  month_label: string;
  ordered_at: string | null;
  received_at: string | null;
  notes: string | null;
}

type Tab = 'needed' | 'ordered' | 'received';

const HORIZON_OPTIONS = [
  { value: 30, label: '30d' },
  { value: 45, label: '45d' },
  { value: 60, label: '60d' },
] as const;
type Horizon = 30 | 45 | 60;

function buildNeededItems(compounds: Compound[], horizon: Horizon): (Omit<OrderItem, 'id' | 'ordered_at' | 'received_at' | 'notes'>)[] {
  const now = new Date();
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const items: (Omit<OrderItem, 'id' | 'ordered_at' | 'received_at' | 'notes'>)[] = [];

  // Peptides and oils calculate burn rate from dose × frequency — no purchaseDate needed.
  // Orals/powders/vitamins still require purchaseDate to know units per bottle.
  const activeCompounds = compounds.filter(c => {
    if (c.notes?.includes('[DORMANT]') || c.currentQuantity <= 0) return false;
    const isPeptideOrOil = c.category === 'peptide' || c.category === 'injectable-oil';
    if (isPeptideOrOil) return true;
    return !!(c.purchaseDate && c.purchaseDate.trim() !== '');
  });

  activeCompounds.forEach(compound => {
    const daysLeft = getDaysRemainingWithCycling(compound);
    if (daysLeft > horizon) return;
    const cost = getReorderCost(compound);
    const reorderDate = new Date(now.getTime() + daysLeft * 24 * 60 * 60 * 1000);
    const monthLabel = `${MONTHS[reorderDate.getMonth()]} ${reorderDate.getFullYear()}`;
    items.push({ compound_id: compound.id, quantity: compound.reorderQuantity, cost, status: 'needed', month_label: monthLabel });
  });

  return items.sort((a, b) => {
    const compA = activeCompounds.find(c => c.id === a.compound_id);
    const compB = activeCompounds.find(c => c.id === b.compound_id);
    return (compA ? getDaysRemainingWithCycling(compA) : 999) - (compB ? getDaysRemainingWithCycling(compB) : 999);
  });
}

function groupByProtocol<T extends { compound_id: string }>(
  items: T[],
  protocols: UserProtocol[],
  compoundMap: Map<string, Compound>
): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  const protocolIds = new Set<string>();
  protocols.forEach(p => {
    const pItems = items.filter(item => p.compoundIds.includes(item.compound_id));
    if (pItems.length > 0) {
      groups.push({ label: `${p.icon} ${p.name}`, items: pItems });
      pItems.forEach(item => protocolIds.add(item.compound_id));
    }
  });
  const ungrouped = items.filter(item => !protocolIds.has(item.compound_id));
  if (ungrouped.length > 0) groups.push({ label: 'Other Compounds', items: ungrouped });
  return groups.length > 0 ? groups : [{ label: '', items }];
}

/** Returns avg shipping days for a compound from received orders, or null if no history */
function getAvgShippingDays(compoundId: string, receivedOrders: OrderItem[]): number | null {
  const completed = receivedOrders.filter(
    o => o.compound_id === compoundId && o.ordered_at && o.received_at
  );
  if (completed.length === 0) return null;
  const total = completed.reduce((sum, o) => {
    return sum + Math.floor(
      (new Date(o.received_at!).getTime() - new Date(o.ordered_at!).getTime()) / 86400000
    );
  }, 0);
  return Math.round(total / completed.length);
}

const ReorderView = ({ compounds, onUpdateCompound, userId, protocols = [], reorderHorizon = 30, onHorizonChange }: ReorderViewProps) => {
  const [tab, setTab] = useState<Tab>('needed');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsCompound, setDetailsCompound] = useState<Compound | null>(null);

  // Order dialog state
  const [orderDialog, setOrderDialog] = useState<{
    compoundId: string; quantity: number; cost: number; monthLabel: string;
  } | null>(null);
  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [orderNotes, setOrderNotes] = useState('');

  const horizon: Horizon = reorderHorizon;
  const compoundMap = new Map(compounds.map(c => [c.id, c]));

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setOrders(data as OrderItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const neededItems = buildNeededItems(compounds, horizon);
  const orderedItems = orders.filter(o => o.status === 'ordered');
  const receivedItems = orders.filter(o => o.status === 'received');
  const activeOrderIds = new Set(orderedItems.map(o => o.compound_id));

  const handleMarkOrdered = (compoundId: string, quantity: number, cost: number, monthLabel: string) => {
    setOrderDate(new Date());
    setOrderNotes('');
    setOrderDialog({ compoundId, quantity, cost, monthLabel });
  };

  const confirmMarkOrdered = async () => {
    if (!orderDialog) return;
    const { compoundId, quantity, cost, monthLabel } = orderDialog;
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        compound_id: compoundId,
        quantity,
        cost,
        status: 'ordered',
        month_label: monthLabel,
        ordered_at: orderDate.toISOString(),
        notes: orderNotes.trim() || null,
        user_id: userId,
      }])
      .select()
      .single();
    if (!error && data) setOrders(prev => [data as OrderItem, ...prev]);
    setOrderDialog(null);
  };

  const handleMarkReceived = async (order: OrderItem) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('orders')
      .update({ status: 'received', received_at: now })
      .eq('id', order.id);
    if (error) return;
    const compound = compoundMap.get(order.compound_id);
    if (compound) onUpdateCompound(compound.id, { currentQuantity: compound.currentQuantity + order.quantity });
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'received', received_at: now } : o));
  };

  const handleReceiveAll = async () => {
    for (const order of orderedItems) await handleMarkReceived(order);
  };

  const handleUndoReceived = async (order: OrderItem) => {
    const compound = compoundMap.get(order.compound_id);
    if (compound) onUpdateCompound(compound.id, { currentQuantity: Math.max(0, compound.currentQuantity - order.quantity) });
    const { error } = await supabase.from('orders').update({ status: 'ordered', received_at: null }).eq('id', order.id);
    if (!error) {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'ordered', received_at: null } : o));
      setTab('ordered');
    }
  };

  const handleReturnToNeeded = async (order: OrderItem) => {
    const { error } = await supabase.from('orders').delete().eq('id', order.id);
    if (!error) setOrders(prev => prev.filter(o => o.id !== order.id));
  };

  const handleDeleteOrder = async (order: OrderItem) => {
    const { error } = await supabase.from('orders').delete().eq('id', order.id);
    if (!error) setOrders(prev => prev.filter(o => o.id !== order.id));
  };

  const getDisplayQty = (compoundId: string, qty: number) => {
    const compound = compoundMap.get(compoundId);
    if (!compound) return `Reorder Qty: ${qty}`;
    if (compound.category === 'peptide') {
      if (compound.reorderType === 'single') return `Reorder Qty: ${qty} vial${qty !== 1 ? 's' : ''}`;
      return `Reorder Qty: ${qty} kit${qty !== 1 ? 's' : ''} (${qty * 10} vials)`;
    }
    if (compound.category === 'injectable-oil') return `Reorder Qty: ${qty} vial${qty !== 1 ? 's' : ''}`;
    const ul = (compound.unitLabel || '').toLowerCase();
    let containerLabel = 'bottle';
    if (ul.includes('scoop') || ul.includes('serving') || ul.includes('g') || ul === 'oz') containerLabel = 'bag';
    if (compound.reorderType === 'kit') return `Reorder Qty: ${qty} kit${qty !== 1 ? 's' : ''}`;
    return `Reorder Qty: ${qty} ${containerLabel}${qty !== 1 ? 's' : ''}`;
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'needed', label: 'Needed', icon: <ShoppingCart className="w-3.5 h-3.5" />, count: neededItems.filter(n => !activeOrderIds.has(n.compound_id)).length },
    { key: 'ordered', label: 'Ordered', icon: <Package className="w-3.5 h-3.5" />, count: orderedItems.length },
    { key: 'received', label: 'Received', icon: <PackageCheck className="w-3.5 h-3.5" />, count: receivedItems.length },
  ];

  const filteredNeeded = neededItems.filter(n => !activeOrderIds.has(n.compound_id));
  const neededGroups = groupByProtocol(filteredNeeded, protocols, compoundMap);
  const orderedGroups = groupByProtocol(orderedItems, protocols, compoundMap);
  const receivedGroups = groupByProtocol(receivedItems, protocols, compoundMap);

  const criticalCompounds = filteredNeeded
    .map(n => compoundMap.get(n.compound_id))
    .filter((c): c is Compound => !!c && getDaysRemainingWithCycling(c) <= 7);
  const warningCompounds = filteredNeeded
    .map(n => compoundMap.get(n.compound_id))
    .filter((c): c is Compound => {
      if (!c) return false;
      const d = getDaysRemainingWithCycling(c);
      return d > 7 && d <= horizon;
    });

  // Shipping analytics per compound from received orders
  const shippingByCompound = new Map<string, number>();
  const compoundIdsWithHistory = new Set(receivedItems.filter(o => o.ordered_at && o.received_at).map(o => o.compound_id));
  compoundIdsWithHistory.forEach(id => {
    const avg = getAvgShippingDays(id, receivedItems);
    if (avg !== null) shippingByCompound.set(id, avg);
  });

  return (
    <>
    <div className="space-y-3">
      {/* Inventory Alert Banner */}
      {(criticalCompounds.length > 0 || warningCompounds.length > 0) && (
        <div className="flex gap-2">
          {criticalCompounds.length > 0 && (
            <div className="flex-1 bg-destructive/10 border border-destructive/30 rounded-lg p-2.5 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-critical flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-status-critical">{criticalCompounds.length} Need Reorder</p>
                <p className="text-[10px] text-muted-foreground">Under 7 days supply</p>
              </div>
            </div>
          )}
          {warningCompounds.length > 0 && (
            <div className="flex-1 bg-accent/10 border border-accent/30 rounded-lg p-2.5 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-status-warning flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-status-warning">{warningCompounds.length} Running Low</p>
                <p className="text-[10px] text-muted-foreground">7–{horizon} days left</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Selector */}
      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 border border-border/50">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-all touch-manipulation ${
              tab === t.key
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'text-muted-foreground active:bg-secondary/60'
            }`}
          >
            {t.icon}
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Needed Tab ── */}
      {tab === 'needed' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>Reorder horizon</span>
            </div>
            <div className="flex gap-0.5 bg-secondary/50 rounded-md p-0.5 border border-border/40">
              {HORIZON_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onHorizonChange?.(opt.value)}
                  className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all touch-manipulation ${
                    horizon === opt.value
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {filteredNeeded.length === 0 ? (
            <div className="bg-card rounded-lg border border-border/50 p-6 text-center">
              <PackageCheck className="w-8 h-8 text-status-good mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All caught up! No reorders needed soon.</p>
            </div>
          ) : (
            neededGroups.map((group) => (
              <Collapsible key={group.label} defaultOpen>
                {group.label && (
                  <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left mb-2 group">
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                    <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                    <span className="text-[10px] text-muted-foreground font-mono">({group.items.length})</span>
                  </CollapsibleTrigger>
                )}
                <CollapsibleContent>
                  <div className="space-y-1.5">
                    {group.items.map((item, i) => {
                      const compound = compoundMap.get(item.compound_id);
                      const days = compound ? getDaysRemainingWithCycling(compound) : 999;
                      const status = days <= 7 ? 'critical' : days <= 30 ? 'warning' : 'good';
                      const avgShip = shippingByCompound.get(item.compound_id) ?? null;
                      return (
                        <div key={`${item.compound_id}-${i}`} className={`bg-card rounded-lg border p-3 ${
                          status === 'critical' ? 'border-destructive/40' :
                          status === 'warning' ? 'border-accent/30' : 'border-border/50'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-semibold text-foreground truncate">{compound?.name || item.compound_id}</h4>
                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                                  status === 'critical' ? 'bg-destructive/20 text-status-critical' :
                                  status === 'warning' ? 'bg-accent/20 text-status-warning' :
                                  'bg-status-good/10 text-status-good'
                                }`}>
                                  {days}d
                                </span>
                                {avgShip !== null && (
                                  <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/30">
                                    <Truck className="w-2.5 h-2.5" />
                                    ~{avgShip}d to arrive
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                                <span>{getDisplayQty(item.compound_id, item.quantity)}</span>
                                <span className="font-mono">${item.cost}</span>
                                <span className="flex items-center gap-0.5">
                                  <CalendarIcon className="w-2.5 h-2.5" />
                                  {item.month_label}
                                </span>
                                {days < 999 && (
                                  <span className="flex items-center gap-0.5 font-mono">
                                    Runs out: {new Date(Date.now() + days * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                              {compound && (
                                <button
                                  onClick={() => setDetailsCompound(compound)}
                                  className="p-1.5 rounded-md bg-secondary/60 text-muted-foreground border border-border/30 active:bg-secondary touch-manipulation"
                                  title="View compound details"
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleMarkOrdered(item.compound_id, item.quantity, item.cost, item.month_label)}
                                className="px-3 py-1.5 rounded-md bg-primary/15 text-primary text-xs font-medium border border-primary/30 active:bg-primary/25 touch-manipulation"
                              >
                                Order
                              </button>
                            </div>
                          </div>
                          {/* Search links */}
                          {compound && (
                            <div className="flex items-center gap-1.5 pt-2 border-t border-border/20">
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground mr-0.5">Shop:</span>
                              <a
                                href={`https://www.amazon.com/s?k=${encodeURIComponent(compound.name + ' supplement')}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent-foreground border border-accent/30 hover:bg-accent/25 transition-colors"
                              >
                                <ShoppingBag className="w-2.5 h-2.5" />Amazon<ExternalLink className="w-2 h-2 opacity-60" />
                              </a>
                              <a
                                href={`https://www.google.com/search?q=${encodeURIComponent(compound.name + ' supplement buy')}&tbm=shop`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/40 hover:bg-secondary/80 transition-colors"
                              >
                                <ShoppingCart className="w-2.5 h-2.5" />Google<ExternalLink className="w-2 h-2 opacity-60" />
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      )}

      {/* ── Ordered Tab ── */}
      {tab === 'ordered' && (
        <div className="space-y-3">
          {orderedItems.length === 0 ? (
            <div className="bg-card rounded-lg border border-border/50 p-6 text-center">
              <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No pending orders.</p>
            </div>
          ) : (
            <>
              {orderedGroups.map((group) => (
                <Collapsible key={group.label} defaultOpen>
                  {group.label && (
                    <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left mb-2 group">
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                      <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                      <span className="text-[10px] text-muted-foreground font-mono">({group.items.length})</span>
                    </CollapsibleTrigger>
                  )}
                  <CollapsibleContent>
                    <div className="space-y-1.5">
                      {group.items.map(order => {
                        const compound = compoundMap.get(order.compound_id);
                        const transitDays = order.ordered_at
                          ? Math.floor((Date.now() - new Date(order.ordered_at).getTime()) / 86400000)
                          : null;
                        return (
                          <div key={order.id} className="bg-card rounded-lg border border-primary/20 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-semibold text-foreground truncate">{compound?.name || order.compound_id}</h4>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-[10px] text-muted-foreground">{getDisplayQty(order.compound_id, order.quantity)}</span>
                                  <span className="text-[10px] font-mono text-muted-foreground">${order.cost}</span>
                                  {order.ordered_at && (
                                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                      <Calendar className="w-2.5 h-2.5" />
                                      {new Date(order.ordered_at).toLocaleDateString()}
                                    </span>
                                  )}
                                  {transitDays !== null && (
                                    <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20 font-medium">
                                      <Clock className="w-2.5 h-2.5" />
                                      {transitDays}d in transit
                                    </span>
                                  )}
                                </div>
                                {order.notes && (
                                  <div className="flex items-center gap-1 mt-1.5">
                                    <Store className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                                    <p className="text-[10px] text-muted-foreground italic truncate">{order.notes}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => handleReturnToNeeded(order)}
                                  className="p-1.5 rounded-md bg-secondary/60 text-muted-foreground border border-border/30 active:bg-secondary touch-manipulation"
                                  title="Return to Needed list"
                                >
                                  <Undo2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteOrder(order)}
                                  className="p-1.5 rounded-md bg-destructive/10 text-status-critical border border-destructive/20 active:bg-destructive/20 touch-manipulation"
                                  title="Cancel order"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleMarkReceived(order)}
                                  className="px-3 py-1.5 rounded-md bg-status-good/15 text-status-good text-xs font-medium border border-status-good/30 active:bg-status-good/25 touch-manipulation flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  Received
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}

              {orderedItems.length > 1 && (
                <button
                  onClick={handleReceiveAll}
                  className="w-full py-2.5 rounded-lg bg-status-good/15 text-status-good text-sm font-semibold border border-status-good/30 active:bg-status-good/25 touch-manipulation flex items-center justify-center gap-2"
                >
                  <PackageCheck className="w-4 h-4" />
                  Receive All ({orderedItems.length} items)
                </button>
              )}

              <div className="flex justify-between pt-2 text-sm font-semibold px-1">
                <span className="text-foreground">Order Total</span>
                <span className="font-mono text-primary">${orderedItems.reduce((sum, o) => sum + Number(o.cost), 0)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Received Tab ── */}
      {tab === 'received' && (
        <div className="space-y-3">
          {/* Shipping analytics summary */}
          {shippingByCompound.size > 0 && (
            <div className="bg-secondary/30 rounded-lg border border-border/40 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Truck className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold text-foreground">Shipping Analytics</p>
              </div>
              <div className="space-y-1">
                {Array.from(shippingByCompound.entries()).map(([cid, avgDays]) => {
                  const compound = compoundMap.get(cid);
                  const orderCount = receivedItems.filter(o => o.compound_id === cid && o.ordered_at && o.received_at).length;
                  return (
                    <div key={cid} className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground truncate flex-1">{compound?.name || cid}</span>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-muted-foreground font-mono">{orderCount} order{orderCount !== 1 ? 's' : ''}</span>
                        <span className={`flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-full ${
                          avgDays <= 3 ? 'bg-status-good/15 text-status-good' :
                          avgDays <= 7 ? 'bg-accent/15 text-status-warning' :
                          'bg-destructive/15 text-status-critical'
                        }`}>
                          <Clock className="w-2.5 h-2.5" />
                          avg {avgDays}d
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {receivedItems.length === 0 ? (
            <div className="bg-card rounded-lg border border-border/50 p-6 text-center">
              <PackageCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No received orders yet.</p>
            </div>
          ) : (
            receivedGroups.map((group) => (
              <Collapsible key={group.label} defaultOpen>
                {group.label && (
                  <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left mb-2 group">
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                    <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                    <span className="text-[10px] text-muted-foreground font-mono">({group.items.length})</span>
                  </CollapsibleTrigger>
                )}
                <CollapsibleContent>
                  <div className="space-y-1.5">
                    {group.items.map(order => {
                      const compound = compoundMap.get(order.compound_id);
                      const shipDays = (order.ordered_at && order.received_at)
                        ? Math.floor((new Date(order.received_at).getTime() - new Date(order.ordered_at).getTime()) / 86400000)
                        : null;
                      return (
                        <div key={order.id} className="bg-card rounded-lg border border-status-good/20 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-semibold text-foreground truncate">{compound?.name || order.compound_id}</h4>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[10px] text-muted-foreground">{getDisplayQty(order.compound_id, order.quantity)}</span>
                                <span className="text-[10px] font-mono text-muted-foreground">${order.cost}</span>
                                {order.ordered_at && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                    <Calendar className="w-2.5 h-2.5" />
                                    {new Date(order.ordered_at).toLocaleDateString()}
                                  </span>
                                )}
                                {order.received_at && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                    <PackageCheck className="w-2.5 h-2.5" />
                                    {new Date(order.received_at).toLocaleDateString()}
                                  </span>
                                )}
                                {shipDays !== null && (
                                  <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                    shipDays <= 3 ? 'bg-status-good/15 text-status-good' :
                                    shipDays <= 7 ? 'bg-accent/15 text-status-warning' :
                                    'bg-destructive/15 text-status-critical'
                                  }`}>
                                    <Truck className="w-2.5 h-2.5" />
                                    {shipDays}d shipping
                                  </span>
                                )}
                              </div>
                              {order.notes && (
                                <div className="flex items-center gap-1 mt-1.5">
                                  <Store className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                                  <p className="text-[10px] text-muted-foreground italic truncate">{order.notes}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => handleUndoReceived(order)}
                                className="p-1.5 rounded-md bg-accent/10 text-accent border border-accent/20 active:bg-accent/20 touch-manipulation"
                                title="Undo — move back to ordered and subtract from inventory"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteOrder(order)}
                                className="p-1.5 rounded-md bg-destructive/10 text-status-critical border border-destructive/20 active:bg-destructive/20 touch-manipulation"
                                title="Delete order record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      )}
    </div>

    {/* ── Order Date + Notes Dialog ── */}
    <Dialog open={!!orderDialog} onOpenChange={(v) => { if (!v) setOrderDialog(null); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarIcon className="w-4 h-4 text-primary" />
            Log Order
          </DialogTitle>
        </DialogHeader>
        {orderDialog && (
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              Record the order details for{' '}
              <span className="font-semibold text-foreground">{compoundMap.get(orderDialog.compoundId)?.name}</span>.
            </p>

            {/* Date picker */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Order / Refill Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !orderDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {orderDate ? format(orderDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarUI
                    mode="single"
                    selected={orderDate}
                    onSelect={(d) => d && setOrderDate(d)}
                    disabled={(d) => d > new Date()}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Supplier / notes */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Supplier / Notes (optional)</Label>
              <Textarea
                placeholder="e.g. Empower Pharmacy, peptide supplier…"
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground bg-secondary/40 rounded-lg p-2.5 border border-border/30">
              <div>
                <p className="uppercase tracking-wider mb-0.5">Cost</p>
                <p className="font-mono font-semibold text-foreground">${orderDialog.cost}</p>
              </div>
              <div>
                <p className="uppercase tracking-wider mb-0.5">Quantity</p>
                <p className="font-semibold text-foreground">{getDisplayQty(orderDialog.compoundId, orderDialog.quantity)}</p>
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <button
            onClick={() => setOrderDialog(null)}
            className="flex-1 py-2 rounded-lg border border-border/50 text-sm text-muted-foreground hover:bg-secondary/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirmMarkOrdered}
            className="flex-1 py-2 rounded-lg bg-primary/15 text-primary text-sm font-semibold border border-primary/30 hover:bg-primary/25 transition-colors"
          >
            Mark as Ordered
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ── Compound Details Sheet ── */}
    <Sheet open={!!detailsCompound} onOpenChange={(v) => { if (!v) setDetailsCompound(null); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
        {detailsCompound && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                {detailsCompound.name}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{detailsCompound.category.replace(/-/g,' ')}</span>
              </SheetTitle>
            </SheetHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Dose per Use', value: `${detailsCompound.dosePerUse} ${detailsCompound.doseLabel}` },
                  { label: 'Doses / Day', value: `${detailsCompound.dosesPerDay}x` },
                  { label: 'Days / Week', value: `${detailsCompound.daysPerWeek} days` },
                  { label: 'Unit Size', value: `${detailsCompound.unitSize} ${detailsCompound.unitLabel}` },
                  { label: 'Unit Price', value: `$${detailsCompound.unitPrice}` },
                  { label: 'On Hand', value: `${detailsCompound.currentQuantity} ${detailsCompound.unitLabel}` },
                  { label: 'Reorder Qty', value: getDisplayQty(detailsCompound.id, detailsCompound.reorderQuantity) },
                  { label: 'Reorder Cost', value: `$${getReorderCost(detailsCompound)}` },
                  ...(detailsCompound.vialSizeMl ? [{ label: 'Vial Size', value: `${detailsCompound.vialSizeMl} mL` }] : []),
                  ...(detailsCompound.reconVolume ? [{ label: 'Recon Volume', value: `${detailsCompound.reconVolume} mL` }] : []),
                  ...(detailsCompound.bacstatPerVial ? [{ label: 'Bac/Vial', value: `${detailsCompound.bacstatPerVial}` }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="bg-secondary/30 rounded-lg p-2.5 border border-border/20">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
              {detailsCompound.timingNote && (
                <div className="bg-secondary/30 rounded-lg p-2.5 border border-border/20">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Timing</p>
                  <p className="text-xs text-foreground">{detailsCompound.timingNote}</p>
                </div>
              )}
              {detailsCompound.notes && (
                <div className="bg-secondary/30 rounded-lg p-2.5 border border-border/20">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Notes</p>
                  <p className="text-xs text-foreground">{detailsCompound.notes}</p>
                </div>
              )}
              <div className="pt-2 border-t border-border/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Search to Purchase</p>
                <div className="flex gap-2">
                  <a
                    href={`https://www.amazon.com/s?k=${encodeURIComponent(detailsCompound.name + ' supplement')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-accent/15 text-accent-foreground border border-accent/30 hover:bg-accent/25 transition-colors text-xs font-medium"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />Amazon<ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(detailsCompound.name + ' supplement buy')}&tbm=shop`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-secondary text-muted-foreground border border-border/40 hover:bg-secondary/80 transition-colors text-xs font-medium"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />Google Shop<ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
};

export default ReorderView;
