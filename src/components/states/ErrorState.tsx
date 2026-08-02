import { useState, type FC, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
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
  showDetails?: boolean;
  icon?: ReactNode;
}

const LEVEL_DEFAULT_TITLE: Record<ErrorLevel, string> = {
  network: '网 络 连 接 已 断',
  api: 'AI 服 务 调 用 失 败',
  auth: '身 份 验 证 失 败',
  notfound: '未 找 到 对 应 内 容',
  unknown: '出 现 了 一 些 问 题',
};

const LEVEL_DEFAULT_DESC: Record<ErrorLevel, string> = {
  network: '请 检 查 网 络 连 接 后 重 试。',
  api: '请 检 查 API Key 与 配 置,或 稍 后 重 试。',
  auth: '请 前 往 设 置 重 新 配 置 API Key。',
  notfound: '该 内 容 可 能 已 被 删 除 或 链 接 失 效。',
  unknown: '请 稍 后 重 试 或 前 往 设 置 检 查 配 置。',
};

const LEVEL_DEFAULT_ACTIONS: Record<ErrorLevel, { label: string; variant: 'primary' | 'secondary' | 'ghost'; disabled?: boolean }[]> = {
  network: [{ label: '重 试', variant: 'primary' }],
  api: [
    { label: '去 设 置', variant: 'primary' },
    { label: '重 试',     variant: 'secondary' },
  ],
  auth: [{ label: '去 设 置', variant: 'primary' }],
  notfound: [{ label: '返 回 首 页', variant: 'primary' }],
  unknown: [{ label: '重 试', variant: 'primary' }],
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
  const navigate = useNavigate();
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
        if (a.label === '去 设 置' || a.label === '去设置') navigate('/settings');
        else if (a.label === '返 回 首 页' || a.label === '返回首页') navigate('/');
        else if (onRetry) onRetry();
      },
    }));

  return (
    <div role="alert" className={`${STATE_VARIANT_CLASS[variant]} text-center ${className}`}>
      {finalIllus && <div className="flex justify-center mb-6">{finalIllus}</div>}

      <h3 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100 mb-2 tracking-tight">
        {finalTitle}
      </h3>
      <p className="font-display italic text-sm text-ink-fade dark:text-ink-soft mb-6 max-w-md mx-auto leading-relaxed">
        {finalDesc}
      </p>

      {finalActions.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-center">
          {finalActions.map((action, idx) => {
            const isPrimary = action.variant === 'primary' || !action.variant;
            const isRetryAction = action.label.includes('重 试') || action.label.includes('重试');
            const variantClass = isPrimary
              ? 'bg-seal-500 hover:bg-seal-400 text-ink-50 border-2 border-seal-600'
              : action.variant === 'ghost'
                ? 'text-ink-fade hover:text-seal-500 hover:bg-ink-100/50 dark:hover:bg-night-300/50 border-2 border-transparent'
                : 'border border-ink-300 dark:border-ink-600 hover:border-seal-400 hover:text-seal-500 text-ink-600 dark:text-ink-200 bg-transparent';
            return (
              <button
                key={idx}
                onClick={action.onClick}
                disabled={action.disabled || (isRetryAction && isRetrying)}
                className={`px-5 py-2.5 font-display text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variantClass}`}
              >
                {isRetryAction && isRetrying ? '重 试 中 …' : action.label}
              </button>
            );
          })}
        </div>
      )}

      {showDetails && errorText && (
        <div className="mt-6 text-left">
          <button
            onClick={() => setDetailsOpen((v) => !v)}
            className="font-display italic text-xs text-ink-fade hover:text-seal-500 transition-colors
              border-b border-dotted border-ink-fade/40 hover:border-seal-500"
          >
            {detailsOpen ? '收 起' : '查 看'}技 术 详 情
          </button>
          {detailsOpen && (
            <pre className="mt-2 p-3 bg-ink-700 text-ink-100 text-xs font-mono overflow-auto max-h-40 border-l-2 border-gilt-500">
              {errorText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default ErrorState;
