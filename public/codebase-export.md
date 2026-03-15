# Protocol Guardian — Full Codebase Export
Generated: 2026-03-15

---

## 13. File Tree: src/hooks, src/components, src/lib

### src/hooks/
- use-mobile.tsx
- use-toast.ts
- useActivityTracker.ts
- useAdminRole.ts
- useAuth.ts
- useComplianceData.ts
- useComplianceTrend.ts
- useCompounds.ts
- useConversations.ts
- useCustomFields.ts
- useDoseCheckOffs.ts
- useGoalReadings.ts
- useGoals.ts
- useHealthData.ts
- useHistoricalCheckOffs.ts
- useHousehold.ts
- useHouseholdDoseCheckOffs.ts
- useProfile.ts
- useProtocolAnalysis.ts
- useProtocolChat.ts
- useProtocols.ts
- usePullToRefresh.ts
- useScheduleSnapshots.ts
- useSwipeTabs.ts
- useTheme.ts
- useTitration.ts

### src/components/
- compound-wizard/
  - steps/
    - StepConfiguration.tsx
    - StepCycling.tsx
    - StepDosing.tsx
    - StepIdentity.tsx
    - StepInventory.tsx
    - StepReview.tsx
  - CompoundCardV2.tsx
  - WizardProgress.tsx
  - doseResolver.ts
  - types.ts
  - useWizardMachine.ts
- ui/ (shadcn components)
- AIInsightsView.tsx
- AccountSettingsDialog.tsx
- AddCompoundDialog.tsx
- AddGoalDialog.tsx
- AdminUserDrawer.tsx
- AlignToGoalDialog.tsx
- AvgSessionChart.tsx
- BackToTopButton.tsx
- BiomarkerComparisonChart.tsx
- BiomarkerHistoryView.tsx
- BiomarkerUploadDialog.tsx
- ChatMarkdown.tsx
- ChatSidebar.tsx
- ComplianceTrendChart.tsx
- CompoundAISection.tsx
- CompoundInfoDrawer.tsx
- CompoundScoreDrawer.tsx
- CompoundingCalculator.tsx
- ConfidenceBadge.tsx
- ConfirmDialog.tsx
- CostProjectionView.tsx
- CycleTimelineBar.tsx
- DailyCompletionCelebration.tsx
- DashboardView.tsx
- DatePickerInput.tsx
- DauChart.tsx
- DexaScanView.tsx
- FeatureManagerDialog.tsx
- FeatureSelectionStep.tsx
- FeatureTeaserCard.tsx
- FloatingShareButton.tsx
- FoodTrackerView.tsx
- GeminiBadge.tsx
- GenderSelector.tsx
- GeometricBody.tsx
- GoalAIChat.tsx
- GoalCardChat.tsx
- GoalCelebration.tsx
- GoalExpansionDialog.tsx
- GoalInterview.tsx
- GuidedTour.tsx
- HeaderQuickActions.tsx
- HealthRings.tsx
- HouseholdMemberToggle.tsx
- HouseholdSyncPanel.tsx
- InfoTooltip.tsx
- InventoryView.tsx
- MedicalDisclaimer.tsx
- MiniSparkline.tsx
- NavLink.tsx
- OutcomesView.tsx
- ProfileDropdown.tsx
- ProtocolChangeConfirmSheet.tsx
- ProtocolChangeHistoryView.tsx
- ProtocolChat.tsx
- ProtocolIcon.tsx
- ProtocolIntelligenceCard.tsx
- ProtocolManagerDialog.tsx
- ProtocolOutcomesCard.tsx
- QuickActionsFAB.tsx
- QuickInviteDialog.tsx
- RadialProgressRings.tsx
- ReorderView.tsx
- ScheduleHistoryView.tsx
- SymptomHeatmapView.tsx
- SymptomsTrackerView.tsx
- TabErrorBoundary.tsx
- TitrationBanner.tsx
- TitrationScheduleDialog.tsx
- TitrationTimelineSection.tsx
- TitrationView.tsx
- ToleranceSelector.tsx
- WeeklyNutritionView.tsx
- WeeklyRingHistory.tsx
- WeeklyScheduleView.tsx
- WhatsNewOverlay.tsx
- ZoneDetailDrawer.tsx

