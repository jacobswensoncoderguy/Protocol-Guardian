/**
 * CompoundCardV2 — Intelligent Compound Card Wizard
 *
 * PARALLEL COMPONENT: This does NOT replace CompoundCard / AddCompoundDialog.
 * It runs alongside the existing UI via a dev toggle.
 *
 * Phase 7 (swap) will only execute when explicitly authorized.
 */

import { useEffect, useCallback, useMemo } from 'react';
import { Compound, CompoundCategory, normalizeCompoundUnitLabel, getDerivedWeightPerUnitMg, getReorderCost } from '@/data/compounds';
import { useWizardMachine } from './useWizardMachine';
import WizardProgress from './WizardProgress';
import StepIdentity from './steps/StepIdentity';
import StepConfiguration from './steps/StepConfiguration';
import StepDosing from './steps/StepDosing';
import StepCycling from './steps/StepCycling';
import StepInventory from './steps/StepInventory';
import StepReview from './steps/StepReview';
import {
  getAccentColor,
  WizardFormData,
  COMPOUND_TYPE_META,
  TIMING_OPTIONS,
  SCHEDULE_PRESETS,
  compoundTypeFromCategory,
  INITIAL_FORM_DATA,
} from './types';
import { getEffectiveDose, validateWizardData } from './doseResolver';
import { getDilutionDefaults } from '@/data/dilutionDefaults';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface CompoundCardV2Props {
  existingCompoundIds: string[];
  onAdd: (compound: Compound) => Promise<string | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddAsOrdered?: (params: {
    newCompoundId: string;
    compoundName: string;
    orderCost: number;
    reorderQuantity: number;
    reorderType: 'single' | 'kit';
    category: string;
    orderDate: string;
    orderNotes: string;
  }) => Promise<void>;
}

