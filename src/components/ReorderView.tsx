import { useState, useEffect, useCallback } from 'react';
import { Compound, getReorderCost, getStatus } from '@/data/compounds';
import { getDaysRemainingWithCycling, getEffectiveDailyConsumption } from '@/lib/cycling';
import { UserProtocol } from '@/hooks/useProtocols';
import { supabase } from '@/integrations/supabase/client';
import { Check, Package, PackageCheck, ShoppingCart, Undo2, Trash2, ChevronDown, AlertTriangle, TrendingUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ReorderViewProps {
  compounds: Compound[];
  onUpdateCompound: (id: string, updates: Partial<Compound>) => void;
  userId?: string;
  protocols?: UserProtocol[];
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
}

type Tab = 'needed' | 'ordered' | 'received';

function getReorderSupplyDays(compound: Compound): number {
  const effectiveDaily = getEffectiveDailyConsumption(compound);
  if (effectiveDaily === 0) return 9999;
  const reorderUnits = compound.category === 'peptide'
    ? compound.reorderQuantity * 10
    : compound.reorderQuantity;
  const unitsPerUnit = compound.category === 'peptide' && compound.bacstatPerVial
    ? compound.bacstatPerVial
    : compound.unitSize;
  return (reorderUnits * unitsPerUnit) / effectiveDaily;
}

function buildNeededItems(compounds: Compound[]): (Omit<OrderItem, 'id' | 'ordered_at' | 'received_at'>)[] {
  const now = new Date();
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const items: (Omit<OrderItem, 'id' | 'ordered_at' | 'received_at'>)[] = [];

  compounds.forEach(compound => {
    const daysLeft = getDaysRemainingWithCycling(compound);
    if (daysLeft > 60) return;

    const cost = getReorderCost(compound);
    const reorderDate = new Date(now.getTime() + daysLeft * 24 * 60 * 60 * 1000);
    const monthLabel = `${MONTHS[reorderDate.getMonth()]} ${reorderDate.getFullYear()}`;

    items.push({
      compound_id: compound.id,
      quantity: compound.reorderQuantity,
      cost,
      status: 'needed',
      month_label: monthLabel,
    });
  });

  return items.sort((a, b) => {
    const compA = compounds.find(c => c.id === a.compound_id);
    const compB = compounds.find(c => c.id === b.compound_id);
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
  if (ungrouped.length > 0) {
    groups.push({ label: 'Other Compounds', items: ungrouped });
  }

  return groups.length > 0 ? groups : [{ label: '', items }];
}

const ReorderView = ({ compounds, onUpdateCompound, userId, protocols = [] }: ReorderViewProps) => {
  const [tab, setTab] = useState<Tab>('needed');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const compoundMap = new Map(compounds.map(c => [c.id, c]));

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data as OrderItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const neededItems = buildNeededItems(compounds);
  const orderedItems = orders.filter(o => o.status === 'ordered');
  const receivedItems = orders.filter(o => o.status === 'received');

  const activeOrderIds = new Set(orderedItems.map(o => o.compound_id));

  const handleMarkOrdered = async (compoundId: string, quantity: number, cost: number, monthLabel: string) => {
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        compound_id: compoundId,
        quantity,
        cost,
        status: 'ordered',
        month_label: monthLabel,
        ordered_at: new Date().toISOString(),
        user_id: userId,
      }])
      .select()
      .single();

    if (!error && data) {
      setOrders(prev => [data as OrderItem, ...prev]);
    }
  };

  const handleMarkReceived = async (order: OrderItem) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'received', received_at: new Date().toISOString() })
      .eq('id', order.id);

    if (error) return;

    const compound = compoundMap.get(order.compound_id);
    if (compound) {
      const addQty = order.quantity;
      onUpdateCompound(compound.id, {
        currentQuantity: compound.currentQuantity + addQty,
      });
    }

    setOrders(prev => prev.map(o =>
      o.id === order.id ? { ...o, status: 'received', received_at: new Date().toISOString() } : o
    ));
  };

  const handleReceiveAll = async () => {
    for (const order of orderedItems) {
      await handleMarkReceived(order);
    }
  };

  const handleUndoReceived = async (order: OrderItem) => {
    const compound = compoundMap.get(order.compound_id);
    if (compound) {
      onUpdateCompound(compound.id, {
        currentQuantity: Math.max(0, compound.currentQuantity - order.quantity),
      });
    }

    const { error } = await supabase
      .from('orders')
      .update({ status: 'ordered', received_at: null })
      .eq('id', order.id);

    if (!error) {
      setOrders(prev => prev.map(o =>
        o.id === order.id ? { ...o, status: 'ordered', received_at: null } : o
      ));
    }
  };

  const handleDeleteOrder = async (order: OrderItem) => {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', order.id);

    if (!error) {
      setOrders(prev => prev.filter(o => o.id !== order.id));
    }
  };

  const getDisplayQty = (compoundId: string, qty: number) => {
    const compound = compoundMap.get(compoundId);
    if (!compound) return `Reorder Qty: ${qty}`;
    if (compound.category === 'peptide') return `Reorder Qty: ${qty} kit${qty !== 1 ? 's' : ''} (${qty * 10} vials)`;
    const type = compound.reorderType === 'kit' ? 'kit' : 'single unit';
    return `Reorder Qty: ${qty} ${type}${qty !== 1 ? 's' : ''}`;
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

  const criticalCompounds = compounds.filter(c => getStatus(getDaysRemainingWithCycling(c)) === 'critical');
  const warningCompounds = compounds.filter(c => getStatus(getDaysRemainingWithCycling(c)) === 'warning');

  return (
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
                <p className="text-[10px] text-muted-foreground">7-30 days left</p>
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

      {/* Needed Tab */}
      {tab === 'needed' && (
        <div className="space-y-3">
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
                      return (
                        <div key={`${item.compound_id}-${i}`} className={`bg-card rounded-lg border p-3 flex items-center justify-between ${
                          status === 'critical' ? 'border-destructive/40' :
                          status === 'warning' ? 'border-accent/30' :
                          'border-border/50'
                        }`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-foreground truncate">{compound?.name || item.compound_id}</h4>
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                                status === 'critical' ? 'bg-destructive/20 text-status-critical' :
                                status === 'warning' ? 'bg-accent/20 text-status-warning' :
                                'bg-status-good/10 text-status-good'
                              }`}>
                                {days}d
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                              <span>{getDisplayQty(item.compound_id, item.quantity)}</span>
                              <span className="font-mono">${item.cost}</span>
                              <span>{item.month_label}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleMarkOrdered(item.compound_id, item.quantity, item.cost, item.month_label)}
                            className="ml-2 px-3 py-1.5 rounded-md bg-primary/15 text-primary text-xs font-medium border border-primary/30 active:bg-primary/25 touch-manipulation flex-shrink-0"
                          >
                            Order
                          </button>
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

      {/* Ordered Tab */}
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
                        return (
                          <div key={order.id} className="bg-card rounded-lg border border-primary/20 p-3 flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-semibold text-foreground truncate">{compound?.name || order.compound_id}</h4>
                              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                                <span>{getDisplayQty(order.compound_id, order.quantity)}</span>
                                <span className="font-mono">${order.cost}</span>
                                {order.ordered_at && (
                                  <span>Ordered {new Date(order.ordered_at).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
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

      {/* Received Tab */}
      {tab === 'received' && (
        <div className="space-y-3">
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
                      return (
                        <div key={order.id} className="bg-card rounded-lg border border-status-good/20 p-3 flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-foreground truncate">{compound?.name || order.compound_id}</h4>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                              <span>{getDisplayQty(order.compound_id, order.quantity)}</span>
                              <span className="font-mono">${order.cost}</span>
                              {order.received_at && (
                                <span>Received {new Date(order.received_at).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
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
  );
};

export default ReorderView;
