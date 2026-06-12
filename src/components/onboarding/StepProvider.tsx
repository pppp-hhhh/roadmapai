import type { FC } from 'react';
import { Sparkles, Zap, Brain, Wrench, type LucideIcon } from 'lucide-react';
import {
  useOnboardingStore,
  type ProviderChoice,
} from '../../stores/useOnboardingStore';
import { roman } from '../manuscript/roman';

const PROVIDER_OPTIONS: {
  value: ProviderChoice;
  label: string;
  desc: string;
  icon: LucideIcon;
  recommended?: boolean;
}[] = [
  { value: 'anthropic', label: 'Anthropic Claude', desc: '深度推理强,适合系统化学习', icon: Sparkles, recommended: true },
  { value: 'openai',    label: 'OpenAI GPT-4o',    desc: '综合实力强,生态丰富',         icon: Brain    },
  { value: 'deepseek',  label: 'DeepSeek',         desc: '国内访问快,中文能力强',        icon: Zap      },
  { value: 'custom',    label: '自定义端点',        desc: '兼容 OpenAI 协议即可',         icon: Wrench   },
];

const StepProvider: FC = () => {
  const { provider, setField } = useOnboardingStore();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <div className="smallcaps mb-3">第 一 章 · 择 墨</div>
        <h2 className="font-display text-[40px] font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-tight mb-2">
          选择<span className="italic text-seal-500"> 你的墨 </span>
        </h2>
        <p className="font-display italic text-base text-ink-fade">
          一管好墨,胜过千张白纸。 — 可在设置中随时更换
        </p>
        <div className="rule-gilt mt-5 max-w-xs mx-auto" />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {PROVIDER_OPTIONS.map((opt, i) => {
          const Icon = opt.icon;
          const selected = provider === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setField('provider', opt.value)}
              className={`relative p-5 text-left transition-all duration-200 border
                ${selected
                  ? 'bg-paper border-seal-400 shadow-ink-2 -translate-y-0.5'
                  : 'bg-ink-50/60 dark:bg-night-200/40 border-ink-200 dark:border-ink-700/40 hover:border-seal-400/60 hover:bg-ink-50 dark:hover:bg-night-100/60'
                }`}
            >
              <span className="absolute top-3 right-3 font-display italic text-2xl
                text-ink-200 dark:text-ink-700/60 select-none">
                {roman(i + 1)}
              </span>

              {opt.recommended && (
                <span className="seal-stamp absolute -top-2 -right-2 text-seal-500 border-seal-500 bg-ink-50 dark:bg-night-100 text-[8px]">
                  推 荐
                </span>
              )}

              <div className="flex items-center gap-3 mb-3">
                <div className={`w-11 h-11 flex items-center justify-center border
                  ${selected
                    ? 'border-seal-400 bg-seal-50 dark:bg-seal-700/20 text-seal-500'
                    : 'border-ink-300 dark:border-ink-600 text-ink-500 dark:text-ink-200'
                  }`}>
                  <Icon size={20} />
                </div>
                <div className="font-display text-lg font-semibold text-ink-700 dark:text-ink-100 tracking-tight">
                  {opt.label}
                </div>
              </div>
              <div className="font-display italic text-sm text-ink-fade leading-relaxed">
                {opt.desc}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StepProvider;
