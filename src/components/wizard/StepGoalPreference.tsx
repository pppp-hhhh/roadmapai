import type { FC } from 'react';
import { Clock, Zap, FolderGit2 } from 'lucide-react';
import {
  useCreateRoadmapWizardStore,
  GOAL_TEMPLATES,
  type Difficulty,
} from '../../stores/useCreateRoadmapWizardStore';
import WizardShell from './WizardShell';
import { roman } from '../manuscript/roman';

const HOUR_PRESETS = [2, 4, 6, 10, 15];

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; desc: string }[] = [
  { value: '简单', label: '简 单', desc: '概 念 讲 解 多,任 务 少' },
  { value: '适中', label: '适 中', desc: '平 衡 理 论 与 实 操' },
  { value: '困难', label: '困 难', desc: '高 强 度,大 量 练 习' },
];

const inputClass = `w-full px-4 py-3 bg-paper-fold dark:bg-night-300
  border-b-2 border-ink-300 dark:border-ink-600
  focus:border-seal-400 outline-none
  font-display text-sm text-ink-700 dark:text-ink-100
  placeholder:text-ink-600 placeholder:dark:text-ink-soft
  placeholder:font-display placeholder:italic`;

const StepGoalPreference: FC<{ step: 3 | 4 }> = ({ step }) => {
  const { goal, goalDetail, weeklyHours, difficulty, includeProject, setField } = useCreateRoadmapWizardStore();

  if (step === 3) {
    const t = GOAL_TEMPLATES.find((g) => g.key === goal);
    return (
      <WizardShell
        title="你 学 这 个 的 目 标 ?"
        subtitle="选 择 最 贴 近 你 的 目 标,我 会 调 整 每 个 阶 段 的 侧 重 点"
        aiHint="求 职 面 试 会 偏 重 刷 题 和 项 目;项 目 实 战 会 压 缩 理 论;个 人 兴 趣 会 保 留 探 索 空 间。"
      >
        <div className="space-y-2">
          {GOAL_TEMPLATES.map((g, i) => {
            const selected = goal === g.key;
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => setField('goal', g.key)}
                className={`w-full p-4 text-left transition-all flex items-center gap-3 border
                  ${selected
                    ? 'bg-seal-50/60 dark:bg-seal-700/15 border-seal-400'
                    : 'bg-paper/50 dark:bg-night-200/40 border-ink-200 dark:border-ink-700/40 hover:border-seal-400/60'
                  }`}
              >
                <span className="font-display italic text-xs text-ink-fade w-5 tabular-nums flex-shrink-0">{roman(i + 1)}</span>
                <span className={`w-5 h-5 flex items-center justify-center flex-shrink-0 border-2
                  ${selected ? 'border-seal-500 bg-seal-500' : 'border-ink-300 dark:border-ink-600 bg-transparent'}`}>
                  {selected && <span className="w-2 h-2 bg-paper" />}
                </span>
                <span className={`font-display text-sm font-semibold ${selected ? 'text-seal-600 dark:text-seal-200' : 'text-ink-700 dark:text-ink-100'}`}>
                  {g.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-dashed border-ink-200/60 dark:border-ink-700/40">
          <label className="smallcaps mb-2 block">
            补 充 说 明 {goal === 'custom' ? <span className="text-seal-500">*</span> : <span className="text-ink-fade/60">(可 选)</span>}
          </label>
          <input
            type="text"
            value={goalDetail}
            onChange={(e) => setField('goalDetail', e.target.value)}
            placeholder={t?.placeholder}
            className={inputClass}
          />
        </div>
      </WizardShell>
    );
  }

  // step === 4
  return (
    <WizardShell
      title="学 习 节 奏 与 偏 好"
      subtitle="帮 AI 估 算 每 个 阶 段 的 时 间 与 任 务 密 度"
      aiHint="每 周 4-6 小 时 是 大 多 数 学 习 者 的 舒 适 区;含 项 目 会 多 花 20% 时 间 但 更 扎 实。"
    >
      <div className="space-y-6">
        {/* 周时 */}
        <section>
          <label className="smallcaps mb-3 flex items-center gap-2 text-[10px]">
            <Clock size={11} className="text-seal-500" />
            <span>每 周 可 投 入 时 间</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {HOUR_PRESETS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setField('weeklyHours', h)}
                className={`px-4 py-2 font-display text-sm transition-colors
                  ${weeklyHours === h
                    ? 'bg-seal-500 text-ink-50 border-2 border-seal-600'
                    : 'bg-paper/60 dark:bg-night-200/40 text-ink-600 dark:text-ink-200 border border-ink-300 dark:border-ink-600 hover:border-seal-400 hover:text-seal-500'
                  }`}
              >
                {h} <span className="text-[10px]">小 时</span>
              </button>
            ))}
          </div>
          <input
            type="range"
            min={1}
            max={20}
            value={weeklyHours}
            onChange={(e) => setField('weeklyHours', Number(e.target.value))}
            className="w-full accent-seal-500"
          />
          <p className="font-mono text-[10px] text-ink-fade mt-1.5">
            当 前 选 择 · 每 周 <span className="text-seal-500">{weeklyHours}</span> 小 时
          </p>
        </section>

        {/* 难度 */}
        <section>
          <label className="smallcaps mb-3 flex items-center gap-2 text-[10px]">
            <Zap size={11} className="text-gilt-500" />
            <span>难 度 偏 好</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTY_OPTIONS.map((opt, i) => {
              const selected = difficulty === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setField('difficulty', opt.value)}
                  className={`p-3 text-left transition-all border
                    ${selected
                      ? 'bg-seal-50/60 dark:bg-seal-700/15 border-seal-400'
                      : 'bg-paper/50 dark:bg-night-200/40 border-ink-200 dark:border-ink-700/40 hover:border-seal-400/60'
                    }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-display italic text-[10px] text-ink-fade">{roman(i + 1)}</span>
                    <span className={`font-display text-sm font-semibold ${selected ? 'text-seal-600 dark:text-seal-200' : 'text-ink-700 dark:text-ink-100'}`}>
                      {opt.label}
                    </span>
                  </div>
                  <div className="font-display italic text-[11px] text-ink-fade dark:text-ink-soft leading-snug">
                    {opt.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 项目 */}
        <section>
          <label className="smallcaps mb-3 flex items-center gap-2 text-[10px]">
            <FolderGit2 size={11} className="text-seal-500" />
            <span>是 否 含 项 目 实 战</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: true,  label: '含 项 目', desc: '推 荐 · 更 扎 实', roman: 'I'   as const },
              { v: false, label: '纯 学 习', desc: '只 学 概 念 和 练 习', roman: 'II'  as const },
            ].map((opt) => {
              const selected = includeProject === opt.v;
              return (
                <button
                  key={String(opt.v)}
                  type="button"
                  onClick={() => setField('includeProject', opt.v)}
                  className={`p-3 text-left transition-all border
                    ${selected
                      ? 'bg-seal-50/60 dark:bg-seal-700/15 border-seal-400'
                      : 'bg-paper/50 dark:bg-night-200/40 border-ink-200 dark:border-ink-700/40 hover:border-seal-400/60'
                    }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-display italic text-[10px] text-ink-fade">{opt.roman}</span>
                    <span className={`font-display text-sm font-semibold ${selected ? 'text-seal-600 dark:text-seal-200' : 'text-ink-700 dark:text-ink-100'}`}>
                      {opt.label}
                    </span>
                  </div>
                  <div className="font-display italic text-[11px] text-ink-fade dark:text-ink-soft leading-snug">
                    {opt.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </WizardShell>
  );
};

export default StepGoalPreference;
