import type { FC } from 'react';
import { Check } from 'lucide-react';
import type { OnboardingStep } from '../../stores/useOnboardingStore';
import { roman } from '../manuscript/roman';

const STEPS: { id: OnboardingStep; label: string; subtitle: string }[] = [
  { id: 1, label: '配 钥',  subtitle: 'API Key' },
  { id: 2, label: '拟 题',  subtitle: 'Topic'   },
  { id: 3, label: '定 律',  subtitle: 'Pace'    },
];

const OnboardingProgress: FC<{ currentStep: OnboardingStep }> = ({ currentStep }) => {
  if (currentStep === 0) return null;
  return (
    <div className="w-full max-w-2xl mx-auto mb-12">
      <div className="flex items-center gap-3 mb-4">
        <span className="smallcaps">序 · Prologue</span>
        <div className="flex-1 h-px bg-gilt-500/40" />
        <span className="font-mono text-[10px] text-ink-fade tabular-nums">
          {String(currentStep).padStart(2, '0')} / 03
        </span>
      </div>

      <div className="flex items-start">
        {STEPS.map((step, idx) => {
          const isDone    = currentStep > step.id;
          const isActive  = currentStep === step.id;
          return (
            <div key={step.id} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2 flex-1">
                <div
                  className={`relative w-12 h-12 flex items-center justify-center transition-all duration-500
                    ${isDone
                      ? 'border-2 border-seal-500 text-seal-500 bg-seal-50 dark:bg-seal-700/20'
                      : isActive
                        ? 'border-2 border-seal-400 text-seal-500 bg-paper scale-110'
                        : 'border border-ink-300 dark:border-ink-600 text-ink-fade bg-paper/40'
                    }`}
                  style={{ transform: isActive ? 'rotate(-2deg) scale(1.1)' : isDone ? 'rotate(1deg)' : 'none' }}
                >
                  {isDone
                    ? <Check size={18} strokeWidth={2.5} />
                    : <span className="font-display text-lg italic font-semibold">{roman(step.id)}</span>
                  }
                  {isActive && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-seal-500 rounded-full animate-flame" />
                  )}
                </div>

                <div className="text-center">
                  <div className={`font-display text-sm font-medium tracking-wider
                    ${isActive ? 'text-seal-500' : isDone ? 'text-ink-700 dark:text-ink-100' : 'text-ink-fade'}`}>
                    {step.label}
                  </div>
                  <div className="font-mono text-[8px] tracking-widest text-ink-fade uppercase mt-0.5">
                    {step.subtitle}
                  </div>
                </div>
              </div>

              {idx < STEPS.length - 1 && (
                <div className="flex-1 h-12 flex items-center px-2">
                  <div className="w-full h-px relative">
                    <div
                      className={`absolute inset-0 transition-colors duration-500
                        ${isDone ? 'bg-seal-400' : 'bg-ink-200 dark:bg-ink-700'}`}
                    />
                    {isDone && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-seal-400/60 to-transparent animate-flow bg-[length:200%_100%]" />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingProgress;
