import { WizardStep, stepToIndex, STEP_ORDER } from './types';

interface WizardProgressProps {
  currentStep: WizardStep;
  highestStep: number;
  accentColor: string;
  onJump: (stepIndex: number) => void;
}

export default function WizardProgress({ currentStep, highestStep, accentColor, onJump }: WizardProgressProps) {
  const currentIdx = stepToIndex(currentStep);
  const totalSteps = STEP_ORDER.length;

  return (
    <div className="flex items-center justify-center gap-0 py-3 px-4">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const isCompleted = i <= highestStep && i < currentIdx;
        const isCurrent = i === currentIdx;
        const isUpcoming = !isCompleted && !isCurrent;
        const isAccessible = i <= highestStep;

        return (
          <div key={i} className="flex items-center">
            {/* Connecting line (before dot, skip first) */}
            {i > 0 && (
              <div
                className="h-[1px] transition-all duration-300 ease-out"
                style={{
                  width: '20px',
                  backgroundColor: i <= currentIdx
                    ? `hsl(${accentColor})`
                    : 'hsl(var(--border))',
                }}
              />
            )}

            {/* Dot */}
            <button
              type="button"
              disabled={!isAccessible}
              onClick={() => isAccessible && onJump(i)}
              className="relative flex items-center justify-center transition-all duration-200"
              style={{
                width: isCurrent ? '32px' : '32px', // 32px tap area always
                height: '32px',
              }}
            >
              <div
                className={`rounded-full transition-all duration-200 flex items-center justify-center ${
                  isCurrent ? 'animate-pulse-glow' : ''
                }`}
                style={{
                  width: isCurrent ? '10px' : '8px',
                  height: isCurrent ? '10px' : '8px',
                  backgroundColor: isCompleted || isCurrent
                    ? `hsl(${accentColor})`
                    : 'transparent',
                  border: isUpcoming
                    ? '1.5px solid hsl(var(--muted-foreground) / 0.3)'
                    : 'none',
                  boxShadow: isCurrent
                    ? `0 0 8px hsl(${accentColor} / 0.5)`
                    : 'none',
                }}
              >
                {isCompleted && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="absolute">
                    <path
                      d="M3 6L5.5 8.5L9 4"
                      stroke="hsl(var(--background))"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
