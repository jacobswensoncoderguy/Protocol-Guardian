import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Package, DollarSign, LayoutDashboard, ShoppingCart, Sun, Moon, RefreshCw, LogOut, Sparkles, Brain, Target, Activity, FileText } from 'lucide-react';
import { Compound } from '@/data/compounds';
import { useCompounds } from '@/hooks/useCompounds';
import { useProtocols } from '@/hooks/useProtocols';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useGoals } from '@/hooks/useGoals';
import { useTheme } from '@/hooks/useTheme';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useProtocolAnalysis } from '@/hooks/useProtocolAnalysis';
import { useProtocolChat } from '@/hooks/useProtocolChat';
import { useConversations } from '@/hooks/useConversations';
import { Skeleton } from '@/components/ui/skeleton';
import { useCallback, useState, useEffect } from 'react';
import Onboarding from './Onboarding';
import AddCompoundDialog from '@/components/AddCompoundDialog';
import ProtocolManagerDialog from '@/components/ProtocolManagerDialog';
import GoalExpansionDialog from '@/components/GoalExpansionDialog';
import BiomarkerUploadDialog from '@/components/BiomarkerUploadDialog';
import ConfirmDialog from '@/components/ConfirmDialog';

import DashboardView from '@/components/DashboardView';
import WeeklyScheduleView from '@/components/WeeklyScheduleView';
import InventoryView from '@/components/InventoryView';
import CostProjectionView from '@/components/CostProjectionView';
import ReorderView from '@/components/ReorderView';
import AIInsightsView from '@/components/AIInsightsView';
import OutcomesView from '@/components/OutcomesView';

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
  const { user, signOut } = useAuth();
  const { profile, currentTolerance, setTolerance, toleranceHistory, updateProfile, measurementSystem, doseUnitPreference } = useProfile(user?.id);
  const { compounds, loading, hasCompounds, updateCompound, addCompound, deleteCompound, refetch } = useCompounds(user?.id);
  const { isDark, toggle } = useTheme();
  const { createGoals, goals: fullGoals, fetchGoals: fetchFullGoals } = useGoals(user?.id);

  useEffect(() => { if (user?.id) fetchFullGoals(); }, [user?.id, fetchFullGoals]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showProtocolManager, setShowProtocolManager] = useState(false);
  const [showGoalExpansion, setShowGoalExpansion] = useState(false);
  const [showBiomarkerUpload, setShowBiomarkerUpload] = useState(false);
  const {
    protocols, createProtocol, deleteProtocol, cloneProtocol, updateProtocol,
    addCompoundToProtocol, removeCompoundFromProtocol, refetch: refetchProtocols,
    goals, protocolGoalLinks, linkGoalToProtocol, unlinkGoalFromProtocol, refetchGoals,
  } = useProtocols(user?.id);

  const {
    stackAnalysis, compoundAnalyses, loading: aiLoading, compoundLoading,
    toleranceLevel, setToleranceLevel: setToleranceLevelLocal, analyzeStack, analyzeCompound, needsRefresh,
    toleranceComparison, compareLoading, compareAllLevels,
  } = useProtocolAnalysis(compounds, protocols);

  // Sync persisted tolerance into local analysis hook
  useEffect(() => {
    if (currentTolerance && currentTolerance !== toleranceLevel) {
      setToleranceLevelLocal(currentTolerance as any);
    }
  }, [currentTolerance]);

  // Wrap tolerance change to persist
  const handleToleranceChange = useCallback((level: any) => {
    setToleranceLevelLocal(level);
    setTolerance(level);
  }, [setTolerance]);

  const conversationManager = useConversations(user?.id);

  const {
    messages: chatMessages, isStreaming: isChatStreaming,
    sendMessage: onChatSend, cancelStream: onChatCancel, clearChat: onChatClear,
    applyChange: onApplyChange, rejectChange: onRejectChange, applyAllPending: onApplyAll,
  } = useProtocolChat(
    compounds, protocols, stackAnalysis, toleranceLevel, updateCompound, deleteCompound, refetch,
    conversationManager.activeConversationId,
    conversationManager.refreshConversation,
    conversationManager.renameConversation,
  );

  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), refetchProtocols()]);
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

  // Show onboarding if user has no compounds
  if (hasCompounds === false || showOnboarding) {
    return (
      <Onboarding
        onComplete={() => {
          setShowOnboarding(false);
          refetch();
        }}
      />
    );
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
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={toggle} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={() => setShowSignOutConfirm(true)} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
            <button onClick={() => setShowProtocolManager(true)} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Protocol Groups">
              <Sparkles className="w-4 h-4" />
            </button>
            <button onClick={() => setShowGoalExpansion(true)} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Goal Expansion">
              <Target className="w-4 h-4" />
            </button>
            <button onClick={() => setShowBiomarkerUpload(true)} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Upload Lab Results">
              <FileText className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground font-mono">
              <span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-status-good animate-pulse-glow" />
              {compounds.length}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
            <TabsTrigger value="outcomes" className="flex-1 gap-1 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[11px] sm:text-xs py-2.5">
              <Activity className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Outcomes</span>
            </TabsTrigger>
            <TabsTrigger value="ai-insights" className="flex-1 gap-1 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[11px] sm:text-xs py-2.5">
              <Brain className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">AI</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="animate-slide-up">
            <DashboardView
              compounds={compounds}
              stackAnalysis={stackAnalysis}
              aiLoading={aiLoading}
              needsRefresh={needsRefresh}
              toleranceLevel={toleranceLevel}
              onAnalyzeStack={analyzeStack}
              onViewAIInsights={() => setActiveTab('ai-insights')}
              onViewOutcomes={() => setActiveTab('outcomes')}
              goals={fullGoals}
              userId={user?.id}
              profile={profile}
              toleranceHistory={toleranceHistory}
              onUpdateProfile={updateProfile}
              onToleranceChange={handleToleranceChange}
              measurementSystem={measurementSystem}
              doseUnitPreference={doseUnitPreference}
            />
          </TabsContent>
          <TabsContent value="schedule" className="animate-slide-up">
            <WeeklyScheduleView compounds={compounds} protocols={protocols} />
          </TabsContent>
          <TabsContent value="inventory" className="animate-slide-up">
            <InventoryView
              compounds={compounds}
              onUpdateCompound={handleUpdateCompound}
              onDeleteCompound={deleteCompound}
              onAddCompound={() => setShowAddDialog(true)}
              protocols={protocols}
              toleranceLevel={toleranceLevel}
              onToleranceChange={handleToleranceChange}
            />
          </TabsContent>
          <TabsContent value="reorders" className="animate-slide-up">
            <ReorderView compounds={compounds} onUpdateCompound={handleUpdateCompound} userId={user?.id} protocols={protocols} />
          </TabsContent>
          <TabsContent value="costs" className="animate-slide-up">
            <CostProjectionView compounds={compounds} protocols={protocols} />
          </TabsContent>
          <TabsContent value="outcomes" className="animate-slide-up">
            <OutcomesView userId={user?.id} goals={fullGoals} onRefreshGoals={fetchFullGoals} onUploadClick={() => setShowBiomarkerUpload(true)} profile={profile} measurementSystem={measurementSystem} />
          </TabsContent>
          <TabsContent value="ai-insights" className="animate-slide-up">
            <AIInsightsView
              analysis={stackAnalysis}
              loading={aiLoading}
              toleranceLevel={toleranceLevel}
              onToleranceChange={() => setActiveTab('inventory')}
              onRefresh={analyzeStack}
              chatMessages={chatMessages}
              isChatStreaming={isChatStreaming}
              onChatSend={onChatSend}
              onChatCancel={onChatCancel}
              onChatClear={onChatClear}
              onApplyChange={onApplyChange}
              onRejectChange={onRejectChange}
              onApplyAll={onApplyAll}
              conversationManager={conversationManager}
              toleranceComparison={toleranceComparison}
              compareLoading={compareLoading}
              onCompareAllLevels={compareAllLevels}
            />
          </TabsContent>
        </Tabs>

        <AddCompoundDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          existingCompoundIds={compounds.map(c => c.name)}
          onAdd={async (compound) => {
            await addCompound(compound);
            await refetch();
          }}
        />

        <ProtocolManagerDialog
          open={showProtocolManager}
          onOpenChange={setShowProtocolManager}
          protocols={protocols}
          compounds={compounds}
          onCreateProtocol={createProtocol}
          onDeleteProtocol={deleteProtocol}
          onCloneProtocol={cloneProtocol}
          onUpdateProtocol={updateProtocol}
          onAddCompound={addCompoundToProtocol}
          onRemoveCompound={removeCompoundFromProtocol}
          onUpdateCompound={handleUpdateCompound}
          goals={goals}
          protocolGoalLinks={protocolGoalLinks}
          onLinkGoal={linkGoalToProtocol}
          onUnlinkGoal={unlinkGoalFromProtocol}
        />

        <GoalExpansionDialog
          open={showGoalExpansion}
          onOpenChange={setShowGoalExpansion}
          goals={goals}
          protocols={protocols}
          compounds={compounds}
          onCreateGoal={async (goal) => {
            await createGoals([{
              goal_type: goal.goal_type,
              title: goal.title,
              description: goal.description,
              body_area: goal.body_area,
              target_value: goal.target_value,
              target_unit: goal.target_unit,
              priority: goal.priority || 2,
            }]);
            await refetchGoals();
          }}
        />

        <BiomarkerUploadDialog
          open={showBiomarkerUpload}
          onOpenChange={setShowBiomarkerUpload}
          userId={user?.id}
          goals={fullGoals}
          onReadingsCreated={() => fetchFullGoals()}
        />

        <ConfirmDialog
          open={showSignOutConfirm}
          onOpenChange={setShowSignOutConfirm}
          title="Sign Out"
          description="Are you sure you want to sign out? You'll need to log back in to access your protocols."
          confirmLabel="Sign Out"
          onConfirm={signOut}
          destructive
        />
      </main>
    </div>
  );
};

export default Index;
