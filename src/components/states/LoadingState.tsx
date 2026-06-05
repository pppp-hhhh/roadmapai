import type { FC, ReactNode } from 'react';
import { STATE_VARIANT_CLASS, type StateProps } from './types';

export type LoadingVariant = 'spinner' | 'progress' | 'linear';

interface LoadingStateProps extends StateProps {
  loadingVariant?: LoadingVariant;
  /** progress variant: 0..1 */
  progress?: number;
  /** progress variant: 已完成/总步骤 */
  steps?: { done: number; total: number; labels?: string[] };
  /** 当前阶段文字 */
  message?: string;
  icon?: ReactNode;
}

const SpinnerBlock: FC = () => (
  <div className="flex justify-center mb-6">
    <div className="w-12 h-12 border-4 border-primary-200 dark:border-primary-900 border-t-primary-600 dark:border-t-primary-400 rounded-full animate-spin" />
  </div>
);

const ProgressBlock: FC<{ steps?: { done: number; total: number; labels?: string[] }; message?: string }> = ({
  steps,
  message,
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
              className={`w-3 h-3 rounded-full transition-colors ${
                isDone
                  ? 'bg-primary-600 dark:bg-primary-400'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
            {steps?.labels?.[i] && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {steps.labels[i]}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {message && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 text-center">
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
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-primary-600 dark:bg-primary-400 transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{message ?? '加载中…'}</span>
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
    <div
      role="status"
      aria-live="polite"
      className={`${STATE_VARIANT_CLASS[variant]} text-center ${className}`}
    >
      {loadingVariant === 'spinner' && <SpinnerBlock />}
      {loadingVariant === 'progress' && <ProgressBlock steps={steps} message={message} />}
      {loadingVariant === 'linear' && <LinearBlock progress={progress} message={message} />}

      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {title}
        </h3>
      )}
      {showBody && description && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      )}
      {!showBody && description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          {description}
        </p>
      )}
    </div>
  );
};

export default LoadingState;