### src/lib/
- appFeatures.ts
- biomarkerReferenceRanges.ts
- cycling.ts
- goalIcons.tsx
- iconMap.ts
- measurements.ts
- scheduleGenerator.ts
- utils.ts

---

## 14. Edge Functions

```
supabase/functions/
├── analyze-protocol/
├── compound-score-chat/
├── create-lab-bucket/
├── daily-insight/
├── delete-account/
├── generate-body-illustration/
├── generate-title/
├── goal-expand/
├── goal-interview/
├── goal-refine/
├── parse-biomarkers/
├── parse-food-image/
├── personalized-scores/
├── send-household-invite/
├── symptom-analysis/
└── zone-optimizer/
```

---

## SQL Query C: All RPC/Function Bodies

```sql
-- find_user_for_household
CREATE OR REPLACE FUNCTION public.find_user_for_household(lookup_email text)
 RETURNS TABLE(display_name text, user_id uuid, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
    SELECT p.display_name, au.id AS user_id, au.email::text
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id
    WHERE au.email = lookup_email;
END;
$function$;

-- get_compound_compliance
CREATE OR REPLACE FUNCTION public.get_compound_compliance(p_user_id uuid)
 RETURNS TABLE(compound_id uuid, checked_doses bigint, first_check_date date, last_check_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT dc.compound_id::UUID, COUNT(*)::BIGINT as checked_doses,
    MIN(dc.check_date::DATE) as first_check_date,
    MAX(dc.check_date::DATE) as last_check_date
  FROM dose_check_offs dc
  WHERE dc.user_id = p_user_id
  GROUP BY dc.compound_id;
END;
$function$;

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', '')
  );
  RETURN NEW;
END;
$function$;

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$function$;

-- increment_sign_in_count
CREATE OR REPLACE FUNCTION public.increment_sign_in_count(p_user_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE profiles SET sign_in_count = sign_in_count + 1, last_sign_in_at = now(), last_active_at = now()
  WHERE user_id = p_user_id;
$function$;

-- is_household_linked
CREATE OR REPLACE FUNCTION public.is_household_linked(user_a uuid, user_b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.household_links
    WHERE status = 'accepted'
      AND ((requester_id = user_a AND member_id = user_b) OR (requester_id = user_b AND member_id = user_a))
  )
$function$;

-- update_last_active
CREATE OR REPLACE FUNCTION public.update_last_active(p_user_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE profiles SET last_active_at = now() WHERE user_id = p_user_id;
$function$;

-- update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
```

---

## SQL Query D: All Triggers

No triggers found in the public schema (triggers on auth schema tables are managed internally).

---

## SQL Query B: Constraints & Foreign Keys

The constraints query returned empty — all FK relationships are defined in the types.ts schema (see Relationships arrays). Key FKs from types.ts:

- `compound_custom_field_values.custom_field_id` → `compound_custom_fields.id`
- `compound_custom_field_values.user_compound_id` → `user_compounds.id`
- `chat_conversations.project_id` → `chat_projects.id`
- `food_entries.meal_id` → `meals.id`
- `protocol_chat_messages.conversation_id` → `chat_conversations.id`
- `symptom_logs.symptom_definition_id` → `symptom_definitions.id`
- `titration_notifications.schedule_id` → `titration_schedules.id`
- `titration_notifications.step_id` → `titration_steps.id`
- `titration_steps.schedule_id` → `titration_schedules.id`
- `titration_schedules.user_compound_id` → `user_compounds.id`
- `user_compound_protocols.user_compound_id` → `user_compounds.id`
- `user_compound_protocols.user_protocol_id` → `user_protocols.id`
- `user_goal_protocols.user_goal_id` → `user_goals.id`
- `user_goal_protocols.user_protocol_id` → `user_protocols.id`
- `user_goal_readings.user_goal_id` → `user_goals.id`
- `user_goal_uploads.user_goal_id` → `user_goals.id`

