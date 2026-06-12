import type { FC, ReactNode } from 'react';
import { STATE_VARIANT_CLASS, type StateProps } from './types';

export type LoadingVariant = 'spinner' | 'progress' | 'linear';

interface LoadingStateProps extends StateProps {
  loadingVariant?: LoadingVariant;
  progress?: number;
  steps?: { done: number; total: number; labels?: string[] };
  message?: string;
  icon?: ReactNode;
}

const SpinnerBlock: FC = () => (
  <div className="flex justify-center mb-6">
    <div className="w-12 h-12 border-2 border-ink-300 dark:border-ink-600 border-t-seal-500 animate-spin"
      style={{ borderRadius: '50%' }} />
  </div>
);

const ProgressBlock: FC<{ steps?: { done: number; total: number; labels?: string[] }; message?: string }> = ({
  steps, message,
}) => {
  const dots = steps
    ? Array.from({ length: steps.total }, (_, i) => i < steps.done)
    : [false, false, false, false];
  const total = steps?.total ?? 4;
  const done = steps?.done ?? 0;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="w-full max-w-md mx-auto mb-6">
      <div className="flex justify-between items-center mb-3">
        {dots.map((isDone, i) => (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div
              className={`w-3 h-3 transition-colors ${
                isDone ? 'bg-seal-500' : 'bg-ink-200 dark:bg-ink-700'
              }`}
              style={{ borderRadius: '50%' }}
            />
            {steps?.labels?.[i] && (
              <span className="font-mono text-[10px] text-ink-fade">{steps.labels[i]}</span>
            )}
          </div>
        ))}
      </div>
      <div className="h-px bg-ink-200 dark:bg-ink-700 relative">
        <div className="absolute inset-y-0 left-0 bg-seal-400 transition-all duration-300"
          style={{ width: `${pct}%` }} />
      </div>
      {message && (
        <p className="font-display italic text-sm text-ink-fade dark:text-ink-soft mt-3 text-center">
          {message}
        </p>
      )}
    </div>
  );
};

const LinearBlock: FC<{ progress?: number; message?: string }> = ({ progress = 0, message }) => {
  const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
  return (
    <div className="w-full max-w-md mx-auto mb-6">
      <div className="h-px bg-ink-200 dark:bg-ink-700 relative mb-2">
        <div className="absolute inset-y-0 left-0 bg-seal-400 transition-all duration-200"
          style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between font-mono text-xs text-ink-fade">
        <span>{message ?? '加 载 中 …'}</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
};

const LoadingState: FC<LoadingStateProps> = ({
  variant = 'card',
  loadingVariant = 'spinner',
  progress = 0,
  steps,
  message,
  title,
  description,
  className = '',
}) => {
  const showBody = loadingVariant !== 'spinner';

  return (
    <div role="status" aria-live="polite" className={`${STATE_VARIANT_CLASS[variant]} text-center ${className}`}>
      {loadingVariant === 'spinner' && <SpinnerBlock />}
      {loadingVariant === 'progress' && <ProgressBlock steps={steps} message={message} />}
      {loadingVariant === 'linear' && <LinearBlock progress={progress} message={message} />}

      {title && (
        <h3 className="font-display text-lg font-semibold text-ink-700 dark:text-ink-100 mb-1 tracking-tight">
          {title}
        </h3>
      )}
      {showBody && description && (
        <p className="font-display italic text-sm text-ink-fade dark:text-ink-soft">{description}</p>
      )}
      {!showBody && description && (
        <p className="font-display italic text-sm text-ink-fade dark:text-ink-soft max-w-md mx-auto">{description}</p>
      )}
    </div>
  );
};

export default LoadingState;
