import { WizardFormData, TIMING_OPTIONS, SCHEDULE_PRESETS, DAY_LABELS } from '../types';
import { getEffectiveDose, doseDefinedInStep2 } from '../doseResolver';

interface StepDosingProps {
  formData: WizardFormData;
  onUpdate: (data: Partial<WizardFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  accentColor: string;
}

export default function StepDosing({ formData, onUpdate, onNext, onBack, accentColor }: StepDosingProps) {
  const type = formData.compoundType;
  const isPeptide = type === 'lyophilized-peptide';
  const skipDoseInput = doseDefinedInStep2(formData);
  const resolvedDose = getEffectiveDose(formData);

  // Determine dose unit options based on type (only used when dose input is shown)
  const doseUnitOptions = (() => {
    switch (type) {
      case 'lyophilized-peptide':
      case 'injectable-oil': return ['mg', 'mcg', 'IU'];
      default: return ['mg', 'mcg', 'IU', 'pills'];
    }
  })();

  const toggleTiming = (id: string) => {
    const current = formData.timings;
    if (current.includes(id)) {
      if (current.length > 1) onUpdate({ timings: current.filter(t => t !== id) });
    } else {
      onUpdate({ timings: [...current, id] });
    }
  };

  const selectPreset = (presetId: string) => {
    const preset = SCHEDULE_PRESETS.find(p => p.id === presetId);
    if (preset) {
      onUpdate({
        schedulePreset: presetId,
        customDays: presetId === 'Custom' ? formData.customDays : [...preset.days],
      });
    }
  };

  const toggleDay = (dayIdx: number) => {
    const current = formData.customDays;
    if (current.includes(dayIdx)) {
      onUpdate({ customDays: current.filter(d => d !== dayIdx) });
    } else {
      onUpdate({ customDays: [...current, dayIdx].sort() });
    }
  };

  // Summary
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const activeDays = formData.schedulePreset === 'Custom' ? formData.customDays : (SCHEDULE_PRESETS.find(p => p.id === formData.schedulePreset)?.days || []);
  const dayStr = activeDays.length === 7 ? 'Every day' : activeDays.map(d => dayNames[d]).join(', ');
  const timingStr = formData.timings.map(t => TIMING_OPTIONS.find(o => o.id === t)?.label || t).join(' and ').toLowerCase();
  const summary = `${dayStr} — ${timingStr}`;

  // Peptide draw volume reminder
  const drawReminder = isPeptide ? (() => {
    const powder = parseFloat(formData.powderWeightPerVial) || 0;
    const solvent = parseFloat(formData.solventVolume) || 0;
    const dose = parseFloat(formData.targetDose) || 0;
    if (powder > 0 && solvent > 0 && dose > 0) {
      const concMgPerMl = powder / solvent;
      let doseMg = dose;
      if (formData.targetDoseUnit === 'mcg') doseMg = dose / 1000;
      if (formData.targetDoseUnit === 'IU') return null;
      const ml = doseMg / concMgPerMl;
      return `Reminder: Draw ${ml.toFixed(2)}mL per dose`;
    }
    return null;
  })() : null;

  return (
    <div className="space-y-5 px-4 pb-6">
      <h3 className="text-base font-semibold text-foreground">Dosing Schedule</h3>

      {/* Target dose — only shown for types where dose is NOT defined in Step 2 */}
      {!skipDoseInput ? (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Target dose</label>
          <div className="flex gap-1.5">
            <input
              type="number"
              inputMode="decimal"
              value={formData.targetDose}
              onChange={e => onUpdate({ targetDose: e.target.value })}
              placeholder="0"
              className="flex-1 rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
            />
            <select
              value={formData.targetDoseUnit}
              onChange={e => onUpdate({ targetDoseUnit: e.target.value })}
              className="rounded-lg border border-border/50 bg-secondary px-2 py-2.5 text-xs text-muted-foreground focus:outline-none"
            >
              {doseUnitOptions.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      ) : (
        /* Read-only dose display for types where dose is defined in Step 2 */
        <div className="rounded-xl p-3 border" style={{ borderColor: `hsl(${accentColor} / 0.3)`, backgroundColor: `hsl(${accentColor} / 0.06)` }}>
          <p className="text-xs text-muted-foreground mb-1">Dose per use (from configuration)</p>
          <p className="text-sm font-mono font-semibold" style={{ color: `hsl(${accentColor})` }}>
            {resolvedDose.dosePerUse > 0 ? `${resolvedDose.dosePerUse} ${resolvedDose.doseLabel}` : '⚠ Not set — go back to Step 2'}
          </p>
        </div>
      )}

      {/* Doses per day */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Servings per day</label>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={formData.dosesPerDay}
          onChange={e => onUpdate({ dosesPerDay: e.target.value })}
          className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* Timing pills */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Timing</label>
        <div className="flex flex-wrap gap-2">
          {TIMING_OPTIONS.map(opt => {
            const selected = formData.timings.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleTiming(opt.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all duration-200 border min-h-[44px]"
                style={{
                  borderColor: selected ? `hsl(${accentColor})` : 'hsl(var(--border) / 0.5)',
                  backgroundColor: selected ? `hsl(${accentColor} / 0.12)` : 'transparent',
                  color: selected ? `hsl(${accentColor})` : 'hsl(var(--muted-foreground))',
                  boxShadow: selected ? `0 0 8px hsl(${accentColor} / 0.2)` : 'none',
                }}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Schedule preset */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Schedule</label>
        <div className="flex flex-wrap gap-2">
          {SCHEDULE_PRESETS.map(preset => {
            const selected = formData.schedulePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => selectPreset(preset.id)}
                className="px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border min-h-[44px]"
                style={{
                  borderColor: selected ? `hsl(${accentColor})` : 'hsl(var(--border) / 0.5)',
                  backgroundColor: selected ? `hsl(${accentColor} / 0.12)` : 'transparent',
                  color: selected ? `hsl(${accentColor})` : 'hsl(var(--muted-foreground))',
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom day toggles */}
      {formData.schedulePreset === 'Custom' && (
        <div className="flex justify-between gap-1">
          {DAY_LABELS.map((label, i) => {
            const selected = formData.customDays.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className="w-10 h-10 rounded-full text-xs font-semibold transition-all duration-200 border"
                style={{
                  borderColor: selected ? `hsl(${accentColor})` : 'hsl(var(--border) / 0.5)',
                  backgroundColor: selected ? `hsl(${accentColor} / 0.15)` : 'transparent',
                  color: selected ? `hsl(${accentColor})` : 'hsl(var(--muted-foreground))',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Plain-language summary */}
      <p className="text-xs text-muted-foreground italic px-1">{summary}</p>

      {/* Special timing note */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Special timing note</label>
        <input
          type="text"
          value={formData.specialTimingNote}
          onChange={e => onUpdate({ specialTimingNote: e.target.value })}
          placeholder="e.g. Take 30 min before first meal"
          className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* Peptide draw volume reminder */}
      {drawReminder && (
        <div className="rounded-xl p-3 border" style={{ borderColor: `hsl(${accentColor} / 0.3)`, backgroundColor: `hsl(${accentColor} / 0.06)` }}>
          <p className="text-sm font-mono" style={{ color: `hsl(${accentColor})` }}>{drawReminder}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex-1 py-3 rounded-xl text-sm font-medium text-muted-foreground border border-border/50 hover:bg-secondary transition-colors">Back</button>
        <button type="button" onClick={onNext} className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all" style={{ backgroundColor: `hsl(${accentColor})`, color: 'hsl(var(--background))' }}>Continue</button>
      </div>
    </div>
  );
}
