/**
 * CompoundCardV2 — Intelligent Compound Card Wizard
 *
 * PARALLEL COMPONENT: This does NOT replace CompoundCard / AddCompoundDialog.
 * It runs alongside the existing UI via a dev toggle.
 *
 * Phase 7 (swap) will only execute when explicitly authorized.
 */

import { useEffect, useCallback, useMemo } from 'react';
import { Compound, CompoundCategory, normalizeCompoundUnitLabel, getDerivedWeightPerUnitMg } from '@/data/compounds';
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
import { getDilutionDefaults } from '@/data/dilutionDefaults';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface CompoundCardV2Props {
  /** Existing compounds list — for name deduplication */
  existingCompoundIds: string[];
  /** Called with the fully built Compound on save — same shape as AddCompoundDialog.onAdd */
  onAdd: (compound: Compound) => void;
  /** Dialog open state */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Convert supported weight units to mg for consistent internal storage */
function toMg(value: number, unit: string): number | undefined {
  const normalized = unit.toLowerCase();
  if (normalized === 'mg') return value;
  if (normalized === 'mcg' || normalized === 'µg') return value / 1000;
  if (normalized === 'g') return value * 1000;
  return undefined;
}

function resolvePillDoseFromServingFields(fd: WizardFormData, fallbackUnitLabel: string): {
  dosePerUse: number;
  doseLabel: string;
  weightPerUnitMg?: number;
} {
  const doseAmountPerServing = parseFloat(fd.doseAmountPerUnit) || 0;
  const servingsPerDose = Math.max(1, parseFloat(fd.unitsPerDose) || 1);

  // Primary source for oral pill/prescription-pill flows
  if (doseAmountPerServing > 0) {
    const doseLabel = fd.doseAmountPerUnitUnit || 'mg';
    return {
      dosePerUse: doseAmountPerServing * servingsPerDose,
      doseLabel,
      weightPerUnitMg: toMg(doseAmountPerServing, doseLabel),
    };
  }

  // Backward-compatible fallback from Step 3 target dose
  const targetDose = parseFloat(fd.targetDose) || 0;
  if (targetDose > 0) {
    if ((fd.targetDoseUnit || '').toLowerCase() === 'pills') {
      return { dosePerUse: targetDose, doseLabel: fallbackUnitLabel };
    }
    return { dosePerUse: targetDose, doseLabel: fd.targetDoseUnit || fallbackUnitLabel };
  }

  // Last-resort fallback to avoid zero-dose compounds breaking schedule/reorder math
  return { dosePerUse: servingsPerDose, doseLabel: fallbackUnitLabel };
}

/** Convert wizard form data → Compound shape for database write (uses existing patterns) */
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

  // Map supply / pricing based on type
  let unitSize = 0;
  let unitLabel = '';
  let unitPrice = parseFloat(fd.pricePerUnit) || 0;
  let kitPrice: number | undefined;
  let dosePerUse = parseFloat(fd.targetDose) || 0;
  let doseLabel = fd.targetDoseUnit;
  let vialSizeMl: number | undefined;
  let bacstatPerVial: number | undefined;
  let reconVolume: number | undefined;
  let currentQuantity = 0;
  let containerTag = '';
  let explicitWeightPerUnitMg: number | undefined;

  switch (type) {
    case 'lyophilized-peptide': {
      unitSize = parseFloat(fd.powderWeightPerVial) || 0;
      unitLabel = `${fd.powderWeightUnit} vial`;
      bacstatPerVial = unitSize; // simplified — will be refined by existing normalization
      reconVolume = parseFloat(fd.solventVolume) || 2;
      if (fd.orderFormat === 'Kit') {
        kitPrice = parseFloat(fd.pricePerKit) || 0;
      }
      break;
    }
    case 'injectable-oil': {
      unitSize = parseFloat(fd.concentration) || 0;
      unitLabel = 'mg/mL';
      vialSizeMl = parseFloat(fd.vialSizeMl) || 10;
      break;
    }
    case 'oral-pill': {
      unitSize = parseFloat(fd.countPerContainer) || 0;
      const formLabelMap: Record<string, string> = {
        Capsule: 'caps', Tablet: 'tabs', Softgel: 'softgels',
        Sublingual: 'tabs', 'Enteric Coated': 'tabs', Chewable: 'tabs',
      };
      unitLabel = formLabelMap[fd.formFactor] || 'caps';

      const oralDose = resolvePillDoseFromServingFields(fd, unitLabel);
      dosePerUse = oralDose.dosePerUse;
      doseLabel = oralDose.doseLabel;
      explicitWeightPerUnitMg = oralDose.weightPerUnitMg;

      containerTag = fd.containerType === 'Bag' ? '[CONTAINER:bag]' : '[CONTAINER:bottle]';
      break;
    }
    case 'oral-powder': {
      // Container size in g → unitSize = servings
      const containerG = fd.containerSizeUnit === 'kg' ? (parseFloat(fd.containerSize) || 0) * 1000 : (parseFloat(fd.containerSize) || 0);
      const doseG = fd.doseWeightUnit === 'mg' ? (parseFloat(fd.doseWeightPerServing) || 0) / 1000 : (parseFloat(fd.doseWeightPerServing) || 0);
      unitSize = doseG > 0 ? Math.floor(containerG / doseG) : 0;
      unitLabel = 'servings';
      dosePerUse = parseFloat(fd.doseWeightPerServing) || 0;
      doseLabel = fd.doseWeightUnit;
      containerTag = '[CONTAINER:bag]';
      break;
    }
    case 'topical': {
      unitSize = parseFloat(fd.dosesPerContainer) || 0;
      unitLabel = fd.applicationUnit.toLowerCase() + 's';
      dosePerUse = parseFloat(fd.dosePerApplication) || 1;
      doseLabel = fd.applicationUnit.toLowerCase();
      break;
    }
    case 'prescription': {
      // Delegate to sub-form mode
      if (fd.prescriptionForm === 'Injectable') {
        unitSize = parseFloat(fd.concentration) || 0;
        unitLabel = 'mg/mL';
        vialSizeMl = parseFloat(fd.vialSizeMl) || 10;
      } else if (fd.prescriptionForm === 'Topical') {
        unitSize = parseFloat(fd.dosesPerContainer) || 0;
        unitLabel = fd.applicationUnit.toLowerCase() + 's';
        dosePerUse = parseFloat(fd.dosePerApplication) || 1;
        doseLabel = fd.applicationUnit.toLowerCase();
      } else {
        unitSize = parseFloat(fd.countPerContainer) || 0;
        const formLabelMap: Record<string, string> = {
          Capsule: 'caps', Tablet: 'tabs', Softgel: 'softgels',
          Sublingual: 'tabs', 'Enteric Coated': 'tabs', Chewable: 'tabs',
        };
        unitLabel = formLabelMap[fd.formFactor] || 'caps';

        const oralDose = resolvePillDoseFromServingFields(fd, unitLabel);
        dosePerUse = oralDose.dosePerUse;
        doseLabel = oralDose.doseLabel;
        explicitWeightPerUnitMg = oralDose.weightPerUnitMg;
      }
      break;
    }
  }

  // Fallback when unit price is entered as subscription cycle cost
  if (unitPrice <= 0 && fd.orderFormat === 'Subscription') {
    unitPrice = parseFloat(fd.subscriptionPrice) || 0;
  }

  // Keep Step 2 supply quantities in sync when Step 5 supply is left at default
  const parsedCurrentSupply = parseFloat(fd.currentSupply);
  const typeSpecificSupply = (() => {
    switch (type) {
      case 'lyophilized-peptide': return parseFloat(fd.vialsInSupply) || 0;
      case 'injectable-oil': return parseFloat(fd.oilVialsInSupply) || 0;
      case 'oral-pill': return parseFloat(fd.containersInSupply) || 0;
      case 'oral-powder': return parseFloat(fd.powderContainersInSupply) || 0;
      case 'topical': return parseFloat(fd.topicalContainersInSupply) || 0;
      default: return 0;
    }
  })();

  currentQuantity = Number.isFinite(parsedCurrentSupply) ? parsedCurrentSupply : 0;
  if (
    fd.currentSupply.trim() === INITIAL_FORM_DATA.currentSupply &&
    typeSpecificSupply > 0 &&
    currentQuantity !== typeSpecificSupply
  ) {
    currentQuantity = typeSpecificSupply;
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
    dosePerUse,
    doseLabel,
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

  // Type-specific fields
  if (ct === 'lyophilized-peptide') {
    fd.powderWeightPerVial = compound.unitSize.toString();
    fd.vialsInSupply = compound.currentQuantity.toString();
  } else if (ct === 'injectable-oil') {
    fd.concentration = compound.unitSize.toString();
    fd.vialSizeMl = compound.vialSizeMl?.toString() || '10';
    fd.oilVialsInSupply = compound.currentQuantity.toString();
  } else if (ct === 'oral-pill') {
    fd.countPerContainer = compound.unitSize.toString();
  } else if (ct === 'oral-powder') {
    fd.doseWeightPerServing = compound.dosePerUse.toString();
    fd.doseWeightUnit = compound.doseLabel;
  }

  if (compound.kitPrice) {
    fd.orderFormat = 'Kit';
    fd.pricePerKit = compound.kitPrice.toString();
  }

  return fd;
}

export default function CompoundCardV2({ existingCompoundIds, onAdd, open, onOpenChange }: CompoundCardV2Props) {
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
        {/* Progress indicator — fixed at top */}
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

        {/* Step content — scrollable */}
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
