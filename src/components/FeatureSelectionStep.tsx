import { AppFeatures, FEATURE_META } from '@/lib/appFeatures';
import { Check, MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';

interface FeatureSelectionStepProps {
  features: AppFeatures;
  onToggle: (key: keyof AppFeatures) => void;
  onRequestFeature?: (text: string) => void;
  compact?: boolean;
}

const FeatureSelectionStep = ({ features, onToggle, onRequestFeature, compact }: FeatureSelectionStepProps) => {
  const [showRequest, setShowRequest] = useState(false);
  const [requestText, setRequestText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitRequest = () => {
    if (!requestText.trim() || !onRequestFeature) return;
    onRequestFeature(requestText.trim());
    setRequestText('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {!compact && (
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold text-foreground">What do you want to track?</h2>
          <p className="text-sm text-muted-foreground">Select the features you'd like to use. You can always enable more later.</p>
        </div>
      )}

      {(Object.entries(FEATURE_META) as [keyof AppFeatures, typeof FEATURE_META[keyof AppFeatures]][]).map(([key, meta]) => {
        const enabled = features[key];
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
              enabled
                ? 'border-primary/50 bg-primary/5'
                : 'border-border/50 bg-card hover:border-border'
            }`}
          >
            <meta.icon className="w-5 h-5 flex-shrink-0 text-primary/70" />
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-semibold block ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                {meta.label}
              </span>
              {!compact && (
                <span className="text-[11px] text-muted-foreground leading-snug">{meta.description}</span>
              )}
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              enabled ? 'bg-primary border-primary' : 'border-muted-foreground/30'
            }`}>
              {enabled && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
          </button>
        );
      })}

      {/* Request a Feature */}
      {onRequestFeature && (
        <div className="pt-2">
          {!showRequest ? (
            <button
              onClick={() => setShowRequest(true)}
              className="w-full flex items-center gap-2 p-3 rounded-xl border border-dashed border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span className="text-xs font-medium">Request a Feature</span>
            </button>
          ) : submitted ? (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-center">
              <p className="text-sm font-semibold text-primary">Thanks for your feedback! 🙌</p>
              <p className="text-[11px] text-muted-foreground mt-1">We'll review your request and get back to you.</p>
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-border/50 bg-card space-y-2">
              <textarea
                value={requestText}
                onChange={e => setRequestText(e.target.value)}
                placeholder="Describe the feature you'd like to see..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border/50 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSubmitRequest}
                  disabled={!requestText.trim()}
                  className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40"
                >
                  Submit Request
                </button>
                <button
                  onClick={() => { setShowRequest(false); setRequestText(''); }}
                  className="px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FeatureSelectionStep;