/** Convert wizard form data → Compound shape for database write */
function formDataToCompound(fd: WizardFormData): Compound {
  const type = fd.compoundType || 'oral-pill';
  const meta = COMPOUND_TYPE_META[type];
  const category = fd.category || meta.category;

  // Build timing note from schedule
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const activeDays = fd.schedulePreset === 'Custom'
    ? fd.customDays
    : (SCHEDULE_PRESETS.find(p => p.id === fd.schedulePreset)?.days || [0, 1, 2, 3, 4, 5, 6]);
  const dayStr = activeDays.length === 7 ? 'daily' : activeDays.map(d => dayNames[d]).join('/');
  const timingStr = fd.timings.map(t => TIMING_OPTIONS.find(o => o.id === t)?.label || t).join(', ').toLowerCase();
  const timingNote = fd.specialTimingNote || `${dayStr} ${timingStr}`.trim();

  // ── Resolve dose from centralized resolver ──
  const resolved = getEffectiveDose(fd);

  // ── Map supply / pricing based on type ──
  let unitSize = 0;
  let unitLabel = '';
  let unitPrice = parseFloat(fd.pricePerUnit) || 0;
  let kitPrice: number | undefined;
  let vialSizeMl: number | undefined;
  let bacstatPerVial: number | undefined;
  let reconVolume: number | undefined;
  let currentQuantity = 0;
  let containerTag = '';

  switch (type) {
    case 'lyophilized-peptide': {
      unitSize = parseFloat(fd.powderWeightPerVial) || 0;
      unitLabel = `${fd.powderWeightUnit} vial`;
      bacstatPerVial = unitSize;
      reconVolume = parseFloat(fd.solventVolume) || 2;
      currentQuantity = parseFloat(fd.vialsInSupply) || 0;
      if (fd.orderFormat === 'Kit') {
        kitPrice = parseFloat(fd.pricePerKit) || 0;
      }
      break;
    }
    case 'injectable-oil': {
      unitSize = parseFloat(fd.concentration) || 0;
      unitLabel = 'mg/mL';
      vialSizeMl = parseFloat(fd.vialSizeMl) || 10;
      currentQuantity = parseFloat(fd.oilVialsInSupply) || 0;
      break;
    }
    case 'oral-pill': {
      unitSize = parseFloat(fd.countPerContainer) || 0;
      const formLabelMap: Record<string, string> = {
        Capsule: 'caps', Tablet: 'tabs', Softgel: 'softgels',
        Sublingual: 'tabs', 'Enteric Coated': 'tabs', Chewable: 'tabs',
      };
      unitLabel = formLabelMap[fd.formFactor] || 'caps';
      containerTag = fd.containerType === 'Bag' ? '[CONTAINER:bag]' : '[CONTAINER:bottle]';
      currentQuantity = parseFloat(fd.containersInSupply) || 0;
      break;
    }
    case 'oral-powder': {
      const containerG = fd.containerSizeUnit === 'kg' ? (parseFloat(fd.containerSize) || 0) * 1000 : (parseFloat(fd.containerSize) || 0);
      const doseG = fd.doseWeightUnit === 'mg' ? (parseFloat(fd.doseWeightPerServing) || 0) / 1000 : (parseFloat(fd.doseWeightPerServing) || 0);
      unitSize = doseG > 0 ? Math.floor(containerG / doseG) : 0;
      unitLabel = 'servings';
      containerTag = '[CONTAINER:bag]';
      currentQuantity = parseFloat(fd.powderContainersInSupply) || 0;
      break;
    }
    case 'topical': {
      unitSize = parseFloat(fd.dosesPerContainer) || 0;
      unitLabel = fd.applicationUnit.toLowerCase() + 's';
      currentQuantity = parseFloat(fd.topicalContainersInSupply) || 0;
      break;
    }
    case 'prescription': {
      if (fd.prescriptionForm === 'Injectable') {
        unitSize = parseFloat(fd.concentration) || 0;
        unitLabel = 'mg/mL';
        vialSizeMl = parseFloat(fd.vialSizeMl) || 10;
        currentQuantity = parseFloat(fd.oilVialsInSupply) || 0;
      } else if (fd.prescriptionForm === 'Topical') {
        unitSize = parseFloat(fd.dosesPerContainer) || 0;
        unitLabel = fd.applicationUnit.toLowerCase() + 's';
        currentQuantity = parseFloat(fd.topicalContainersInSupply) || 0;
      } else {
        unitSize = parseFloat(fd.countPerContainer) || 0;
        const formLabelMap: Record<string, string> = {
          Capsule: 'caps', Tablet: 'tabs', Softgel: 'softgels',
          Sublingual: 'tabs', 'Enteric Coated': 'tabs', Chewable: 'tabs',
        };
        unitLabel = formLabelMap[fd.formFactor] || 'caps';
        currentQuantity = parseFloat(fd.containersInSupply) || 0;
      }
      break;
    }
  }

  // Allow Step 5 currentSupply to override if user explicitly changed it
  const step5Supply = parseFloat(fd.currentSupply);
  if (Number.isFinite(step5Supply) && fd.currentSupply.trim() !== INITIAL_FORM_DATA.currentSupply) {
    currentQuantity = step5Supply;
  }

  if (unitPrice <= 0 && fd.orderFormat === 'Subscription') {
    unitPrice = parseFloat(fd.subscriptionPrice) || 0;
  }

  const normalizedUnitLabel = normalizeCompoundUnitLabel(unitLabel, category);

  // Build notes with container tag
  const notesParts: string[] = [];
  if (containerTag) notesParts.push(containerTag);
  if (fd.notes) notesParts.push(fd.notes);
  if (fd.supplierNotes) notesParts.push(`Supplier: ${fd.supplierNotes}`);
  const notes = notesParts.length > 0 ? notesParts.join('\n') : undefined;

  const baseCompound: Compound = {
    id: `wizard-${Date.now()}`,
    name: fd.name.trim(),
    category,
    unitSize,
    unitLabel: normalizedUnitLabel,
    unitPrice,
    kitPrice,
    vialSizeMl,
    dosePerUse: resolved.dosePerUse,
    doseLabel: resolved.doseLabel,
    bacstatPerVial,
    reconVolume,
    dosesPerDay: parseInt(fd.dosesPerDay) || 1,
    daysPerWeek: activeDays.length,
    timingNote,
    cyclingNote: fd.cycleNotes || undefined,
    currentQuantity,
    purchaseDate: new Date().toISOString().split('T')[0],
    reorderQuantity: parseInt(fd.reorderQuantity) || 1,
    reorderType: fd.orderFormat === 'Kit' ? 'kit' : 'single',
    notes,
    cycleOnDays: fd.cyclingEnabled ? (parseInt(fd.cycleOnDays) || undefined) : undefined,
    cycleOffDays: fd.cyclingEnabled ? (parseInt(fd.cycleOffDays) || undefined) : undefined,
    cycleStartDate: fd.cyclingEnabled ? (fd.cycleStartDate || undefined) : undefined,
    solventType: fd.solventType || undefined,
    solventVolume: parseFloat(fd.solventVolume) || undefined,
    solventUnit: 'mL',
    storageInstructions: fd.storageInstructions || fd.storagePostRecon || undefined,
    prepNotes: fd.prepNotes || undefined,
  };

  const explicitWeightPerUnitMg = resolved.weightPerUnitMg;
  const inferredWeight = explicitWeightPerUnitMg ?? getDerivedWeightPerUnitMg(baseCompound);
  return {
    ...baseCompound,
    weightPerUnit: explicitWeightPerUnitMg ?? inferredWeight,
    weightUnit: (explicitWeightPerUnitMg ?? inferredWeight) ? 'mg' : undefined,
  };
}

