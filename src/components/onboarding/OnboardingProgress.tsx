import type { FC } from 'react';
import { Check } from 'lucide-react';
import type { OnboardingStep } from '../../stores/useOnboardingStore';

const STEPS: { id: OnboardingStep; label: string }[] = [
  { id: 1, label: '选择服务' },
  { id: 2, label: '配置 Key' },
  { id: 3, label: '学习主题' },
  { id: 4, label: '目标节奏' },
];

const OnboardingProgress: FC<{ currentStep: OnboardingStep }> = ({ currentStep }) => {
  if (currentStep === 0) return null;
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, idx) => {
        const isDone = currentStep > step.id;
        const isActive = currentStep === step.id;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  isDone
                    ? 'bg-primary-600 text-white'
                    : isActive
                      ? 'bg-white text-primary-600 ring-4 ring-primary-200 dark:ring-primary-900/50'
                      : 'bg-white/30 text-white/70'
                }`}
              >
                {isDone ? <Check size={14} /> : step.id}
              </div>
              <span
                className={`text-[10px] ${
                  isActive
                    ? 'text-white font-medium'
                    : isDone
                      ? 'text-white/80'
                      : 'text-white/50'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-1 mb-4 rounded-full transition-colors ${
                  isDone ? 'bg-primary-500' : 'bg-white/20'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default OnboardingProgress;
