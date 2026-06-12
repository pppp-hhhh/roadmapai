import type { FC, ReactNode } from 'react';
import { STATE_VARIANT_CLASS, type StateProps } from './types';

interface EmptyStateProps extends StateProps {
  icon?: ReactNode;
}

const EmptyState: FC<EmptyStateProps> = ({
  variant = 'card',
  title = '暂 无 内 容',
  description,
  illustration,
  icon,
  actions,
  className = '',
}) => {
  return (
    <div role="status" className={`${STATE_VARIANT_CLASS[variant]} text-center ${className}`}>
      {(illustration || icon) && (
        <div className="flex justify-center mb-6">{illustration || icon}</div>
      )}
      <h3 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100 mb-2 tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="font-display italic text-sm text-ink-fade dark:text-ink-soft mb-6 max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-center">
          {actions.map((action, idx) => {
            const isPrimary = action.variant === 'primary' || !action.variant;
            const variantClass = isPrimary
              ? 'bg-seal-500 hover:bg-seal-400 text-ink-50 border-2 border-seal-600'
              : action.variant === 'ghost'
                ? 'text-ink-fade hover:text-seal-500 hover:bg-ink-100/50 dark:hover:bg-night-300/50 border-2 border-transparent'
                : 'border border-ink-300 dark:border-ink-600 hover:border-seal-400 hover:text-seal-500 text-ink-600 dark:text-ink-200 bg-transparent';
            return (
              <button
                key={idx}
                onClick={action.onClick}
                disabled={action.disabled}
                className={`px-5 py-2.5 font-display text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variantClass}`}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