/** Convert existing Compound → wizard form data for editing */
function compoundToFormData(compound: Compound): WizardFormData {
  const ct = compoundTypeFromCategory(compound.category);
  const fd: WizardFormData = {
    ...INITIAL_FORM_DATA,
    name: compound.name,
    compoundType: ct,
    category: compound.category,
    targetDose: compound.dosePerUse.toString(),
    targetDoseUnit: compound.doseLabel,
    dosesPerDay: compound.dosesPerDay.toString(),
    currentSupply: compound.currentQuantity.toString(),
    reorderQuantity: compound.reorderQuantity.toString(),
    notes: compound.notes || '',
    pricePerUnit: compound.unitPrice.toString(),
    cyclingEnabled: !!(compound.cycleOnDays && compound.cycleOffDays),
    cycleOnDays: compound.cycleOnDays?.toString() || '',
    cycleOffDays: compound.cycleOffDays?.toString() || '',
    cycleStartDate: compound.cycleStartDate || '',
    cycleNotes: compound.cyclingNote || '',
    solventType: compound.solventType || '',
    solventVolume: compound.solventVolume?.toString() || '2',
    prepNotes: compound.prepNotes || '',
    storageInstructions: compound.storageInstructions || '',
  };

  if (ct === 'lyophilized-peptide') {
    fd.powderWeightPerVial = compound.unitSize.toString();
    fd.vialsInSupply = compound.currentQuantity.toString();
  } else if (ct === 'injectable-oil') {
    fd.concentration = compound.unitSize.toString();
    fd.vialSizeMl = compound.vialSizeMl?.toString() || '10';
    fd.oilVialsInSupply = compound.currentQuantity.toString();
  } else if (ct === 'oral-pill') {
    fd.countPerContainer = compound.unitSize.toString();
    fd.containersInSupply = compound.currentQuantity.toString();
    if (compound.weightPerUnit) {
      fd.doseAmountPerUnit = compound.weightPerUnit.toString();
      fd.doseAmountPerUnitUnit = compound.weightUnit || 'mg';
    }
  } else if (ct === 'oral-powder') {
    fd.doseWeightPerServing = compound.dosePerUse.toString();
    fd.doseWeightUnit = compound.doseLabel;
    fd.powderContainersInSupply = compound.currentQuantity.toString();
  }

  if (compound.kitPrice) {
    fd.orderFormat = 'Kit';
    fd.pricePerKit = compound.kitPrice.toString();
  }

  return fd;
}

