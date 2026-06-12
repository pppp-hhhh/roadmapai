import type { FC, ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

interface WizardShellProps {
  title: string;
  subtitle?: string;
  aiHint: string;
  children: ReactNode;
}

const WizardShell: FC<WizardShellProps> = ({ title, subtitle, aiHint, children }) => {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="font-display italic text-sm text-ink-fade dark:text-ink-soft mt-1.5 leading-relaxed">
            {subtitle}
          </p>
        )}
      </header>

      <div>{children}</div>

      {/* AI 提示卡 — 朱砂批注条 */}
      <div className="flex items-start gap-2.5 border-l-2 border-seal-400 pl-4 py-2.5
        bg-seal-50/40 dark:bg-seal-700/10">
        <Sparkles size={14} className="text-seal-500 flex-shrink-0 mt-0.5" />
        <p className="font-display text-xs text-ink-600 dark:text-ink-200 leading-relaxed">
          <span className="font-semibold text-seal-500">AI 接 下 来 会 做 什 么 · </span>
          {aiHint}
        </p>
      </div>
    </div>
  );
};

export default WizardShell;
