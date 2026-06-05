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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{title}</h2>
        {subtitle && <p className="text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </header>

      <div className="min-h-[200px]">{children}</div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 border border-primary-100 dark:border-primary-900/30">
        <Sparkles size={16} className="text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
          <span className="font-semibold text-primary-700 dark:text-primary-300">AI 接下来会做什么:</span>
          {aiHint}
        </p>
      </div>
    </div>
  );
};

export default WizardShell;