export default function CompoundCardV2({ existingCompoundIds, onAdd, open, onOpenChange, onAddAsOrdered }: CompoundCardV2Props) {
  const { state, start, next, back, jump, updateForm, save, saveSuccess, saveError, reset } = useWizardMachine();
  const { step, formData, highestStep, error } = state;

  const accentColor = useMemo(() => getAccentColor(formData.category), [formData.category]);

  useEffect(() => {
    if (open && step === 'IDLE') {
      start();
    }
    if (!open && step !== 'IDLE') {
      reset();
    }
  }, [open, step, start, reset]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  const handleNext = useCallback(() => next(), [next]);
  const handleBack = useCallback(() => back(), [back]);
  const handleJump = useCallback((idx: number) => jump(idx), [jump]);

  const handleSave = useCallback(async () => {
    // Validate before save
    const errors = validateWizardData(formData);
    if (errors.length > 0) {
      saveError(errors[0]);
      return;
    }

    save();
    try {
      const compound = formDataToCompound(formData);
      await onAdd(compound);
      saveSuccess();
      setTimeout(() => {
        reset();
        onOpenChange(false);
      }, 600);
    } catch (err: any) {
      saveError(err.message || 'Failed to save compound');
    }
  }, [formData, onAdd, save, saveSuccess, saveError, reset, onOpenChange]);

  const handleSaveOrdered = useCallback(async (
    orderDate: string,
    orderNotes: string
  ) => {
    // Run the same pre-save validation as handleSave
    const errors = validateWizardData(formData);
    if (errors.length > 0) {
      saveError(errors[0]);
      return;
    }

    save();

    try {
      const compound = formDataToCompound(formData);
      const orderCost = getReorderCost(compound);

      // Override: zero stock, no purchase date, tag as on-order
      const orderedCompound: typeof compound = {
        ...compound,
        currentQuantity: 0,
        purchaseDate: '',
        notes: compound.notes
          ? `[ON_ORDER] ${compound.notes}`
          : '[ON_ORDER]',
      };

      // Call onAdd (now returns the DB-generated id)
      const newCompoundId = await onAdd(orderedCompound);

      if (!newCompoundId) {
        saveError(
          'Compound saved but could not get ID — ' +
          'check Reorder tab and use Force Reorder ' +
          'to add the order manually'
        );
        return;
      }

      // Notify parent to create the order record
      await onAddAsOrdered?.({
        newCompoundId,
        compoundName: compound.name,
        orderCost,
        reorderQuantity: compound.reorderQuantity,
        reorderType: compound.reorderType,
        category: compound.category,
        orderDate,
        orderNotes,
      });

      saveSuccess();
      setTimeout(() => {
        reset();
        onOpenChange(false);
      }, 600);

    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : 'Failed to save compound';
      saveError(msg);
    }
  }, [formData, onAdd, onAddAsOrdered, save, saveSuccess, saveError, reset, onOpenChange]);

  const handleCancel = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const isActiveStep = step.startsWith('STEP_');
  const isSaving = step === 'SAVING';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border border-border/30 bg-background" style={{
        borderRadius: '16px',
        boxShadow: `0 0 0 1px hsl(${accentColor} / 0.15), 0 8px 32px rgba(0,0,0,0.4), 0 0 20px hsl(${accentColor} / 0.1)`,
      }} aria-describedby={undefined}>
        <DialogTitle className="sr-only">Add Compound</DialogTitle>
        {isActiveStep && (
          <div className="flex-shrink-0 border-b border-border/20">
            <WizardProgress
              currentStep={step}
              highestStep={highestStep}
              accentColor={accentColor}
              onJump={handleJump}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto pt-2">
          {step === 'STEP_1' && (
            <StepIdentity formData={formData} onUpdate={updateForm} onNext={handleNext} accentColor={accentColor} />
          )}
          {step === 'STEP_2' && (
            <StepConfiguration formData={formData} onUpdate={updateForm} onNext={handleNext} onBack={handleBack} accentColor={accentColor} />
          )}
          {step === 'STEP_3' && (
            <StepDosing formData={formData} onUpdate={updateForm} onNext={handleNext} onBack={handleBack} accentColor={accentColor} />
          )}
          {step === 'STEP_4' && (
            <StepCycling formData={formData} onUpdate={updateForm} onNext={handleNext} onBack={handleBack} accentColor={accentColor} />
          )}
          {step === 'STEP_5' && (
            <StepInventory formData={formData} onUpdate={updateForm} onNext={handleNext} onBack={handleBack} accentColor={accentColor} />
          )}
          {(step === 'STEP_6' || step === 'SAVING' || step === 'ERROR') && (
            <StepReview
              formData={formData}
              onJump={handleJump}
              onSave={handleSave}
              onSaveOrdered={(intakeMode, orderDate, orderNotes) => {
                if (intakeMode === 'ordered') {
                  handleSaveOrdered(orderDate, orderNotes);
                } else {
                  handleSave();
                }
              }}
              onCancel={handleCancel}
              isSaving={isSaving}
              error={error}
              accentColor={accentColor}
            />
          )}
          {step === 'SAVED' && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `hsl(${accentColor} / 0.15)` }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={`hsl(${accentColor})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-foreground">Saved to Protocol</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { compoundToFormData, formDataToCompound };
