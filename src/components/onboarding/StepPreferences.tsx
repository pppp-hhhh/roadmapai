import type { FC } from 'react';
import { Clock, Target, Compass } from 'lucide-react';
import {
  useOnboardingStore,
  type OnboardingLevel,
} from '../../stores/useOnboardingStore';
import { roman } from '../manuscript/roman';

const LEVELS: { value: OnboardingLevel; label: string; desc: string }[] = [
  { value: '入门', label: '入门', desc: '零基础,翻过几篇入门' },
  { value: '进阶', label: '进阶', desc: '有基础,欲系统化' },
  { value: '高级', label: '高级', desc: '有实操,欲拓深' },
];

const HOURS = [2, 4, 6, 10];

const GOAL_PRESETS = ['求职面试', '期末复习', '项目实战', '个人兴趣'];

const StepPreferences: FC = () => {
  const { level, goal, weeklyHours, setField } = useOnboardingStore();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <div className="smallcaps mb-3">第 四 章 · 定 律</div>
        <h2 className="font-display text-[40px] font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-tight mb-2">
          笔 速 与 志<span className="italic text-seal-500"> 向</span>
        </h2>
        <p className="font-display italic text-base text-ink-fade">
          知你律动,方可拟定纲目。
        </p>
        <div className="rule-gilt mt-5 max-w-xs mx-auto" />
      </div>

      <div className="space-y-6">
        <section>
          <label className="smallcaps mb-3 flex items-center gap-2 text-[10px]">
            <Target size={11} />
            <span>学 习 志 向</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {GOAL_PRESETS.map((g, i) => (
              <button
                key={g}
                type="button"
                onClick={() => setField('goal', g)}
                className={`relative px-4 py-3 font-display text-sm transition-all border
                  ${goal === g
                    ? 'bg-paper border-seal-400 text-seal-500 shadow-ink-1'
                    : 'bg-ink-50/50 dark:bg-night-200/40 border-ink-200 dark:border-ink-700/40 text-ink-600 dark:text-ink-200 hover:border-seal-400/60'
                  }`}
              >
                <span className="absolute top-1.5 left-2 font-display italic text-[10px] text-ink-fade/70">
                  {roman(i + 1)}
                </span>
                <span className="block pl-4">{g}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="smallcaps mb-3 flex items-center gap-2 text-[10px]">
            <Compass size={11} />
            <span>当 前 水 平</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((l, i) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setField('level', l.value)}
                className={`relative p-4 text-left transition-all border
                  ${level === l.value
                    ? 'bg-paper border-seal-400 shadow-ink-1'
                    : 'bg-ink-50/50 dark:bg-night-200/40 border-ink-200 dark:border-ink-700/40 hover:border-seal-400/60'
                  }`}
              >
                <span className="absolute top-2 right-2 font-display italic text-base
                  text-ink-200 dark:text-ink-700/60 select-none">
                  {roman(i + 1)}
                </span>
                <div className={`font-display text-base font-semibold mb-1
                  ${level === l.value ? 'text-seal-500' : 'text-ink-700 dark:text-ink-100'}`}>
                  {l.label}
                </div>
                <div className="font-display italic text-[11px] text-ink-fade leading-snug">
                  {l.desc}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="smallcaps mb-3 flex items-center gap-2 text-[10px]">
            <Clock size={11} />
            <span>每 周 可 投 入 时 间</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setField('weeklyHours', h)}
                className={`px-3 py-3 font-display text-sm transition-all border
                  ${weeklyHours === h
                    ? 'bg-paper border-seal-400 text-seal-500 shadow-ink-1'
                    : 'bg-ink-50/50 dark:bg-night-200/40 border-ink-200 dark:border-ink-700/40 text-ink-600 dark:text-ink-200 hover:border-seal-400/60'
                  }`}
              >
                <span className="block text-lg font-semibold">{h}</span>
                <span className="smallcaps text-[8px]">小 时</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default StepPreferences;
