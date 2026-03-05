import { WizardFormData } from '../types';
import DatePickerInput from '@/components/DatePickerInput';

interface StepCyclingProps {
  formData: WizardFormData;
  onUpdate: (data: Partial<WizardFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  accentColor: string;
}

export default function StepCycling({ formData, onUpdate, onNext, onBack, accentColor }: StepCyclingProps) {
  const onDays = parseInt(formData.cycleOnDays) || 0;
  const offDays = parseInt(formData.cycleOffDays) || 0;
  const cycleLength = onDays + offDays;

  // Calculate current day in cycle if we have all data
  let dayInCycle = 0;
  let isOn = true;
  let daysLeftInPhase = 0;
  let nextPhaseDate = '';

  if (formData.cyclingEnabled && cycleLength > 0 && formData.cycleStartDate) {
    const start = new Date(formData.cycleStartDate);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    dayInCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength;
    isOn = dayInCycle < onDays;
    daysLeftInPhase = isOn ? onDays - dayInCycle : cycleLength - dayInCycle;
    const nextDate = new Date(now.getTime() + daysLeftInPhase * 24 * 60 * 60 * 1000);
    nextPhaseDate = nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const onPct = cycleLength > 0 ? (onDays / cycleLength) * 100 : 50;
  const progressPct = cycleLength > 0 ? (dayInCycle / cycleLength) * 100 : 0;

  return (
    <div className="space-y-5 px-4 pb-6">
      <h3 className="text-base font-semibold text-foreground">Cycle Settings</h3>

      {/* Toggle */}
      <div className="flex items-center justify-center gap-4 py-4">
        <span className="text-sm text-muted-foreground">Cycling</span>
        <button
          type="button"
          onClick={() => onUpdate({ cyclingEnabled: !formData.cyclingEnabled })}
          className="w-14 h-7 rounded-full transition-colors duration-200 relative"
          style={{ backgroundColor: formData.cyclingEnabled ? `hsl(${accentColor})` : 'hsl(var(--muted))' }}
        >
          <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-foreground transition-transform duration-200 ${formData.cyclingEnabled ? 'left-[calc(100%-26px)]' : 'left-0.5'}`} />
        </button>
        <span className="text-sm font-medium" style={{ color: formData.cyclingEnabled ? `hsl(${accentColor})` : 'hsl(var(--muted-foreground))' }}>
          {formData.cyclingEnabled ? 'ON' : 'OFF'}
        </span>
      </div>

      {!formData.cyclingEnabled ? (
        <p className="text-center text-sm text-muted-foreground py-6">No cycling — this compound is taken continuously.</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">ON duration</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  inputMode="numeric"
                  value={formData.cycleOnDays}
                  onChange={e => onUpdate({ cycleOnDays: e.target.value })}
                  className="flex-1 rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
                />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">OFF duration</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  inputMode="numeric"
                  value={formData.cycleOffDays}
                  onChange={e => onUpdate({ cycleOffDays: e.target.value })}
                  className="flex-1 rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
                />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cycle start date</label>
            <DatePickerInput
              value={formData.cycleStartDate}
              onChange={v => onUpdate({ cycleStartDate: v })}
              placeholder="Pick a start date"
            />
          </div>

          {/* Live cycle timeline */}
          {cycleLength > 0 && (
            <div className="space-y-2">
              {/* Timeline bar */}
              <div className="relative h-4 rounded-full overflow-hidden border border-border/30">
                {/* ON segment */}
                <div
                  className="absolute inset-y-0 left-0 rounded-l-full"
                  style={{ width: `${onPct}%`, backgroundColor: `hsl(${accentColor} / 0.25)` }}
                />
                {/* Labels */}
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-bold uppercase tracking-wider" style={{ color: `hsl(${accentColor} / 0.7)` }}>
                  ON — {onDays}d
                </span>
                <span className="absolute top-1/2 -translate-y-1/2 text-[8px] font-bold text-muted-foreground/60 uppercase tracking-wider" style={{ left: `${Math.min(onPct + 2, 70)}%` }}>
                  OFF — {offDays}d
                </span>
                {/* Today marker */}
                {formData.cycleStartDate && (
                  <div className="absolute top-0 bottom-0 w-0.5 z-10" style={{ left: `${progressPct}%` }}>
                    <div className="w-full h-full" style={{ backgroundColor: `hsl(${accentColor})` }} />
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-card" style={{ backgroundColor: `hsl(${accentColor})` }} />
                  </div>
                )}
              </div>

              {/* Status text */}
              {formData.cycleStartDate && (
                <div className="space-y-1 text-xs font-mono text-muted-foreground">
                  <p>Currently in: <span className="font-semibold" style={{ color: `hsl(${accentColor})` }}>{isOn ? 'ON' : 'OFF'} phase</span></p>
                  <p>Days remaining in this phase: <span className="font-semibold text-foreground">{daysLeftInPhase}</span></p>
                  <p>Next {isOn ? 'OFF' : 'ON'} starts: <span className="font-semibold text-foreground">{nextPhaseDate}</span></p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cycle notes</label>
            <input
              type="text"
              value={formData.cycleNotes}
              onChange={e => onUpdate({ cycleNotes: e.target.value })}
              placeholder="e.g. 2 weeks on, 2 weeks off per manufacturer guidance"
              className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex-1 py-3 rounded-xl text-sm font-medium text-muted-foreground border border-border/50 hover:bg-secondary transition-colors">Back</button>
        <button type="button" onClick={onNext} className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all" style={{ backgroundColor: `hsl(${accentColor})`, color: 'hsl(var(--background))' }}>Continue</button>
      </div>
    </div>
  );
}
