import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Package, DollarSign, LayoutDashboard, ShoppingCart, Sun, Moon, RefreshCw } from 'lucide-react';
import { Compound } from '@/data/compounds';
import { useCompounds } from '@/hooks/useCompounds';
import { useTheme } from '@/hooks/useTheme';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Skeleton } from '@/components/ui/skeleton';
import { useCallback } from 'react';

import DashboardView from '@/components/DashboardView';
import WeeklyScheduleView from '@/components/WeeklyScheduleView';
import InventoryView from '@/components/InventoryView';
import CostProjectionView from '@/components/CostProjectionView';
import ReorderView from '@/components/ReorderView';

const LoadingSkeleton = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border/50 px-4 py-2.5 sm:py-4">
      <div className="container mx-auto flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-4 w-8" />
        </div>
      </div>
    </header>
    <main className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
      <Skeleton className="h-12 w-full rounded-lg mb-4" />
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl mb-4" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </main>
  </div>
);

const Index = () => {
  const { compounds, loading, updateCompound, refetch } = useCompounds();
  const { isDark, toggle } = useTheme();

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const { containerRef, pullDistance, refreshing, isTriggered } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const handleUpdateCompound = (id: string, updates: Partial<Compound>) => {
    updateCompound(id, updates);
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-background relative">
      {/* Pull-to-refresh indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out z-50"
        style={{ height: pullDistance > 0 ? `${pullDistance}px` : 0 }}
      >
        <RefreshCw
          className={`w-5 h-5 text-primary transition-transform duration-200 ${
            refreshing ? 'animate-spin' : ''
          }`}
          style={{
            transform: `rotate(${Math.min(pullDistance * 3, 360)}deg)`,
            opacity: Math.min(pullDistance / 60, 1),
          }}
        />
        {isTriggered && !refreshing && (
          <span className="ml-2 text-xs text-muted-foreground">Release to refresh</span>
        )}
        {refreshing && (
          <span className="ml-2 text-xs text-muted-foreground">Refreshing…</span>
        )}
      </div>

      <header className="border-b border-border/50 px-4 py-2.5 sm:py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold tracking-tight truncate">
              <span className="text-gradient-cyan">SUPERHUMAN</span>
              <span className="text-muted-foreground font-medium ml-1.5 sm:ml-2 text-sm sm:text-xl">Tracker</span>
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={toggle} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground font-mono">
              <span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-status-good animate-pulse-glow" />
              {compounds.length}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="w-full bg-secondary/50 border border-border/50 mb-3 sm:mb-4 h-12 sm:h-11">
            <TabsTrigger value="dashboard" className="flex-1 gap-1 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[11px] sm:text-xs py-2.5">
              <LayoutDashboard className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex-1 gap-1 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[11px] sm:text-xs py-2.5">
              <Calendar className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex-1 gap-1 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[11px] sm:text-xs py-2.5">
              <Package className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Inventory</span>
            </TabsTrigger>
            <TabsTrigger value="reorders" className="flex-1 gap-1 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[11px] sm:text-xs py-2.5">
              <ShoppingCart className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Reorders</span>
            </TabsTrigger>
            <TabsTrigger value="costs" className="flex-1 gap-1 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[11px] sm:text-xs py-2.5">
              <DollarSign className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Costs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="animate-slide-up">
            <DashboardView compounds={compounds} />
          </TabsContent>
          <TabsContent value="schedule" className="animate-slide-up">
            <WeeklyScheduleView compounds={compounds} />
          </TabsContent>
          <TabsContent value="inventory" className="animate-slide-up">
            <InventoryView compounds={compounds} onUpdateCompound={handleUpdateCompound} />
          </TabsContent>
          <TabsContent value="reorders" className="animate-slide-up">
            <ReorderView compounds={compounds} onUpdateCompound={handleUpdateCompound} />
          </TabsContent>
          <TabsContent value="costs" className="animate-slide-up">
            <CostProjectionView compounds={compounds} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
