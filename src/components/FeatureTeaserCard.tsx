import { Plus } from 'lucide-react';
import { AppFeatures, FEATURE_META } from '@/lib/appFeatures';

interface FeatureTeaserCardProps {
  featureKey: keyof AppFeatures;
  onEnable: () => void;
}

const FeatureTeaserCard = ({ featureKey, onEnable }: FeatureTeaserCardProps) => {
  const meta = FEATURE_META[featureKey];

  return (
    <button
      onClick={onEnable}
      className="w-full rounded-xl border border-dashed border-border/40 bg-card/30 p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-all group"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl opacity-40 group-hover:opacity-70 transition-opacity">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-muted-foreground/60 group-hover:text-foreground/80 transition-colors block">
            {meta.label}
          </span>
          <span className="text-[10px] text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">
            Tap to enable
          </span>
        </div>
        <div className="p-1.5 rounded-full border border-border/30 group-hover:border-primary/50 group-hover:bg-primary/10 transition-all">
          <Plus className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
        </div>
      </div>
    </button>
  );
};

export default FeatureTeaserCard;
