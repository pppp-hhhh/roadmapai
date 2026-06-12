import type { FC } from 'react';
import { Check } from 'lucide-react';
import type { WizardStep } from '../../stores/useCreateRoadmapWizardStore';
import { roman } from '../manuscript/roman';

const STEPS: { id: WizardStep; label: string; subtitle: string }[] = [
  { id: 1, label: '主 题', subtitle: 'Topic'    },
  { id: 2, label: '水 平', subtitle: 'Level'    },
  { id: 3, label: '目 标', subtitle: 'Goal'     },
  { id: 4, label: '偏 好', subtitle: 'Pace'     },
];

interface WizardProgressProps {
  currentStep: WizardStep;
  onStepClick?: (step: WizardStep) => void;
}

const WizardProgress: FC<WizardProgressProps> = ({ currentStep, onStepClick }) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {STEPS.map((step, idx) => {
          const isDone = currentStep > step.id;
          const isActive = currentStep === step.id;
          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => onStepClick?.(step.id)}
                disabled={!onStepClick}
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className={`w-11 h-11 flex items-center justify-center transition-all duration-500
                    ${isDone
                      ? 'border-2 border-seal-500 bg-seal-50 dark:bg-seal-700/15 text-seal-500'
                      : isActive
                        ? 'border-2 border-seal-400 bg-paper dark:bg-night-200 text-seal-500'
                        : 'border border-ink-300 dark:border-ink-600 text-ink-fade bg-paper/40 dark:bg-night-200/40'
                    }`}
                  style={{ transform: isActive ? 'rotate(-2deg) scale(1.05)' : isDone ? 'rotate(1deg)' : 'none' }}
                >
                  {isDone
                    ? <Check size={16} strokeWidth={2.5} />
                    : <span className="font-display italic text-lg font-semibold">{roman(step.id)}</span>
                  }
                </div>
                <div className="text-center">
                  <div className={`font-display text-sm font-medium tracking-wider
                    ${isActive ? 'text-seal-500' : isDone ? 'text-ink-700 dark:text-ink-100' : 'text-ink-fade'}`}>
                    {step.label}
                  </div>
                  <div className="font-mono text-[8px] tracking-widest text-ink-fade/60 uppercase mt-0.5">
                    {step.subtitle}
                  </div>
                </div>
              </button>
              {idx < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-2 mb-5 relative bg-ink-200 dark:bg-ink-700">
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-500
                      ${isDone ? 'bg-seal-400 w-full' : 'w-0'}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WizardProgress;
