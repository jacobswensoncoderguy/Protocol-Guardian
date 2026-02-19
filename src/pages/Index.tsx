import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Package, LayoutDashboard, RefreshCw, Brain, Gauge, LineChart } from 'lucide-react';
import { getDaysRemainingWithCycling, getEffectiveDailyConsumption } from '@/lib/cycling';
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
import { useCustomFields } from '@/hooks/useCustomFields';
import { useDoseCheckOffs } from '@/hooks/useDoseCheckOffs';
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
import { TabErrorBoundary } from '@/components/TabErrorBoundary';
import WeeklyScheduleView from '@/components/WeeklyScheduleView';
import ScheduleHistoryView from '@/components/ScheduleHistoryView';
import ProtocolChangeHistoryView from '@/components/ProtocolChangeHistoryView';
import InventoryView from '@/components/InventoryView';
import CostProjectionView from '@/components/CostProjectionView';
import ReorderView from '@/components/ReorderView';
import AIInsightsView from '@/components/AIInsightsView';
import OutcomesView from '@/components/OutcomesView';
import FoodTrackerView from '@/components/FoodTrackerView';
import SymptomsTrackerView from '@/components/SymptomsTrackerView';
import BiomarkerHistoryView from '@/components/BiomarkerHistoryView';
import { useScheduleSnapshots } from '@/hooks/useScheduleSnapshots';
import { useHistoricalCheckOffs } from '@/hooks/useHistoricalCheckOffs';
import { useSwipeTabs } from '@/hooks/useSwipeTabs';
import { useHousehold, useHouseholdMemberCompounds } from '@/hooks/useHousehold';
import { useHouseholdDoseCheckOffs } from '@/hooks/useHouseholdDoseCheckOffs';
import HouseholdMemberToggle, { HouseholdViewOption } from '@/components/HouseholdMemberToggle';


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
  const { profile, currentTolerance, setTolerance, toleranceHistory, updateProfile, measurementSystem, doseUnitPreference, appFeatures, updateAppFeatures, reorderHorizon, updateReorderHorizon } = useProfile(user?.id);
  const { compounds, loading, hasCompounds, updateCompound, addCompound, deleteCompound, refetch } = useCompounds(user?.id);
  const household = useHousehold(user?.id);

  // Household view selection state
  const [householdViewId, setHouseholdViewId] = useState<string>('self');
  const selectedMemberUserId = household.acceptedMembers.find(m => m.userId === householdViewId)?.userId ?? null;
  const { compounds: memberCompounds } = useHouseholdMemberCompounds(
    householdViewId !== 'self' && householdViewId !== 'combined' ? householdViewId : null
  );

  // Realtime dose check-offs for household members (combined schedule view)
  const { memberCheckedDoses } = useHouseholdDoseCheckOffs(
    householdViewId === 'combined' ? household.acceptedMembers.map(m => m.userId) : []
  );

  // The active compound set depending on household view selection
  const viewCompounds = (() => {
    if (householdViewId === 'combined') return [...compounds, ...memberCompounds];
    if (selectedMemberUserId) return memberCompounds;
    return compounds;
  })();

  const handleHouseholdSelect = (option: HouseholdViewOption) => {
    setHouseholdViewId(option.id);
  };
  const { isDark, toggle } = useTheme();
  const { createGoals, updateGoal, deleteGoal, goals: fullGoals, fetchGoals: fetchFullGoals } = useGoals(user?.id);

  useEffect(() => { if (user?.id) fetchFullGoals(); }, [user?.id, fetchFullGoals]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showProtocolManager, setShowProtocolManager] = useState(false);
  const [showGoalExpansion, setShowGoalExpansion] = useState(false);
  const [showBiomarkerUpload, setShowBiomarkerUpload] = useState(false);
  const [labsRefreshKey, setLabsRefreshKey] = useState(0);
  const {
    protocols, createProtocol, deleteProtocol, cloneProtocol, updateProtocol,
    addCompoundToProtocol, removeCompoundFromProtocol, refetch: refetchProtocols,
    goals, protocolGoalLinks, linkGoalToProtocol, unlinkGoalFromProtocol, refetchGoals,
  } = useProtocols(user?.id);

  const { fields: customFields, values: customFieldValues, addField: addCustomField, removeField: removeCustomField, reorderField: reorderCustomField, setValue: setCustomFieldValue } = useCustomFields(user?.id);

  const { checkedDoses, toggleChecked: toggleDoseCheck } = useDoseCheckOffs();
  const { snapshots: scheduleSnapshots, loading: snapshotsLoading } = useScheduleSnapshots(compounds);
  const { checkedDosesMap: historicalCheckOffs } = useHistoricalCheckOffs();

  // Merge self + member checked doses for combined view display (after checkedDoses is declared)
  const combinedCheckedDoses = useMemo(() => {
    if (householdViewId !== 'combined') return checkedDoses;
    const merged = new Set(checkedDoses);
    memberCheckedDoses.forEach(memberSet => {
      memberSet.forEach(k => merged.add(k));
    });
    return merged;
  }, [householdViewId, checkedDoses, memberCheckedDoses]);

  // Build memberInitialsDoses for combined view initials badges
  // Maps first-initial of each member's display label -> their checked dose keys
  const memberInitialsDoses = useMemo(() => {
    if (householdViewId !== 'combined' || memberCheckedDoses.size === 0) return undefined;
    const result = new Map<string, Set<string>>();
    household.acceptedMembers.forEach(m => {
      const memberDoses = memberCheckedDoses.get(m.userId);
      if (!memberDoses) return;
      // Compute initials from display name or email
      const label = m.displayName || (m.email ? m.email.slice(0, m.email.indexOf('@') > 0 ? m.email.indexOf('@') : m.email.length) : 'M');
      const initial = label.charAt(0).toUpperCase();
      // If collision, use first two chars
      const key = result.has(initial) ? label.slice(0, 2).toUpperCase() : initial;
      result.set(key, memberDoses);
    });
    return result;
  }, [householdViewId, memberCheckedDoses, household.acceptedMembers]);


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
    undoChange: onUndoChange, confirmChange: onConfirmChange, pendingConfirm,
    setPendingConfirm,
    proposals: chatProposals,
  } = useProtocolChat(
    compounds, protocols, stackAnalysis, toleranceLevel, updateCompound, deleteCompound, refetch,
    conversationManager.activeConversationId,
    conversationManager.refreshConversation,
    conversationManager.renameConversation,
    ({ compoundId, field }) => {
      const cyclingFields = ['cycleOnDays', 'cycleOffDays', 'cycleStartDate'];
      if (cyclingFields.includes(field) && compoundId) {
        // Navigate to inventory stock tab and scroll to the compound card
        setActiveTab('inventory');
        setInventorySubTab('stock');
        setScrollToCompoundId(compoundId);
      } else {
        setActiveTab('schedule');
        setScheduleSubTab('ai-changes');
      }
    },
  );

  const [activeTab, setActiveTab] = useState('dashboard');
  const [scheduleSubTab, setScheduleSubTab] = useState('this-week');
  const [inventorySubTab, setInventorySubTab] = useState('stock');
  const [trackingSubTab, setTrackingSubTab] = useState('food');
  const [scrollToCompoundId, setScrollToCompoundId] = useState<string | null>(null);
  const [labsFlaggedCount, setLabsFlaggedCount] = useState(0);

  const scheduleSwipe = useSwipeTabs({ tabs: ['this-week', 'history', 'ai-changes'], currentTab: scheduleSubTab, onTabChange: setScheduleSubTab });
  const inventorySwipe = useSwipeTabs({ tabs: ['stock', 'costs', 'reorder'], currentTab: inventorySubTab, onTabChange: setInventorySubTab });
  const trackingSwipe = useSwipeTabs({ tabs: ['food', 'symptoms', 'labs'], currentTab: trackingSubTab, onTabChange: setTrackingSubTab });

  // Badge counts for low-stock alerts.
  // Must match ReorderView logic: only count compounds with a purchase date set
  // (no purchase date = depletion tracking unreliable, would inflate badges).
  const lowStockCounts = useMemo(() => {
    let inventoryWarnings = 0;
    let reorderNeeded = 0;
    compounds.forEach(c => {
      if (c.notes?.includes('[DORMANT]')) return;
      if (!c.purchaseDate || c.purchaseDate.trim() === '') return;
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
  }, [refetch, refetchProtocols]);

  const { containerRef, pullDistance, refreshing, isTriggered } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const handleUpdateCompound = (id: string, updates: Partial<Compound>) => {
    updateCompound(id, updates);
  };

  // Compute per-member annual/monthly cost estimates for the combined cost breakdown
  const memberCostBreakdowns = useMemo(() => {
    if (householdViewId !== 'combined' || household.acceptedMembers.length === 0) return undefined;

    const computeAnnual = (cmpds: Compound[]) => {
      return cmpds.reduce((sum, c) => {
        const effectiveDaily = getEffectiveDailyConsumption(c);
        if (effectiveDaily === 0) return sum;
        const monthlyConsumption = effectiveDaily * 30;
        if (c.category === 'peptide' && c.bacstatPerVial) {
          const kitsPerMonth = monthlyConsumption / c.bacstatPerVial / 10;
          return sum + kitsPerMonth * (c.kitPrice || 0) * 12;
        }
        const totalMgPerUnit = c.category === 'injectable-oil' && c.vialSizeMl
          ? c.unitSize * c.vialSizeMl : c.unitSize;
        const unitsPerMonth = totalMgPerUnit > 0 ? monthlyConsumption / totalMgPerUnit : 0;
        return sum + unitsPerMonth * c.unitPrice * 12;
      }, 0);
    };

    const selfAnnual = computeAnnual(compounds);
    const memberAnnual = computeAnnual(memberCompounds);

    const result: { name: string; annual: number; monthly: number }[] = [
      { name: profile?.display_name || 'Mine', annual: selfAnnual, monthly: selfAnnual / 12 },
    ];
    household.acceptedMembers.forEach((m, i) => {
      if (i === 0) {
        result.push({ name: m.displayName || 'Member', annual: memberAnnual, monthly: memberAnnual / 12 });
      }
    });
    return result;
  }, [householdViewId, compounds, memberCompounds, household.acceptedMembers, profile?.display_name]);

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

      {/* Pending household invite banner */}
      {household.pendingIncoming.length > 0 && (
        <div className="bg-accent/10 border-b border-accent/20 px-4 py-2">
          <div className="container mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-accent animate-pulse" />
              <p className="text-xs text-accent font-medium truncate">
                {household.pendingIncoming.length === 1
                  ? `${household.pendingIncoming[0].displayName || 'Someone'} invited you to their household`
                  : `${household.pendingIncoming.length} household invites pending`}
              </p>
            </div>
            <button
              onClick={() => setShowAccountSettings(true)}
              className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
            >
              Review
            </button>
          </div>
        </div>
      )}

      <header className="border-b border-border/50 px-4 py-2.5 sm:py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold tracking-tight truncate">
              <span className="text-gradient-cyan">PROTOCOL</span>
              <span className="text-muted-foreground font-medium ml-1.5 sm:ml-2 text-sm sm:text-xl">Guardian</span>
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
              pendingInviteCount={household.pendingIncoming.length}
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
              <Gauge className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span>Progress</span>
            </TabsTrigger>
            <TabsTrigger value="tracking" className="flex-1 flex-col sm:flex-row gap-0.5 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[9px] sm:text-xs py-1.5 sm:py-2.5">
              <LineChart className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span>Logging</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="relative flex-1 flex-col sm:flex-row gap-0.5 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[9px] sm:text-xs py-1.5 sm:py-2.5">
              <CalendarDays className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span>Protocol</span>
              {household.pendingIncoming.length > 0 && (
                <span className="absolute -top-1 -right-1 sm:top-0 sm:right-0 w-2.5 h-2.5 rounded-full bg-destructive ring-2 ring-background" />
              )}
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
            <TabsTrigger value="ai-insights" className="flex-1 flex-col sm:flex-row gap-0.5 sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[9px] sm:text-xs py-1.5 sm:py-2.5">
              <Brain className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span>AI</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="animate-slide-up">
            <TabErrorBoundary tabName="Home">
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
            </TabErrorBoundary>
          </TabsContent>
          <TabsContent value="outcomes" className="animate-slide-up">
            <TabErrorBoundary tabName="Progress">
            <OutcomesView userId={user?.id} goals={fullGoals} onRefreshGoals={fetchFullGoals} onUploadClick={() => setShowBiomarkerUpload(true)} profile={profile} measurementSystem={measurementSystem} onCreateGoal={createGoals} onUpdateGoal={updateGoal} onDeleteGoal={deleteGoal} />
            </TabErrorBoundary>
          </TabsContent>
          <TabsContent value="schedule" className="animate-slide-up">
            <TabErrorBoundary tabName="Protocol">
            {/* Household toggle for Schedule */}
            <HouseholdMemberToggle
              selfName={profile?.display_name || null}
              members={household.acceptedMembers}
              selectedIds={[householdViewId]}
              onSelect={handleHouseholdSelect}
            />
            <Tabs value={scheduleSubTab} onValueChange={setScheduleSubTab} className="w-full">
              <TabsList className="w-full bg-card/80 border border-border/60 mb-3 h-10 p-1 gap-1">
                <TabsTrigger value="this-week" className="flex-1 text-xs font-semibold rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all">This Week</TabsTrigger>
                <TabsTrigger value="history" className="flex-1 text-xs font-semibold rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all">History</TabsTrigger>
                <TabsTrigger value="ai-changes" className="flex-1 text-xs font-semibold rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all">AI Changes</TabsTrigger>
              </TabsList>
              <div key={scheduleSubTab} className={scheduleSwipe.slideClass} onAnimationEnd={scheduleSwipe.onAnimationEnd} onTouchStart={scheduleSwipe.onTouchStart} onTouchEnd={scheduleSwipe.onTouchEnd}>
                <TabsContent value="this-week" forceMount={scheduleSubTab === 'this-week' ? true : undefined}>
                  {scheduleSubTab === 'this-week' && <WeeklyScheduleView
                    compounds={viewCompounds}
                    protocols={protocols}
                    compoundAnalyses={compoundAnalyses}
                    compoundLoading={compoundLoading}
                    onAnalyzeCompound={analyzeCompound}
                    customFields={customFields}
                    customFieldValues={customFieldValues}
                    checkedDoses={combinedCheckedDoses}
                    onToggleChecked={householdViewId === 'self' ? toggleDoseCheck : () => {}}
                    readOnly={!!selectedMemberUserId}
                    readOnlyMemberName={selectedMemberUserId ? (household.acceptedMembers.find(m => m.userId === selectedMemberUserId)?.displayName || household.acceptedMembers.find(m => m.userId === selectedMemberUserId)?.email?.split('@')[0] || 'Member') : undefined}
                    onExitReadOnly={() => setHouseholdViewId('self')}
                    memberInitialsDoses={memberInitialsDoses}
                    memberCompoundIds={householdViewId === 'combined' ? new Set(memberCompounds.map(c => c.id)) : undefined}
                  />}
                </TabsContent>
                <TabsContent value="history" forceMount={scheduleSubTab === 'history' ? true : undefined}>
                  {scheduleSubTab === 'history' && <ScheduleHistoryView snapshots={scheduleSnapshots} loading={snapshotsLoading} checkedDosesMap={historicalCheckOffs} />}
                </TabsContent>
                <TabsContent value="ai-changes" forceMount={scheduleSubTab === 'ai-changes' ? true : undefined}>
                  {scheduleSubTab === 'ai-changes' && <ProtocolChangeHistoryView compounds={compounds} updateCompound={updateCompound} refetch={refetch} userId={user?.id} onOpenChat={() => setActiveTab('ai-insights')} />}
                </TabsContent>
              </div>
            </Tabs>
            </TabErrorBoundary>
          </TabsContent>
          <TabsContent value="inventory" className="animate-slide-up">
            <TabErrorBoundary tabName="Inventory">
            {/* Household toggle for Inventory/Costs/Reorder */}
            <HouseholdMemberToggle
              selfName={profile?.display_name || null}
              members={household.acceptedMembers}
              selectedIds={[householdViewId]}
              onSelect={handleHouseholdSelect}
            />
            {/* Combined label for costs header */}
            {householdViewId === 'combined' && (
              <div className="mb-2 px-2 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-[11px] text-accent font-medium">
                Showing combined household data — {[profile?.display_name || 'Mine', ...household.acceptedMembers.map(m => m.displayName || 'Member')].join(' + ')}
              </div>
            )}
            <Tabs value={inventorySubTab} onValueChange={setInventorySubTab} className="w-full">
              <TabsList className="w-full bg-card/80 border border-border/60 mb-3 h-10 p-1 gap-1">
                <TabsTrigger value="stock" className="flex-1 text-xs font-semibold rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all">Stock</TabsTrigger>
                <TabsTrigger value="costs" className="flex-1 text-xs font-semibold rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all">Costs</TabsTrigger>
                <TabsTrigger value="reorder" className="relative flex-1 text-xs font-semibold rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all">
                  Reorder
                  {lowStockCounts.reorder > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                      {lowStockCounts.reorder}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <div key={inventorySubTab} className={inventorySwipe.slideClass} onAnimationEnd={inventorySwipe.onAnimationEnd} onTouchStart={inventorySwipe.onTouchStart} onTouchEnd={inventorySwipe.onTouchEnd}>
                <TabsContent value="stock" forceMount={inventorySubTab === 'stock' ? true : undefined}>
                  {inventorySubTab === 'stock' && <InventoryView
                    compounds={viewCompounds}
                    onUpdateCompound={householdViewId === 'self' ? handleUpdateCompound : () => {}}
                    onDeleteCompound={householdViewId === 'self' ? deleteCompound : undefined}
                    onAddCompound={householdViewId === 'self' ? () => setShowAddDialog(true) : undefined}
                    protocols={protocols}
                    toleranceLevel={toleranceLevel}
                    onToleranceChange={handleToleranceChange}
                    customFields={customFields}
                    customFieldValues={customFieldValues}
                    onAddCustomField={householdViewId === 'self' ? addCustomField : undefined}
                    onRemoveCustomField={householdViewId === 'self' ? removeCustomField : undefined}
                    onReorderCustomField={householdViewId === 'self' ? reorderCustomField : undefined}
                    onSetCustomFieldValue={householdViewId === 'self' ? setCustomFieldValue : undefined}
                    scrollToCompoundId={scrollToCompoundId}
                    onScrollToCompoundDone={() => setScrollToCompoundId(null)}
                  />}
                </TabsContent>
                <TabsContent value="costs" forceMount={inventorySubTab === 'costs' ? true : undefined}>
                  {inventorySubTab === 'costs' && <CostProjectionView compounds={viewCompounds} protocols={protocols} customFields={customFields} customFieldValues={customFieldValues} userId={user?.id} memberBreakdowns={memberCostBreakdowns} />}
                </TabsContent>
                <TabsContent value="reorder" forceMount={inventorySubTab === 'reorder' ? true : undefined}>
                  {inventorySubTab === 'reorder' && <ReorderView compounds={viewCompounds} onUpdateCompound={householdViewId === 'self' ? handleUpdateCompound : () => {}} userId={user?.id} protocols={protocols} reorderHorizon={reorderHorizon} onHorizonChange={updateReorderHorizon} />}
                </TabsContent>
              </div>
            </Tabs>
            </TabErrorBoundary>
          </TabsContent>
          <TabsContent value="tracking" className="animate-slide-up">
            <TabErrorBoundary tabName="Logging">
            <Tabs value={trackingSubTab} onValueChange={setTrackingSubTab} className="w-full">
              <TabsList className="w-full bg-card/80 border border-border/60 mb-3 h-10 p-1 gap-1">
                <TabsTrigger value="food" className="flex-1 text-xs font-semibold rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all">Food</TabsTrigger>
                <TabsTrigger value="symptoms" className="flex-1 text-xs font-semibold rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all">Symptoms</TabsTrigger>
                <TabsTrigger value="labs" className="relative flex-1 text-xs font-semibold rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all">
                  Labs
                  {labsFlaggedCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-status-warning text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                      {labsFlaggedCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <div key={trackingSubTab} className={trackingSwipe.slideClass} onAnimationEnd={trackingSwipe.onAnimationEnd} onTouchStart={trackingSwipe.onTouchStart} onTouchEnd={trackingSwipe.onTouchEnd}>
                <TabsContent value="food" forceMount={trackingSubTab === 'food' ? true : undefined}>
                  {trackingSubTab === 'food' && <FoodTrackerView />}
                </TabsContent>
                <TabsContent value="symptoms" forceMount={trackingSubTab === 'symptoms' ? true : undefined}>
                  {trackingSubTab === 'symptoms' && <SymptomsTrackerView />}
                </TabsContent>
                <TabsContent value="labs" forceMount={trackingSubTab === 'labs' ? true : undefined}>
                  {trackingSubTab === 'labs' && (
                    <BiomarkerHistoryView
                      key={labsRefreshKey}
                      userId={user?.id}
                      onUploadClick={() => setShowBiomarkerUpload(true)}
                      onFlaggedCountChange={setLabsFlaggedCount}
                      goals={fullGoals}
                      onCreateGoal={createGoals}
                      onRefreshGoals={fetchFullGoals}
                      profile={profile}
                    />
                  )}
                </TabsContent>
              </div>
            </Tabs>
            </TabErrorBoundary>
          </TabsContent>
          <TabsContent value="ai-insights" className="animate-slide-up">
            <TabErrorBoundary tabName="AI">
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
              onUndoChange={onUndoChange}
              onConfirmChange={onConfirmChange}
              onCancelConfirm={() => setPendingConfirm(null)}
              pendingConfirm={pendingConfirm}
              proposals={chatProposals}
              compounds={compounds}
              conversationManager={conversationManager}
              toleranceComparison={toleranceComparison}
              compareLoading={compareLoading}
              onCompareAllLevels={compareAllLevels}
            />
            </TabErrorBoundary>
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
          onReadingsCreated={() => { fetchFullGoals(); setLabsRefreshKey(k => k + 1); }}
        />

        <AccountSettingsDialog
          open={showAccountSettings}
          onOpenChange={setShowAccountSettings}
          userId={user?.id}
          displayName={profile?.display_name}
          userEmail={user?.email}
          profileAge={profile?.age}
          profileHeightCm={profile?.height_cm}
          profileWeightKg={profile?.weight_kg}
          profileGender={profile?.gender}
          measurementSystem={measurementSystem}
          onResetComplete={() => {
            setShowOnboarding(true);
            refetch();
          }}
          onStartTour={() => setShowGuidedTour(true)}
          onUpdateDisplayName={async (name) => {
            await updateProfile({ display_name: name });
          }}
          onUpdateProfile={async (updates) => {
            await updateProfile(updates as any);
          }}
          householdMembers={household.members}
          householdPendingIncoming={household.pendingIncoming}
          householdPendingOutgoing={household.pendingOutgoing}
          householdLoading={household.loading}
          onSendHouseholdInvite={household.sendInvite}
          onAcceptHouseholdInvite={household.acceptInvite}
          onRejectHouseholdInvite={household.rejectInvite}
          onRemoveHouseholdMember={household.removeLink}
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
