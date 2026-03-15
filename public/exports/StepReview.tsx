import { WizardFormData, COMPOUND_TYPE_META, TIMING_OPTIONS, SCHEDULE_PRESETS, getAccentColor } from '../types';
import { getEffectiveDose, validateWizardData } from '../doseResolver';
import { Loader2, AlertTriangle } from 'lucide-react';

interface StepReviewProps {
  formData: WizardFormData;
  onJump: (stepIndex: number) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  error: string | null;
  accentColor: string;
}

function Section({ title, stepIndex, onJump, children }: { title: string; stepIndex: number; onJump: (i: number) => void; children: React.ReactNode }) {
  return (
    <div className="border border-border/30 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/30">
        <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">{title}</span>
        <button type="button" onClick={() => onJump(stepIndex)} className="text-[10px] font-medium text-primary hover:underline">Edit</button>
      </div>
      <div className="px-3 py-2 space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-mono text-foreground text-right">{value}</span>
    </div>
  );
}

export default function StepReview({ formData, onJump, onSave, onCancel, isSaving, error, accentColor }: StepReviewProps) {
  const typeMeta = formData.compoundType ? COMPOUND_TYPE_META[formData.compoundType] : null;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const activeDays = formData.schedulePreset === 'Custom'
    ? formData.customDays
    : (SCHEDULE_PRESETS.find(p => p.id === formData.schedulePreset)?.days || []);
  const dayStr = activeDays.length === 7 ? 'Every day' : activeDays.map(d => dayNames[d]).join(', ');
  const timingStr = formData.timings.map(t => TIMING_OPTIONS.find(o => o.id === t)?.label || t).join(', ');

  // Use centralized dose resolver for correct display
  const resolved = getEffectiveDose(formData);
  const doseDisplay = resolved.dosePerUse > 0 ? `${resolved.dosePerUse} ${resolved.doseLabel}` : 'Not set';

  // Pre-save validation
  const validationErrors = validateWizardData(formData);

  return (
    <div className="space-y-4 px-4 pb-6">
      <h3 className="text-base font-semibold text-foreground">Review Protocol</h3>

      {/* Validation warnings */}
      {validationErrors.length > 0 && (
        <div className="rounded-xl p-3 bg-destructive/10 border border-destructive/30 space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-xs font-semibold text-destructive">Issues to fix before saving</span>
          </div>
          {validationErrors.map((err, i) => (
            <p key={i} className="text-xs text-destructive/80 pl-6">• {err}</p>
          ))}
        </div>
      )}

      {/* Card Face Preview */}
      <div
        className="rounded-2xl p-4 border space-y-2"
        style={{
          borderColor: `hsl(${accentColor} / 0.3)`,
          boxShadow: `0 0 20px hsl(${accentColor} / 0.1), 0 8px 32px rgba(0,0,0,0.3)`,
          backdropFilter: 'blur(20px) saturate(180%)',
          backgroundColor: 'hsl(var(--card) / 0.8)',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-foreground">{formData.name || 'Untitled'}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `hsl(${accentColor} / 0.15)`, color: `hsl(${accentColor})` }}>
              {typeMeta?.label || formData.category}
            </span>
            {formData.controlledSubstance && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/40">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
          </div>
        </div>
        <div className="w-full h-px" style={{ backgroundColor: `hsl(${accentColor} / 0.2)` }} />
        <p className="text-sm font-semibold text-foreground">
          {doseDisplay} — {timingStr}
        </p>
        <p className="text-xs text-muted-foreground font-mono">{dayStr}</p>
      </div>

      {/* Collapsible sections */}
      <Section title="Identity" stepIndex={0} onJump={onJump}>
        <Row label="Name" value={formData.name} />
        <Row label="Type" value={typeMeta?.label} />
        <Row label="Category" value={formData.category} />
        <Row label="Purpose" value={formData.purposeNote} />
      </Section>

      <Section title="Configuration" stepIndex={1} onJump={onJump}>
        {formData.compoundType === 'lyophilized-peptide' && (
          <>
            <Row label="Powder weight" value={`${formData.powderWeightPerVial} ${formData.powderWeightUnit}`} />
            <Row label="Vials" value={formData.vialsInSupply} />
            <Row label="Solvent" value={`${formData.solventVolume} mL ${formData.solventType}`} />
            <Row label="Storage (post)" value={formData.storagePostRecon} />
            <Row label="Expiry" value={`${formData.expiryAfterRecon} ${formData.expiryAfterReconUnit}`} />
          </>
        )}
        {formData.compoundType === 'injectable-oil' && (
          <>
            <Row label="Concentration" value={`${formData.concentration} mg/mL`} />
            <Row label="Vial size" value={`${formData.vialSizeMl} mL`} />
            <Row label="Vials" value={formData.oilVialsInSupply} />
            <Row label="Carrier oil" value={formData.carrierOil} />
          </>
        )}
        {formData.compoundType === 'oral-pill' && (
          <>
            <Row label="Pill type" value={formData.formFactor} />
            <Row label="Container" value={formData.containerType} />
            <Row label="Servings/container" value={formData.countPerContainer} />
            <Row label="Dose/serving" value={`${formData.doseAmountPerUnit} ${formData.doseAmountPerUnitUnit}`} />
            <Row label="Servings/dose" value={formData.unitsPerDose} />
          </>
        )}
        {formData.compoundType === 'oral-powder' && (
          <>
            <Row label="Container" value={`${formData.containerSize} ${formData.containerSizeUnit}`} />
            <Row label="Dose" value={`${formData.doseWeightPerServing} ${formData.doseWeightUnit}`} />
            <Row label="Method" value={formData.measuringMethod} />
          </>
        )}
        {formData.compoundType === 'topical' && (
          <>
            <Row label="Form" value={formData.topicalForm} />
            <Row label="Container" value={`${formData.topicalContainerSize} ${formData.topicalContainerSizeUnit}`} />
            <Row label="Application" value={`${formData.dosePerApplication} ${formData.applicationUnit}`} />
            <Row label="Doses/container" value={formData.dosesPerContainer} />
          </>
        )}
        {formData.compoundType === 'prescription' && (
          <>
            <Row label="Rx form" value={formData.prescriptionForm} />
            <Row label="Prescriber" value={formData.prescriber} />
            <Row label="Pharmacy" value={formData.pharmacy} />
            <Row label="Rx #" value={formData.rxNumber} />
          </>
        )}
      </Section>

      <Section title="Dosing" stepIndex={2} onJump={onJump}>
        <Row label="Dose" value={doseDisplay} />
        <Row label="Frequency" value={`${formData.dosesPerDay}x/day`} />
        <Row label="Timing" value={timingStr} />
        <Row label="Schedule" value={dayStr} />
        <Row label="Note" value={formData.specialTimingNote} />
      </Section>

      <Section title="Cycling" stepIndex={3} onJump={onJump}>
        {formData.cyclingEnabled ? (
          <>
            <Row label="ON" value={`${formData.cycleOnDays} days`} />
            <Row label="OFF" value={`${formData.cycleOffDays} days`} />
            <Row label="Start" value={formData.cycleStartDate} />
            <Row label="Notes" value={formData.cycleNotes} />
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">Continuous — no cycling</p>
        )}
      </Section>

      <Section title="Inventory" stepIndex={4} onJump={onJump}>
        <Row label="Supply" value={formData.currentSupply} />
        <Row label="Reorder at" value={`${formData.reorderThresholdDays} days`} />
        <Row label="Format" value={formData.orderFormat} />
        <Row label="Quantity" value={formData.reorderQuantity} />
        <Row label="Price" value={formData.orderFormat === 'Kit' ? `$${formData.pricePerKit}/kit` : `$${formData.pricePerUnit}/unit`} />
      </Section>

      {/* Error */}
      {error && (
        <div className="rounded-lg p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm">{error}</div>
      )}

      {/* Save */}
      <button
        type="button"
        disabled={isSaving || validationErrors.length > 0}
        onClick={onSave}
        className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
        style={{
          backgroundColor: validationErrors.length > 0 ? 'hsl(var(--muted))' : `hsl(${accentColor})`,
          color: validationErrors.length > 0 ? 'hsl(var(--muted-foreground))' : 'hsl(var(--background))',
          boxShadow: validationErrors.length > 0 ? 'none' : `0 0 20px hsl(${accentColor} / 0.3)`,
        }}
      >
        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
        {isSaving ? 'Saving…' : validationErrors.length > 0 ? 'Fix Issues Above' : 'Save to Protocol'}
      </button>

      <button type="button" onClick={onCancel} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        Cancel
      </button>
    </div>
  );
}
