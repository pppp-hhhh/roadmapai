import type { FC, ReactNode } from 'react';
import { STATE_VARIANT_CLASS, type StateProps } from './types';

interface EmptyStateProps extends StateProps {
  icon?: ReactNode;
}

const EmptyState: FC<EmptyStateProps> = ({
  variant = 'card',
  title = '暂无内容',
  description,
  illustration,
  icon,
  actions,
  className = '',
}) => {
  return (
    <div
      role="status"
      className={`${STATE_VARIANT_CLASS[variant]} text-center ${className}`}
    >
      {(illustration || icon) && (
        <div className="flex justify-center mb-6">
          {illustration || icon}
        </div>
      )}
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
          {description}
        </p>
      )}
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-center">
          {actions.map((action, idx) => {
            const variantClass =
              action.variant === 'secondary'
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                : action.variant === 'ghost'
                  ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm';
            return (
              <button
                key={idx}
                onClick={action.onClick}
                disabled={action.disabled}
                className={`px-5 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClass}`}
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
