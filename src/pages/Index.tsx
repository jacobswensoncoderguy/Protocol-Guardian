import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Package, DollarSign, LayoutDashboard } from 'lucide-react';
import { defaultCompounds, Compound } from '@/data/compounds';
import DashboardView from '@/components/DashboardView';
import WeeklyScheduleView from '@/components/WeeklyScheduleView';
import InventoryView from '@/components/InventoryView';
import CostProjectionView from '@/components/CostProjectionView';

const Index = () => {
  const [compounds] = useState<Compound[]>(defaultCompounds);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 px-4 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-gradient-cyan">SUPERHUMAN</span>
              <span className="text-muted-foreground font-medium ml-2">Protocol Tracker</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Biohacking protocol management</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="inline-block w-2 h-2 rounded-full bg-status-good animate-pulse-glow" />
            {compounds.length} compounds
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="w-full bg-secondary/50 border border-border/50 mb-4 h-11">
            <TabsTrigger value="dashboard" className="flex-1 gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs">
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex-1 gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs">
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex-1 gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs">
              <Package className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Inventory</span>
            </TabsTrigger>
            <TabsTrigger value="costs" className="flex-1 gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs">
              <DollarSign className="w-3.5 h-3.5" />
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
            <InventoryView compounds={compounds} />
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
