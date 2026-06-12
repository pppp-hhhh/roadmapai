import { useEffect, useState, type FC } from 'react';
import { AlertCircle, Lightbulb, ScrollText } from 'lucide-react';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import { validateTopic } from '../../stores/useCreateRoadmapWizardStore';

const EXAMPLES = ['机器学习', 'Python 数据分析', 'Rust 系统编程', '摄影入门', 'Web 安全', '日语 N2'];
const COUNTER = ['AI', '编程', '学习', '技术'];

const StepTopic: FC = () => {
  const { topic, setField } = useOnboardingStore();
  const [v, setV] = useState(validateTopic(topic));

  useEffect(() => { setV(validateTopic(topic)); }, [topic]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <div className="smallcaps mb-3">第 三 章 · 拟 题</div>
        <h2 className="font-display text-[40px] font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-tight mb-2">
          你 欲 研 何<span className="italic text-seal-500"> 术</span>
        </h2>
        <p className="font-display italic text-base text-ink-fade">
          一句题,便是开篇的序言。
        </p>
        <div className="rule-gilt mt-5 max-w-xs mx-auto" />
      </div>

      <div className="manuscript-card p-7">
        <label className="smallcaps mb-3 flex items-center gap-2 text-[10px]">
          <ScrollText size={11} />
          <span>学 习 主 题</span>
        </label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setField('topic', e.target.value)}
          placeholder="例:机器学习、Python 编程"
          className="w-full px-4 py-3 bg-paper dark:bg-night-100
            border-b-2 border-ink-300 dark:border-ink-600
            focus:border-seal-400 outline-none
            font-display text-lg text-ink-700 dark:text-ink-100
            placeholder-ink-fade/50 transition-colors"
          autoFocus
        />

        {v.error && (
          <p className="flex items-center gap-1.5 text-sm text-seal-500 mt-3 font-display italic">
            <AlertCircle size={13} />
            {v.error}
          </p>
        )}
        {v.warning && !v.error && (
          <p className="flex items-center gap-1.5 text-sm text-gilt-500 mt-3 font-display italic">
            <Lightbulb size={13} />
            {v.warning}
          </p>
        )}

        <div className="mt-6 pt-5 border-t border-dashed border-ink-200/60 dark:border-ink-700/40">
          <p className="smallcaps mb-3 text-[9px]">例 题 · INSPIRATION</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setField('topic', ex)}
                className="px-3 py-1.5 font-display italic text-xs
                  bg-ink-100/50 dark:bg-night-300/40 hover:bg-seal-50 dark:hover:bg-seal-700/15
                  text-ink-600 dark:text-ink-200 hover:text-seal-500
                  border border-ink-200 dark:border-ink-700/40 hover:border-seal-400/60
                  transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
          <p className="smallcaps mb-2 mt-5 text-[9px]">— 须 避 —</p>
          <div className="flex flex-wrap gap-2">
            {COUNTER.map((ex) => (
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
      </div>
    </div>
  );
};

export default StepTopic;
