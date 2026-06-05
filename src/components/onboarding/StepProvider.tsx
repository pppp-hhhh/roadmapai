import type { FC } from 'react';
import { Sparkles, Zap, Brain, Wrench, type LucideIcon } from 'lucide-react';
import {
  useOnboardingStore,
  type ProviderChoice,
} from '../../stores/useOnboardingStore';

const PROVIDER_OPTIONS: {
  value: ProviderChoice;
  label: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  recommended?: string;
}[] = [
  {
    value: 'anthropic',
    label: 'Anthropic Claude',
    desc: '深度推理强,适合系统化学习',
    icon: Sparkles,
    color: 'from-orange-500 to-pink-500',
  },
  {
    value: 'openai',
    label: 'OpenAI GPT-4o',
    desc: '综合实力强,生态丰富',
    icon: Brain,
    color: 'from-green-500 to-emerald-500',
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    desc: '国内访问快,中文能力强',
    icon: Zap,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    value: 'custom',
    label: '自定义端点',
    desc: '兼容 OpenAI 协议即可',
    icon: Wrench,
    color: 'from-gray-500 to-slate-500',
  },
];

const StepProvider: FC = () => {
  const { provider, setField } = useOnboardingStore();

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold text-white text-center mb-2">选择 AI 服务</h2>
      <p className="text-white/70 text-center mb-8">可以随时在设置中切换</p>

      <div className="grid md:grid-cols-2 gap-3">
        {PROVIDER_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = provider === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setField('provider', opt.value)}
              className={`relative p-5 rounded-2xl text-left transition-all ${
                selected
                  ? 'bg-white text-gray-900 shadow-2xl scale-[1.02]'
                  : 'bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20'
              }`}
            >
              {opt.recommended && (
                <span
                  className={`absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    selected ? 'bg-primary-600 text-white' : 'bg-white/20 text-white'
                  }`}
                >
                  {opt.recommended}
                </span>
              )}
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${opt.color} flex items-center justify-center text-white`}
                >
                  <Icon size={20} />
                </div>
                <div className="font-semibold">{opt.label}</div>
              </div>
              <div className={`text-sm ${selected ? 'text-gray-600' : 'text-white/70'}`}>
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
