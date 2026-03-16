import { useEffect, useRef } from 'react';
import { WizardFormData, CompoundType, COMPOUND_TYPE_META, CATEGORY_OPTIONS, getAccentColor } from '../types';
import { Syringe, Pill, FlaskConical, Droplets, ClipboardList, type LucideIcon } from 'lucide-react';

const TYPE_ICONS: Record<string, LucideIcon> = {
  Syringe,
  Pill,
  FlaskConical,
  Droplets,
  ClipboardList,
};

interface StepIdentityProps {
  formData: WizardFormData;
  onUpdate: (data: Partial<WizardFormData>) => void;
  onNext: () => void;
  accentColor: string;
}

const typeEntries = Object.entries(COMPOUND_TYPE_META) as [CompoundType, typeof COMPOUND_TYPE_META[CompoundType]][];

export default function StepIdentity({ formData, onUpdate, onNext, accentColor }: StepIdentityProps) {
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const canProceed = formData.name.trim().length > 0 && formData.compoundType !== null;

  const selectType = (type: CompoundType) => {
    const meta = COMPOUND_TYPE_META[type];
    onUpdate({
      compoundType: type,
      category: meta.category,
    });
  };

  return (
    <div className="space-y-6 px-4 pb-6">
      {/* Compound Name */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Compound name</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Required</p>
        </div>
        <input
          ref={nameRef}
          type="text"
          value={formData.name}
          onChange={e => onUpdate({ name: e.target.value })}
          placeholder="Enter compound name (e.g. BPC-157)"
          className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-base font-semibold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
          onKeyDown={e => { if (e.key === 'Enter' && canProceed) onNext(); }}
        />
        {formData.name.trim().length === 0 && (
          <p className="text-xs text-muted-foreground">Type a compound name to unlock Continue.</p>
        )}
      </div>

      {/* Compound Type Grid */}
      <div>
        <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Type</p>
        <div className="grid grid-cols-2 gap-2">
          {typeEntries.map(([type, meta]) => {
            const selected = formData.compoundType === type;
            const typeAccent = getAccentColor(meta.category);
            return (
              <button
                key={type}
                type="button"
                onClick={() => selectType(type)}
                className="flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 text-left min-h-[72px]"
                style={{
                  borderColor: selected ? `hsl(${typeAccent})` : 'hsl(var(--border) / 0.5)',
                  backgroundColor: selected ? `hsl(${typeAccent} / 0.08)` : 'transparent',
                  boxShadow: selected ? `0 0 0 1px hsl(${typeAccent} / 0.4)` : 'none',
                }}
              >
                <span className="text-2xl mt-0.5">{meta.icon}</span>
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-foreground block">{meta.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-snug">{meta.subtitle}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Category */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Category</p>
        <select
          value={formData.category}
          onChange={e => onUpdate({ category: e.target.value as any })}
          className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {CATEGORY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Purpose Note */}
      <div>
        <input
          type="text"
          value={formData.purposeNote}
          onChange={e => onUpdate({ purposeNote: e.target.value })}
          placeholder="What is this compound for? (optional)"
          className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* Next Button */}
      {!canProceed && (
        <p className="text-xs text-muted-foreground text-center animate-pulse">
          Enter a compound name above to continue
        </p>
      )}
      <button
        type="button"
        disabled={!canProceed}
        onClick={onNext}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          backgroundColor: canProceed ? `hsl(${accentColor})` : 'hsl(var(--muted))',
          color: canProceed ? 'hsl(var(--background))' : 'hsl(var(--muted-foreground))',
          boxShadow: canProceed ? `0 0 20px hsl(${accentColor} / 0.3)` : 'none',
        }}
      >
        Continue
      </button>
    </div>
  );
}
