# Protocol Guardian — Full Source Export

All files below are raw source copies downloadable at:
`https://superhumanprotocol.lovable.app/exports/<filename>`

## Source Files

| # | File | Original Path | Lines |
|---|------|---------------|-------|
| 1 | `useCompounds.ts` | src/hooks/useCompounds.ts | 316 |
| 2 | `Index.tsx` | src/pages/Index.tsx | 916 |
| 3 | `InventoryView.tsx` | src/components/InventoryView.tsx | 2569 |
| 4 | `WeeklyScheduleView.tsx` | src/components/WeeklyScheduleView.tsx | 1237 |
| 5 | `deliveryMethods.ts` | src/data/deliveryMethods.ts | 607 |
| 6 | `schedule.ts` | src/data/schedule.ts | 250 |
| 7 | `scheduleGenerator.ts` | src/lib/scheduleGenerator.ts | 194 |
| 8 | `supabase-client.ts` | src/integrations/supabase/client.ts | 17 |
| 9 | `package.json` | package.json | 105 |
| 10 | `CostProjectionView.tsx` | src/components/CostProjectionView.tsx | 510 |
| 11 | `ReorderView.tsx` | src/components/ReorderView.tsx | 1392 |
| 12 | `CompoundCardV2.tsx` | src/components/compound-wizard/CompoundCardV2.tsx | 367 |
| 13 | `wizard-types.ts` | src/components/compound-wizard/types.ts | 465 |
| 14 | `useWizardMachine.ts` | src/components/compound-wizard/useWizardMachine.ts | 109 |
| 15 | `doseResolver.ts` | src/components/compound-wizard/doseResolver.ts | 186 |
| 16 | `WizardProgress.tsx` | src/components/compound-wizard/WizardProgress.tsx | 84 |
| 17 | `StepIdentity.tsx` | src/components/compound-wizard/steps/StepIdentity.tsx | 128 |
| 18 | `StepConfiguration.tsx` | src/components/compound-wizard/steps/StepConfiguration.tsx | 387 |
| 19 | `StepDosing.tsx` | src/components/compound-wizard/steps/StepDosing.tsx | 238 |
| 20 | `StepCycling.tsx` | src/components/compound-wizard/steps/StepCycling.tsx | 156 |
| 21 | `StepInventory.tsx` | src/components/compound-wizard/steps/StepInventory.tsx | 212 |
| 22 | `StepReview.tsx` | src/components/compound-wizard/steps/StepReview.tsx | 216 |
| 23 | `supabase-types.ts` | src/integrations/supabase/types.ts | 1731 |

---

## Grep F: complianceDoseOffset / compliance_dose_offset

**6 files, 70 matches:**

- `src/data/compounds.ts` — Compound interface definition (line 41), getConsumedSinceDate offset subtraction (line 197)
- `src/hooks/useCompounds.ts` — DB→app mapping (line 112), app→DB mapping (line 228)
- `src/components/InventoryView.tsx` — Full edit save restock reset (line 801), inline editor restock reset (line 2377)
- `src/components/ReorderView.tsx` — Mark received reset (line 360), undo received restore (lines 378-384)
- `src/components/compound-wizard/types.ts` — Schema audit comment (line 38)
- `src/integrations/supabase/types.ts` — Row/Insert/Update type definitions

## Grep G: purchaseDate / purchase_date

**11 files, 443 matches** — key locations:

- `src/components/InventoryView.tsx` — Restock sets `purchaseDate = today` alongside offset (lines 802, 857, 2376)
- `src/components/ReorderView.tsx` — Mark received sets `purchaseDate = today` (line 359, 383)
- `src/hooks/useCompounds.ts` — DB mapping (line 100, 222, 287)
- `src/data/compounds.ts` — Compound interface, getConsumedSinceDate, getDaysRemaining
- `src/lib/cycling.ts` — getDaysRemainingWithCycling
- `src/hooks/useHousehold.ts` — Household compound mapping (line 226)
- `src/components/compound-wizard/CompoundCardV2.tsx` — Sets purchaseDate to today on save (line 174)

---

## SQL Queries (run in Lovable Cloud backend)

### A. Full Schema
```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

### B. Constraints + Foreign Keys
```sql
SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
       kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;
```

### C. RPC/Function Bodies
```sql
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
```

### D. All Triggers
```sql
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

### E. All RLS Policies
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## File Tree (src/hooks, src/components, src/lib)

