/**
 * Measurement conversion utilities.
 * The app stores values in metric (cm, kg) internally and converts for display.
 */

export type MeasurementSystem = 'metric' | 'imperial';
export type DoseUnitPreference = 'mg' | 'iu';

// Height conversions
export function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54);
}

// Weight conversions
export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs / 2.20462 * 10) / 10;
}

// Display helpers
export function displayHeight(cm: number | null | undefined, system: MeasurementSystem): string {
  if (!cm) return '';
  return system === 'imperial' ? cmToFeetInches(cm) : `${cm}cm`;
}

export function displayWeight(kg: number | null | undefined, system: MeasurementSystem): string {
  if (!kg) return '';
  return system === 'imperial' ? `${kgToLbs(kg)}lb` : `${kg}kg`;
}

// Dose unit conversions (approximate, varies by compound reconstitution)
// Standard reconstitution: 200 IU per vial for most peptides
// Formula: mg dose * (reconVolumeIU / vialMg) = IU dose
export function mgToIu(mg: number, vialMg: number, reconVolumeIu: number): number {
  if (vialMg <= 0) return 0;
  return Math.round((mg / vialMg) * reconVolumeIu * 100) / 100;
}

export function iuToMg(iu: number, vialMg: number, reconVolumeIu: number): number {
  if (reconVolumeIu <= 0) return 0;
  return Math.round((iu / reconVolumeIu) * vialMg * 1000) / 1000;
}

export function displayDose(
  value: number,
  label: string,
  preference: DoseUnitPreference,
  vialMg?: number | null,
  reconVolume?: number | null,
): string {
  const isIuLabel = label.toLowerCase().includes('iu');
  const isMgLabel = label.toLowerCase().includes('mg') || label.toLowerCase().includes('mcg');
  
  if (preference === 'iu' && isMgLabel && vialMg && reconVolume) {
    const iu = mgToIu(value, vialMg, reconVolume);
    return `${iu} IU`;
  }
  if (preference === 'mg' && isIuLabel && vialMg && reconVolume) {
    const mg = iuToMg(value, vialMg, reconVolume);
    return `${mg} ${label.replace(/iu/i, 'mg')}`;
  }
  return `${value} ${label}`;
}
