/**
 * Centralized dose resolution for the V2 wizard.
 * Every compound type feeds through getEffectiveDose() so that
 * formDataToCompound, StepDosing, StepReview, and validation
 * all agree on the actual dose value.
 */

import { WizardFormData, CompoundType } from './types';

export interface ResolvedDose {
  /** The per-use dose amount (e.g. 400 for "400 mg") */
  dosePerUse: number;
  /** The unit label for the dose (e.g. "mg", "caps", "pumps") */
  doseLabel: string;
  /** mg weight per individual unit (pill/cap/scoop) — for count→weight conversion */
  weightPerUnitMg?: number;
}

/** Convert value+unit to mg */
function toMg(value: number, unit: string): number | undefined {
  const u = unit.toLowerCase();
  if (u === 'mg') return value;
  if (u === 'mcg' || u === 'µg') return value / 1000;
  if (u === 'g') return value * 1000;
  return undefined; // non-weight unit (IU, pills, etc.)
}

/**
 * Resolve the effective per-dose amount from wizard form data.
 * This is the SINGLE SOURCE OF TRUTH for dose values across the wizard.
 */
export function getEffectiveDose(fd: WizardFormData): ResolvedDose {
  const type = fd.compoundType || 'oral-pill';

  switch (type) {
    // ── Peptide: dose comes from Step 3 targetDose ──
    case 'lyophilized-peptide': {
      const dose = parseFloat(fd.targetDose) || 0;
      return { dosePerUse: dose, doseLabel: fd.targetDoseUnit || 'mg' };
    }

    // ── Injectable Oil: dose comes from Step 3 targetDose ──
    case 'injectable-oil': {
      const dose = parseFloat(fd.targetDose) || 0;
      return { dosePerUse: dose, doseLabel: fd.targetDoseUnit || 'mg' };
    }

    // ── Oral Pill: dose = doseAmountPerServing × servingsPerDose from Step 2 ──
    case 'oral-pill': {
      return resolveOralPillDose(fd);
    }

    // ── Oral Powder: dose comes from Step 2 doseWeightPerServing ──
    case 'oral-powder': {
      const weight = parseFloat(fd.doseWeightPerServing) || 0;
      return { dosePerUse: weight, doseLabel: fd.doseWeightUnit || 'g' };
    }

    // ── Topical: dose from Step 2 dosePerApplication ──
    case 'topical': {
      const perApp = parseFloat(fd.dosePerApplication) || 1;
      return { dosePerUse: perApp, doseLabel: fd.applicationUnit?.toLowerCase() || 'pump' };
    }

    // ── Prescription: delegates by sub-form ──
    case 'prescription': {
      if (fd.prescriptionForm === 'Injectable') {
        const dose = parseFloat(fd.targetDose) || 0;
        return { dosePerUse: dose, doseLabel: fd.targetDoseUnit || 'mg' };
      }
      if (fd.prescriptionForm === 'Topical') {
        const perApp = parseFloat(fd.dosePerApplication) || 1;
        return { dosePerUse: perApp, doseLabel: fd.applicationUnit?.toLowerCase() || 'pump' };
      }
      // Pill/Capsule or Other → same as oral-pill
      return resolveOralPillDose(fd);
    }
  }

  // Absolute fallback
  const dose = parseFloat(fd.targetDose) || 0;
  return { dosePerUse: dose, doseLabel: fd.targetDoseUnit || 'mg' };
}

function resolveOralPillDose(fd: WizardFormData): ResolvedDose {
  const doseAmountPerServing = parseFloat(fd.doseAmountPerUnit) || 0;
  const servingsPerDose = Math.max(1, parseFloat(fd.unitsPerDose) || 1);
  const unitLabel = fd.doseAmountPerUnitUnit || 'mg';

  if (doseAmountPerServing > 0) {
    return {
      dosePerUse: doseAmountPerServing * servingsPerDose,
      doseLabel: unitLabel,
      weightPerUnitMg: toMg(doseAmountPerServing, unitLabel),
    };
  }

  // Fallback: count-based (1 cap per dose)
  const formLabelMap: Record<string, string> = {
    Capsule: 'caps', Tablet: 'tabs', Softgel: 'softgels',
    Sublingual: 'tabs', 'Enteric Coated': 'tabs', Chewable: 'tabs',
  };
  const fallbackLabel = formLabelMap[fd.formFactor] || 'caps';
  return {
    dosePerUse: servingsPerDose,
    doseLabel: fallbackLabel,
  };
}

