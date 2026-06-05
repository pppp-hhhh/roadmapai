import type { FC } from 'react';
import { Clock, Target } from 'lucide-react';
import {
  useOnboardingStore,
  type OnboardingLevel,
} from '../../stores/useOnboardingStore';

const LEVELS: { value: OnboardingLevel; label: string; desc: string }[] = [
  { value: '入门', label: '入门', desc: '零基础,看过几篇博客' },
  { value: '进阶', label: '进阶', desc: '有基础,想系统化' },
  { value: '高级', label: '高级', desc: '有实操,想拓深' },
];

const HOURS = [2, 4, 6, 10];

const GOAL_PRESETS = ['求职面试', '期末复习', '项目实战', '个人兴趣'];

const StepPreferences: FC = () => {
  const { level, goal, weeklyHours, setField } = useOnboardingStore();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">目标与节奏</h2>
        <p className="text-white/70">帮 AI 估算时间与任务密度</p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-3">
          <Target size={14} />
          学习目标
        </label>
        <div className="grid grid-cols-2 gap-2">
          {GOAL_PRESETS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setField('goal', g)}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                goal === g
                  ? 'bg-white text-primary-700'
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-3">
          当前水平
        </label>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setField('level', l.value)}
              className={`p-3 rounded-xl text-left transition-colors ${
                level === l.value
                  ? 'bg-white text-gray-900'
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
              }`}
            >
              <div className="text-sm font-semibold">{l.label}</div>
              <div className={`text-[10px] mt-0.5 ${level === l.value ? 'text-gray-600' : 'text-white/60'}`}>
                {l.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-3">
          <Clock size={14} />
          每周可投入时间
        </label>
        <div className="grid grid-cols-4 gap-2">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setField('weeklyHours', h)}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                weeklyHours === h
                  ? 'bg-white text-primary-700'
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
              }`}
            >
              {h} 小时
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StepPreferences;
