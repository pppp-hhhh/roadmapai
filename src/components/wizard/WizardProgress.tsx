import type { FC } from 'react';
import { Check } from 'lucide-react';
import type { WizardStep } from '../../stores/useCreateRoadmapWizardStore';

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 1, label: '主题' },
  { id: 2, label: '水平' },
  { id: 3, label: '目标' },
  { id: 4, label: '偏好' },
];

interface WizardProgressProps {
  currentStep: WizardStep;
  onStepClick?: (step: WizardStep) => void;
}

const WizardProgress: FC<WizardProgressProps> = ({ currentStep, onStepClick }) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between max-w-md mx-auto">
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
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold transition-all ${
                    isDone
                      ? 'bg-primary-600 text-white'
                      : isActive
                        ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 ring-4 ring-primary-200/50 dark:ring-primary-900/30'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}
                >
                  {isDone ? <Check size={16} /> : step.id}
                </div>
                <span
                  className={`text-xs ${
                    isActive
                      ? 'text-primary-700 dark:text-primary-300 font-medium'
                      : isDone
                        ? 'text-gray-600 dark:text-gray-400'
                        : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </button>
              {idx < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 mb-5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-full transition-all duration-300 ${
                      currentStep > step.id
                        ? 'bg-primary-600 w-full'
                        : 'w-0'
                    }`}
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