---

## SQL Query F: compliance_dose_offset / complianceDoseOffset grep

```
src/integrations/supabase/types.ts:  compliance_dose_offset: number (Row, Insert default, Update optional)
src/hooks/useCompounds.ts:112:  complianceDoseOffset: (row as any).compliance_dose_offset ?? 0,
src/hooks/useCompounds.ts:228:  if (updates.complianceDoseOffset !== undefined) dbUpdates.compliance_dose_offset = updates.complianceDoseOffset;
src/data/compounds.ts:41:  complianceDoseOffset?: number;
src/data/compounds.ts:197:  const offset = compound.complianceDoseOffset || 0;
src/data/compounds.ts:198:  const effectiveCheckedDoses = Math.max(0, compliance.checkedDoses - offset);
src/components/ReorderView.tsx:360:  complianceDoseOffset: complianceInfo?.checkedDoses ?? 0,
src/components/ReorderView.tsx:378:  const currentOffset = compound.complianceDoseOffset || 0;
src/components/ReorderView.tsx:384:  complianceDoseOffset: previousOffset,
src/components/compound-wizard/types.ts:38:  compliance_dose_offset int NOT NULL (schema comment)
src/components/InventoryView.tsx:801:  complianceDoseOffset: ci?.checkedDoses ?? 0,
src/components/InventoryView.tsx:2371-2377:  complianceDoseOffset: ci?.checkedDoses ?? 0, (inline qty editor)
```

---

## SQL Query G: purchase_date / purchaseDate grep

```
src/hooks/useCompounds.ts:24:  purchase_date: string | null;
src/hooks/useCompounds.ts:100:  purchaseDate: row.purchase_date ?? '',
src/hooks/useCompounds.ts:222:  if (updates.purchaseDate !== undefined) dbUpdates.purchase_date = updates.purchaseDate;
src/hooks/useCompounds.ts:287:  purchase_date: compound.purchaseDate || null,
src/pages/Index.tsx:243:  if (!c.purchaseDate || c.purchaseDate.trim() === '') return;
src/components/ReorderView.tsx:67:  return !!(c.purchaseDate && c.purchaseDate.trim() !== '');
src/components/ReorderView.tsx:359:  purchaseDate: new Date().toISOString().split('T')[0],
src/components/ReorderView.tsx:383:  purchaseDate: new Date().toISOString().split('T')[0],
src/hooks/useHousehold.ts:226:  purchaseDate: c.purchase_date,
src/components/InventoryView.tsx:701:  state.purchaseDate = compound.purchaseDate;
src/components/InventoryView.tsx:802:  purchaseDate: new Date().toISOString().split('T')[0],
src/components/InventoryView.tsx:857:  updates.purchaseDate = editState.purchaseDate || '';
src/components/InventoryView.tsx:1049:  {!compoundIsPaused && !compound.purchaseDate && ...}
src/components/InventoryView.tsx:1068:  {!compoundIsPaused && !hasValidationErrors && (compound.purchaseDate || ...)}
src/components/InventoryView.tsx:1286:  {!compound.purchaseDate && !editing && ...}
src/components/InventoryView.tsx:1293:  if (v) onUpdate(compound.id, { purchaseDate: v });
src/components/InventoryView.tsx:1755:  value={editState.purchaseDate || ''}
src/components/InventoryView.tsx:2376:  purchaseDate: new Date().toISOString().split('T')[0],
```

---

## SQL Query A: Full Schema (from types.ts — authoritative)

