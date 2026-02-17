import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Package, DollarSign, LayoutDashboard, ShoppingCart, RefreshCw, Brain, Activity } from 'lucide-react';
import { getDaysRemainingWithCycling } from '@/lib/cycling';
import { getStatus } from '@/data/compounds';
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
import { useCallback, useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import HeaderQuickActions from '@/components/HeaderQuickActions';
import ProfileDropdown from '@/components/ProfileDropdown';
import Onboarding from './Onboarding';
import AddCompoundDialog from '@/components/AddCompoundDialog';
import ProtocolManagerDialog from '@/components/ProtocolManagerDialog';
import GoalExpansionDialog from '@/components/GoalExpansionDialog';
import BiomarkerUploadDialog from '@/components/BiomarkerUploadDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import AccountSettingsDialog from '@/components/AccountSettingsDialog';
import GuidedTour from '@/components/GuidedTour';
import WhatsNewOverlay from '@/components/WhatsNewOverlay';
import FeatureManagerDialog from '@/components/FeatureManagerDialog';
import { AppFeatures } from '@/lib/appFeatures';
import { supabase } from '@/integrations/supabase/client';

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
  const { profile, currentTolerance, setTolerance, toleranceHistory, updateProfile, measurementSystem, doseUnitPreference, appFeatures, updateAppFeatures } = useProfile(user?.id);
  const { compounds, loading, hasCompounds, updateCompound, addCompound, deleteCompound, refetch } = useCompounds(user?.id);
  const { isDark, toggle } = useTheme();
  const { createGoals, updateGoal, deleteGoal, goals: fullGoals, fetchGoals: fetchFullGoals } = useGoals(user?.id);

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

  // Badge counts for low-stock alerts
  const lowStockCounts = useMemo(() => {
    let inventoryWarnings = 0;
    let reorderNeeded = 0;
    compounds.forEach(c => {
      const days = getDaysRemainingWithCycling(c);
      const status = getStatus(days);
      if (status === 'warning') inventoryWarnings++;
      if (status === 'critical') { inventoryWarnings++; reorderNeeded++; }
    });
    return { inventory: inventoryWarnings, reorder: reorderNeeded };
  }, [compounds]);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  const [showTourPrompt, setShowTourPrompt] = useState(false);
  const [showFeatureManager, setShowFeatureManager] = useState(false);

  const handleToggleFeature = useCallback(async (key: keyof AppFeatures) => {
    const updated = { ...appFeatures, [key]: !appFeatures[key] };
    await updateAppFeatures(updated);
    toast.success(`${appFeatures[key] ? 'Disabled' : 'Enabled'} ${key.replace(/_/g, ' ')}`);
  }, [appFeatures, updateAppFeatures]);

  const handleFeatureRequest = useCallback(async (text: string) => {
    if (!user) return;
    await (supabase as any).from('feature_requests').insert({ user_id: user.id, request_text: text });
    toast.success('Feature request submitted! Thanks for the feedback.');
  }, [user]);

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
          setShowTourPrompt(true);
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
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <HeaderQuickActions
              activeTab={activeTab}
              onAddCompound={() => setShowAddDialog(true)}
              onManageProtocols={() => setShowProtocolManager(true)}
              onGoalExpansion={() => setShowGoalExpansion(true)}
              onNavigateTab={setActiveTab}
            />
            <div className="w-px h-5 bg-border/50 hidden sm:block" />
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground font-mono">
              <span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-status-good animate-pulse-glow" />
              {compounds.length}
            </div>
            <ProfileDropdown
              isDark={isDark}
              onToggleTheme={toggle}
              onAccountSettings={() => setShowAccountSettings(true)}
              onFeatureManager={() => setShowFeatureManager(true)}
              onGoalExpansion={() => setShowGoalExpansion(true)}
              onBiomarkerUpload={() => setShowBiomarkerUpload(true)}
              onSignOut={() => setShowSignOutConfirm(true)}
              displayName={profile?.display_name}
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-secondary/50 border border-border/50 mb-3 sm:mb-4 h-14 sm:h-11">
            <TabsTrigger value="dashboard" className="flex-1 flex-col sm:flex-row gap-0.5 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[9px] sm:text-xs py-1.5 sm:py-2.5">
              <LayoutDashboard className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span>Home</span>
            </TabsTrigger>
            <TabsTrigger value="outcomes" className="flex-1 flex-col sm:flex-row gap-0.5 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[9px] sm:text-xs py-1.5 sm:py-2.5">
              <Activity className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span>Progress</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex-1 flex-col sm:flex-row gap-0.5 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[9px] sm:text-xs py-1.5 sm:py-2.5">
              <Calendar className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span>Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="relative flex-1 flex-col sm:flex-row gap-0.5 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[9px] sm:text-xs py-1.5 sm:py-2.5">
              <Package className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span>Inventory</span>
              {lowStockCounts.inventory > 0 && (
                <span className="absolute -top-1 -right-1 sm:top-0 sm:right-0 min-w-[16px] h-4 px-1 rounded-full bg-status-warning text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {lowStockCounts.inventory}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reorders" className="relative flex-1 flex-col sm:flex-row gap-0.5 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[9px] sm:text-xs py-1.5 sm:py-2.5">
              <ShoppingCart className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span>Reorder</span>
              {lowStockCounts.reorder > 0 && (
                <span className="absolute -top-1 -right-1 sm:top-0 sm:right-0 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {lowStockCounts.reorder}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="costs" className="flex-1 flex-col sm:flex-row gap-0.5 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[9px] sm:text-xs py-1.5 sm:py-2.5">
              <DollarSign className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span>Costs</span>
            </TabsTrigger>
            <TabsTrigger value="ai-insights" className="flex-1 flex-col sm:flex-row gap-0.5 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[9px] sm:text-xs py-1.5 sm:py-2.5">
              <Brain className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span>AI</span>
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
              onNavigateToInventory={() => setActiveTab('inventory')}
              conversationManager={conversationManager}
              appFeatures={appFeatures}
              onEnableFeature={handleToggleFeature}
              onAddCompound={() => setShowAddDialog(true)}
            />
          </TabsContent>
          <TabsContent value="outcomes" className="animate-slide-up">
            <OutcomesView userId={user?.id} goals={fullGoals} onRefreshGoals={fetchFullGoals} onUploadClick={() => setShowBiomarkerUpload(true)} profile={profile} measurementSystem={measurementSystem} onCreateGoal={createGoals} onUpdateGoal={updateGoal} onDeleteGoal={deleteGoal} />
          </TabsContent>
          <TabsContent value="schedule" className="animate-slide-up">
            <WeeklyScheduleView compounds={compounds} protocols={protocols} compoundAnalyses={compoundAnalyses} compoundLoading={compoundLoading} onAnalyzeCompound={analyzeCompound} />
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
          <TabsContent value="ai-insights" className="animate-slide-up">
            <AIInsightsView
              analysis={stackAnalysis}
              loading={aiLoading}
              toleranceLevel={toleranceLevel}
              onToleranceChange={handleToleranceChange}
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

        <AccountSettingsDialog
          open={showAccountSettings}
          onOpenChange={setShowAccountSettings}
          userId={user?.id}
          onResetComplete={() => {
            setShowOnboarding(true);
            refetch();
          }}
          onStartTour={() => setShowGuidedTour(true)}
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

        <FeatureManagerDialog
          open={showFeatureManager}
          onOpenChange={setShowFeatureManager}
          features={appFeatures}
          onToggle={handleToggleFeature}
          onRequestFeature={handleFeatureRequest}
        />
      </main>
      <WhatsNewOverlay />
      {showTourPrompt && (
        <div className="fixed inset-0 z-[99] bg-background/80 flex items-center justify-center p-4">
          <div className="bg-card border border-border/50 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in-0 zoom-in-95 duration-300 text-center">
            <h2 className="text-lg font-bold text-foreground mb-2">Welcome aboard! 🎉</h2>
            <p className="text-sm text-muted-foreground mb-5">Want a quick guided tour of all the features?</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowTourPrompt(false); }}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
              >
                Skip
              </button>
              <button
                onClick={() => { setShowTourPrompt(false); setShowGuidedTour(true); }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all"
              >
                Take the tour
              </button>
            </div>
          </div>
        </div>
      )}
      {showGuidedTour && (
        <GuidedTour
          onComplete={() => { setShowGuidedTour(false); setActiveTab('dashboard'); }}
          onNavigateTab={setActiveTab}
          onSkip={() => { setShowGuidedTour(false); setActiveTab('dashboard'); toast('You can replay the tour from Settings anytime.'); }}
        />
      )}
    </div>
  );
};

export default Index;
