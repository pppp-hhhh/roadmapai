import { useEffect, useState, type FC } from 'react';
import { AlertCircle, Lightbulb } from 'lucide-react';
import { useCreateRoadmapWizardStore, validateTopic, type Level } from '../../stores/useCreateRoadmapWizardStore';
import WizardShell from './WizardShell';

const LEVEL_OPTIONS: { value: Level; label: string; desc: string }[] = [
  { value: '入门', label: '入 门', desc: '看 过 几 篇 博 客,基 础 概 念 模 糊' },
  { value: '进阶', label: '进 阶', desc: '能 写 简 单 代 码 / 练 习,想 系 统 化' },
  { value: '高级', label: '高 级', desc: '已 有 实 操 经 验,想 深 入 原 理' },
];

const TOPIC_EXAMPLES = ['机器学习', 'Python 数据分析', 'Rust 系统编程', '摄影入门', 'Web 安全'];
const TOPIC_COUNTER = ['AI', '编程', '学习', '技术'];

const inputClass = `w-full px-4 py-3 bg-paper-fold dark:bg-night-300
  border-b-2 border-ink-300 dark:border-ink-600
  focus:border-seal-400 outline-none
  font-display text-base text-ink-700 dark:text-ink-100
  placeholder:text-ink-600 placeholder:dark:text-ink-soft
  placeholder:font-display placeholder:italic`;

const StepTopicLevel: FC<{ step: 1 | 2 }> = ({ step }) => {
  const { topic, level, setField } = useCreateRoadmapWizardStore();
  const [validation, setValidation] = useState(validateTopic(topic));

  useEffect(() => { setValidation(validateTopic(topic)); }, [topic]);

  if (step === 1) {
    return (
      <WizardShell
        title="你 欲 学 何 术 ?"
        subtitle="越 具 体,生 成 的 路 线 越 贴 合 你"
        aiHint="我 会 分 析 这 个 主 题,设 计 3-6 个 学 习 阶 段,覆 盖 核 心 概 念 到 实 践。"
      >
        <div>
          <label className="smallcaps mb-2 block text-[10px]">学 习 主 题</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setField('topic', e.target.value)}
            placeholder="例:机 器 学 习、Python 编 程、Web 开 发"
            className={inputClass}
            autoFocus
          />
          {validation.error && (
            <p className="mt-3 flex items-center gap-1.5 font-display italic text-sm text-seal-500">
              <AlertCircle size={13} />
              {validation.error}
            </p>
          )}
          {validation.warning && !validation.error && (
            <p className="mt-3 flex items-center gap-1.5 font-display italic text-sm text-gilt-500">
              <Lightbulb size={13} />
              {validation.warning}
            </p>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-dashed border-ink-200/60 dark:border-ink-700/40">
          <p className="smallcaps mb-3 text-[9px]">例 题 · INSPIRATION</p>
          <div className="flex flex-wrap gap-2">
            {TOPIC_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setField('topic', ex)}
                className="px-3 py-1.5 font-display italic text-xs
                  bg-ink-100/50 dark:bg-night-300/40
                  border border-ink-200 dark:border-ink-700/40
                  hover:bg-seal-50 dark:hover:bg-seal-700/15
                  hover:border-seal-400 hover:text-seal-500
                  text-ink-600 dark:text-ink-200 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
          <p className="smallcaps mb-2 mt-5 text-[9px]">— 须 避 —</p>
          <div className="flex flex-wrap gap-2">
            {TOPIC_COUNTER.map((ex) => (
              <span
                key={ex}
                className="px-3 py-1.5 font-display italic text-xs
                  bg-transparent text-ink-fade/60 line-through
                  border border-dashed border-ink-200/60 dark:border-ink-700/30"
              >
                {ex}
              </span>
            ))}
          </div>
        </div>
      </WizardShell>
    );
  }

  // step === 2
  return (
    <WizardShell
      title="你 当 前 的 水 平 ?"
      subtitle="AI 会 根 据 你 的 起 点 调 整 内 容 的 深 度 和 跳 过 的 基 础"
      aiHint="入 门 从 基 础 概 念 讲 起,进 阶 直 接 进 入 实 操,高 级 会 拓 展 到 原 理 与 最 佳 实 践。"
    >
      <div className="space-y-2">
        {LEVEL_OPTIONS.map((opt, i) => {
          const selected = level === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setField('level', opt.value)}
              className={`w-full p-4 text-left transition-all flex items-center gap-3 border
                ${selected
                  ? 'bg-seal-50/60 dark:bg-seal-700/15 border-seal-400'
                  : 'bg-paper/50 dark:bg-night-200/40 border-ink-200 dark:border-ink-700/40 hover:border-seal-400/60'
                }`}
            >
              <span className="font-display italic text-xs text-ink-fade w-5 tabular-nums flex-shrink-0">
                {['I', 'II', 'III'][i]}
              </span>
              <span className={`w-5 h-5 flex items-center justify-center flex-shrink-0 border-2
                ${selected
                  ? 'border-seal-500 bg-seal-500'
                  : 'border-ink-300 dark:border-ink-600 bg-transparent'
                }`}>
                {selected && <span className="w-2 h-2 bg-paper" />}
              </span>
              <div className="flex-1">
                <div className={`font-display text-base font-semibold ${selected ? 'text-seal-600 dark:text-seal-200' : 'text-ink-700 dark:text-ink-100'}`}>
                  {opt.label}
                </div>
                <div className="font-display italic text-xs text-ink-fade dark:text-ink-soft mt-0.5 leading-relaxed">
                  {opt.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </WizardShell>
  );
};

export default StepTopicLevel;