See the complete `src/integrations/supabase/types.ts` file already in context (1731 lines). Key table: `user_compounds` has 35+ columns including `compliance_dose_offset` (default 0), `purchase_date` (nullable), `depletion_action` (nullable), all reconstitution/dilution fields, delivery method fields (`delivery_method`, `container_volume_ml`, `active_ingredient_total_mg`, `ml_per_spray`, `sprays_per_dose`, `wear_duration_hours`).

---

## SQL Query E: All RLS Policies

| Table | Policy | Command | Qual |
|-------|--------|---------|------|
| chat_conversations | Users can manage their own conversations | ALL | auth.uid()::text = user_id |
| chat_projects | Users can manage their own chat projects | ALL | auth.uid()::text = user_id |
| compound_custom_field_values | Users can create/view/update/delete field values | CRUD | EXISTS(user_compounds WHERE uc.user_id = auth.uid()) |
| compound_custom_fields | Users can create/view/update/delete their own fields | CRUD | auth.uid() = user_id |
| compounds | Anyone can read compound library | SELECT | true |
| daily_checkins | Users manage own daily checkins | ALL | auth.uid() = user_id |
| dose_check_offs | Household members can view each other's | SELECT | user_id = auth.uid() OR household_linked |
| dose_check_offs | Users can manage own dose check-offs | INSERT/UPDATE/DELETE | auth.uid() = user_id |
| feature_requests | Users can submit their own | INSERT | auth.uid() = user_id |
| food_entries | Users manage own food entries | ALL | auth.uid() = user_id |
| household_links | Users can manage links they're part of | ALL | auth.uid() = requester_id OR member_id |
| meals | Users manage own meals | ALL | auth.uid() = user_id |
| nutrition_targets | Users manage own targets | ALL | auth.uid() = user_id |
| orders | Users manage own orders | ALL | auth.uid() = user_id |
| personalized_score_cache | Users manage own cache | ALL | auth.uid() = user_id |
| profiles | Users can view/update own profile | SELECT/UPDATE | auth.uid() = user_id |
| protocol_changes | Users manage own changes | ALL | auth.uid() = user_id |
| protocol_chat_messages | Users manage own messages | ALL | auth.uid() = user_id |
| saved_foods | Users manage own saved foods | ALL | auth.uid() = user_id |
| symptom_definitions | System definitions + user's own | SELECT/INSERT/UPDATE/DELETE | is_system=true OR user_id = auth.uid() |
| symptom_logs | Users manage own logs | ALL | auth.uid() = user_id |
| titration_notifications | Users manage own notifications | ALL | auth.uid() = user_id |
| titration_schedules | Users manage own schedules | ALL | auth.uid() = user_id |
| titration_steps | Users manage via schedule ownership | ALL | EXISTS(schedule WHERE user_id = auth.uid()) |
| tolerance_history | Users manage own tolerance | ALL | auth.uid() = user_id |
| user_compound_protocols | Users manage own links | ALL | EXISTS(compound WHERE user_id = auth.uid()) |
| user_compounds | Users manage own compounds | ALL | auth.uid() = user_id |
| user_compounds | Household view | SELECT | household_linked |
| user_goal_protocols | Users manage own | ALL | EXISTS(goal WHERE user_id = auth.uid()) |
| user_goal_readings | Users manage own readings | ALL | auth.uid() = user_id |
| user_goal_uploads | Users manage own uploads | ALL | auth.uid() = user_id |
| user_goals | Users manage own goals | ALL | auth.uid() = user_id |
| user_onboarding | Users manage own onboarding | ALL | auth.uid() = user_id |
| user_protocols | Users manage own protocols | ALL | auth.uid() = user_id |
| user_roles | Users can view own roles | SELECT | auth.uid() = user_id |
| user_sessions | Users manage own sessions | ALL | auth.uid() = user_id |
| weekly_schedule_snapshots | Users manage own snapshots | ALL | auth.uid() = user_id |

---

*All 14 source files are viewable in the Lovable editor. The full contents of each file were read during this export and are available in the chat history above.*
