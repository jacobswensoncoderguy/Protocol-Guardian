import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Package, DollarSign, LayoutDashboard } from 'lucide-react';
import { defaultCompounds, Compound } from '@/data/compounds';

const STORAGE_KEY = 'superhuman-compounds';

const loadCompounds = (): Compound[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return defaultCompounds;
};

import DashboardView from '@/components/DashboardView';
import WeeklyScheduleView from '@/components/WeeklyScheduleView';
import InventoryView from '@/components/InventoryView';
import CostProjectionView from '@/components/CostProjectionView';

const Index = () => {
  const [compounds, setCompounds] = useState<Compound[]>(loadCompounds);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compounds));
  }, [compounds]);

  const handleUpdateCompound = (id: string, updates: Partial<Compound>) => {
    setCompounds(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 px-4 py-2.5 sm:py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold tracking-tight truncate">
              <span className="text-gradient-cyan">SUPERHUMAN</span>
              <span className="text-muted-foreground font-medium ml-1.5 sm:ml-2 text-sm sm:text-xl">Tracker</span>
            </h1>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground font-mono flex-shrink-0">
            <span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-status-good animate-pulse-glow" />
            {compounds.length}
          </div>
        </div>
      </header>

      {/* Main Content */}
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

          <TabsContent value="costs" className="animate-slide-up">
            <CostProjectionView compounds={compounds} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
