import { ToleranceLevel } from '@/hooks/useProtocolAnalysis';

interface ToleranceSelectorProps {
  value: ToleranceLevel;
  onChange: (level: ToleranceLevel) => void;
}

const levels: { value: ToleranceLevel; label: string; icon: string; desc: string }[] = [
  { value: 'conservative', label: 'Conservative', icon: '🛡️', desc: 'Clinical-grade' },
  { value: 'moderate', label: 'Moderate', icon: '⚖️', desc: 'Balanced' },
  { value: 'aggressive', label: 'Aggressive', icon: '⚡', desc: 'Short-term max' },
  { value: 'performance', label: 'Performance', icon: '🚀', desc: 'Supra-human' },
];

const ToleranceSelector = ({ value, onChange }: ToleranceSelectorProps) => (
  <div className="flex gap-1.5 flex-wrap">
    {levels.map(l => (
      <button
        key={l.value}
        onClick={() => onChange(l.value)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
          value === l.value
            ? 'bg-primary/15 border-primary/40 text-primary'
            : 'bg-secondary/50 border-border/50 text-muted-foreground hover:bg-secondary'
        }`}
      >
        <span>{l.icon}</span>
        <span>{l.label}</span>
      </button>
    ))}
  </div>
);

export default ToleranceSelector;