/**
 * Returns true if the dose needs Step 3's "Target dose" field.
 * Oral pill, oral powder, and topical define dose in Step 2 → skip Step 3 dose input.
 * Prescription delegates by sub-form.
 */
export function doseDefinedInStep2(fd: WizardFormData): boolean {
  const type = fd.compoundType || 'oral-pill';
  switch (type) {
    case 'oral-pill':
    case 'oral-powder':
    case 'topical':
      return true;
    case 'prescription':
      return fd.prescriptionForm !== 'Injectable';
    default:
      return false;
  }
}

/**
 * Validate that a compound's critical fields are populated for the given type.
 * Returns an array of error messages (empty = valid).
 */
export function validateWizardData(fd: WizardFormData): string[] {
  const errors: string[] = [];
  const type = fd.compoundType || 'oral-pill';

  // Name is always required
  if (!fd.name.trim()) errors.push('Compound name is required');

  // Type-specific validation
  switch (type) {
    case 'lyophilized-peptide': {
      if ((parseFloat(fd.powderWeightPerVial) || 0) <= 0) errors.push('Powder weight per vial must be > 0');
      if ((parseFloat(fd.solventVolume) || 0) <= 0) errors.push('Solvent volume must be > 0');
      if ((parseFloat(fd.targetDose) || 0) <= 0) errors.push('Target dose must be > 0');
      break;
    }
    case 'injectable-oil': {
      if ((parseFloat(fd.concentration) || 0) <= 0) errors.push('Concentration must be > 0');
      if ((parseFloat(fd.vialSizeMl) || 0) <= 0) errors.push('Vial size must be > 0');
      if ((parseFloat(fd.targetDose) || 0) <= 0) errors.push('Target dose must be > 0');
      break;
    }
    case 'oral-pill': {
      if ((parseFloat(fd.countPerContainer) || 0) <= 0) errors.push('Servings per container must be > 0');
      if ((parseFloat(fd.doseAmountPerUnit) || 0) <= 0) errors.push('Dose amount per serving must be > 0');
      break;
    }
    case 'oral-powder': {
      if ((parseFloat(fd.containerSize) || 0) <= 0) errors.push('Container size must be > 0');
      if ((parseFloat(fd.doseWeightPerServing) || 0) <= 0) errors.push('Dose weight per serving must be > 0');
      break;
    }
    case 'topical': {
      if ((parseFloat(fd.dosesPerContainer) || 0) <= 0) errors.push('Doses per container must be > 0');
      break;
    }
    case 'prescription': {
      if (fd.prescriptionForm === 'Injectable') {
        if ((parseFloat(fd.concentration) || 0) <= 0) errors.push('Concentration must be > 0');
        if ((parseFloat(fd.targetDose) || 0) <= 0) errors.push('Target dose must be > 0');
      } else if (fd.prescriptionForm === 'Topical') {
        if ((parseFloat(fd.dosesPerContainer) || 0) <= 0) errors.push('Doses per container must be > 0');
      } else {
        if ((parseFloat(fd.countPerContainer) || 0) <= 0) errors.push('Servings per container must be > 0');
        if ((parseFloat(fd.doseAmountPerUnit) || 0) <= 0) errors.push('Dose amount per serving must be > 0');
      }
      break;
    }
  }

  // Dosing schedule
  if ((parseInt(fd.dosesPerDay) || 0) <= 0) errors.push('Servings per day must be > 0');

  return errors;
}