```
src/hooks/use-mobile.tsx
src/hooks/use-toast.ts
src/hooks/useActivityTracker.ts
src/hooks/useAdminRole.ts
src/hooks/useAuth.ts
src/hooks/useComplianceData.ts
src/hooks/useComplianceTrend.ts
src/hooks/useCompounds.ts
src/hooks/useConversations.ts
src/hooks/useCustomFields.ts
src/hooks/useDoseCheckOffs.ts
src/hooks/useGoalReadings.ts
src/hooks/useGoals.ts
src/hooks/useHealthData.ts
src/hooks/useHistoricalCheckOffs.ts
src/hooks/useHousehold.ts
src/hooks/useHouseholdDoseCheckOffs.ts
src/hooks/useProfile.ts
src/hooks/useProtocolAnalysis.ts
src/hooks/useProtocolChat.ts
src/hooks/useProtocols.ts
src/hooks/usePullToRefresh.ts
src/hooks/useScheduleSnapshots.ts
src/hooks/useSwipeTabs.ts
src/hooks/useTheme.ts
src/hooks/useTitration.ts
src/components/AccountSettingsDialog.tsx
src/components/AddCompoundDialog.tsx
src/components/AddGoalDialog.tsx
src/components/AdminUserDrawer.tsx
src/components/AIInsightsView.tsx
src/components/AlignToGoalDialog.tsx
src/components/AvgSessionChart.tsx
src/components/BackToTopButton.tsx
src/components/BiomarkerComparisonChart.tsx
src/components/BiomarkerHistoryView.tsx
src/components/BiomarkerUploadDialog.tsx
src/components/ChatMarkdown.tsx
src/components/ChatSidebar.tsx
src/components/ComplianceTrendChart.tsx
src/components/CompoundAISection.tsx
src/components/CompoundInfoDrawer.tsx
src/components/CompoundingCalculator.tsx
src/components/CompoundScoreDrawer.tsx
src/components/ConfidenceBadge.tsx
src/components/ConfirmDialog.tsx
src/components/CostProjectionView.tsx
src/components/CycleTimelineBar.tsx
src/components/DailyCompletionCelebration.tsx
src/components/DashboardView.tsx
src/components/DatePickerInput.tsx
src/components/DauChart.tsx
src/components/DexaScanView.tsx
src/components/FeatureManagerDialog.tsx
src/components/FeatureSelectionStep.tsx
src/components/FeatureTeaserCard.tsx
src/components/FloatingShareButton.tsx
src/components/FoodTrackerView.tsx
src/components/GeminiBadge.tsx
src/components/GenderSelector.tsx
src/components/GeometricBody.tsx
src/components/GoalAIChat.tsx
src/components/GoalCardChat.tsx
src/components/GoalCelebration.tsx
src/components/GoalExpansionDialog.tsx
src/components/GoalInterview.tsx
src/components/GuidedTour.tsx
src/components/HeaderQuickActions.tsx
src/components/HealthRings.tsx
src/components/HouseholdMemberToggle.tsx
src/components/HouseholdSyncPanel.tsx
src/components/InfoTooltip.tsx
src/components/InventoryView.tsx
src/components/MedicalDisclaimer.tsx
src/components/MiniSparkline.tsx
src/components/NavLink.tsx
src/components/OutcomesView.tsx
src/components/ProfileDropdown.tsx
src/components/ProtocolChangeConfirmSheet.tsx
src/components/ProtocolChangeHistoryView.tsx
src/components/ProtocolChat.tsx
src/components/ProtocolIcon.tsx
src/components/ProtocolIntelligenceCard.tsx
src/components/ProtocolManagerDialog.tsx
src/components/ProtocolOutcomesCard.tsx
src/components/QuickActionsFAB.tsx
src/components/QuickInviteDialog.tsx
src/components/RadialProgressRings.tsx
src/components/ReorderView.tsx
src/components/ScheduleHistoryView.tsx
src/components/SymptomHeatmapView.tsx
src/components/SymptomsTrackerView.tsx
src/components/TabErrorBoundary.tsx
src/components/TitrationBanner.tsx
src/components/TitrationScheduleDialog.tsx
src/components/TitrationTimelineSection.tsx
src/components/TitrationView.tsx
src/components/ToleranceSelector.tsx
src/components/WeeklyNutritionView.tsx
src/components/WeeklyRingHistory.tsx
src/components/WeeklyScheduleView.tsx
src/components/WhatsNewOverlay.tsx
src/components/ZoneDetailDrawer.tsx
src/components/compound-wizard/CompoundCardV2.tsx
src/components/compound-wizard/doseResolver.ts
src/components/compound-wizard/types.ts
src/components/compound-wizard/useWizardMachine.ts
src/components/compound-wizard/WizardProgress.tsx
src/components/compound-wizard/steps/StepConfiguration.tsx
src/components/compound-wizard/steps/StepCycling.tsx
src/components/compound-wizard/steps/StepDosing.tsx
src/components/compound-wizard/steps/StepIdentity.tsx
src/components/compound-wizard/steps/StepInventory.tsx
src/components/compound-wizard/steps/StepReview.tsx
src/lib/appFeatures.ts
src/lib/biomarkerReferenceRanges.ts
src/lib/cycling.ts
src/lib/goalIcons.tsx
src/lib/iconMap.ts
src/lib/measurements.ts
src/lib/scheduleGenerator.ts
src/lib/utils.ts
```

## Edge Functions

```
supabase/functions/analyze-protocol/
supabase/functions/compound-score-chat/
supabase/functions/create-lab-bucket/
supabase/functions/daily-insight/
supabase/functions/delete-account/
supabase/functions/generate-body-illustration/
supabase/functions/generate-title/
supabase/functions/goal-expand/
supabase/functions/goal-interview/
supabase/functions/goal-refine/
supabase/functions/parse-biomarkers/
supabase/functions/parse-food-image/
supabase/functions/personalized-scores/
supabase/functions/send-household-invite/
supabase/functions/symptom-analysis/
supabase/functions/zone-optimizer/
```
