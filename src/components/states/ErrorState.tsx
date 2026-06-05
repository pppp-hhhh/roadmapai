import { useState, type FC, type ReactNode } from 'react';
import {
  NetworkDownIllustration,
  KeyIllustration,
  LockIllustration,
  BugIllustration,
  SearchIllustration,
} from './illustrations';
import { STATE_VARIANT_CLASS, type StateProps, type StateAction } from './types';

export type ErrorLevel = 'network' | 'api' | 'auth' | 'notfound' | 'unknown';

interface ErrorStateProps extends StateProps {
  level?: ErrorLevel;
  error?: unknown;
  isRetrying?: boolean;
  onRetry?: () => void;
  /** 折叠错误详情 */
  showDetails?: boolean;
  icon?: ReactNode;
}

const LEVEL_DEFAULT_TITLE: Record<ErrorLevel, string> = {
  network: '网络连接已断开',
  api: 'AI 服务调用失败',
  auth: '身份验证失败',
  notfound: '没有找到对应内容',
  unknown: '出现了一些问题',
};

const LEVEL_DEFAULT_DESC: Record<ErrorLevel, string> = {
  network: '请检查网络连接后重试。',
  api: '请检查 API Key 与配置，或稍后重试。',
  auth: '请前往设置重新配置 API Key。',
  notfound: '该内容可能已被删除或链接失效。',
  unknown: '请稍后重试或前往设置检查配置。',
};

const LEVEL_DEFAULT_ACTIONS: Record<ErrorLevel, { label: string; variant: 'primary' | 'secondary' | 'ghost'; disabled?: boolean }[]> = {
  network: [{ label: '重试', variant: 'primary' }],
  api: [
    { label: '去设置', variant: 'primary' },
    { label: '重试', variant: 'secondary' },
  ],
  auth: [{ label: '去设置', variant: 'primary' }],
  notfound: [{ label: '返回首页', variant: 'primary' }],
  unknown: [{ label: '重试', variant: 'primary' }],
};

const LEVEL_ILLUSTRATION: Record<ErrorLevel, ReactNode> = {
  network: <NetworkDownIllustration />,
  api: <KeyIllustration />,
  auth: <LockIllustration />,
  notfound: <SearchIllustration />,
  unknown: <BugIllustration />,
};

const ErrorState: FC<ErrorStateProps> = ({
  variant = 'card',
  level = 'unknown',
  error,
  isRetrying = false,
  onRetry,
  showDetails = true,
  title,
  description,
  illustration,
  actions,
  className = '',
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const errorText = error ? (error instanceof Error ? error.message : String(error)) : null;

  const finalTitle = title ?? LEVEL_DEFAULT_TITLE[level];
  const finalDesc = description ?? LEVEL_DEFAULT_DESC[level];
  const finalIllus = illustration ?? LEVEL_ILLUSTRATION[level];

  const finalActions: StateAction[] =
    actions ??
    LEVEL_DEFAULT_ACTIONS[level].map((a) => ({
      label: a.label,
      variant: a.variant,
      disabled: a.disabled,
      onClick: () => {
        if (a.label === '去设置') {
          window.location.assign('/settings');
        } else if (a.label === '返回首页') {
          window.location.assign('/');
        } else if (onRetry) {
          onRetry();
        }
      },
    }));

  return (
    <div
      role="alert"
      className={`${STATE_VARIANT_CLASS[variant]} text-center ${className}`}
    >
      {finalIllus && <div className="flex justify-center mb-6">{finalIllus}</div>}

      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {finalTitle}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
        {finalDesc}
      </p>

      {finalActions.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-center">
          {finalActions.map((action, idx) => {
            const variantClass =
              action.variant === 'secondary'
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                : action.variant === 'ghost'
                  ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm';
            const isRetryAction = action.label === '重试';
            return (
              <button
                key={idx}
                onClick={action.onClick}
                disabled={action.disabled || (isRetryAction && isRetrying)}
                className={`px-5 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClass}`}
              >
                {isRetryAction && isRetrying ? '重试中…' : action.label}
              </button>
            );
          })}
        </div>
      )}

      {showDetails && errorText && (
        <div className="mt-6 text-left">
          <button
            onClick={() => setDetailsOpen((v) => !v)}
            className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
          >
            {detailsOpen ? '收起' : '查看'}技术详情
          </button>
          {detailsOpen && (
            <pre className="mt-2 p-3 rounded-lg bg-gray-100 dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-40">
              {errorText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default ErrorState;
