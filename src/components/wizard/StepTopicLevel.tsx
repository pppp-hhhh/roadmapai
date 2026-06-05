import { useEffect, useState, type FC } from 'react';
import { AlertCircle, Lightbulb } from 'lucide-react';
import { useCreateRoadmapWizardStore, validateTopic, type Level } from '../../stores/useCreateRoadmapWizardStore';
import WizardShell from './WizardShell';

const LEVEL_OPTIONS: { value: Level; label: string; desc: string }[] = [
  { value: '入门', label: '入门', desc: '看过几篇博客,基础概念模糊' },
  { value: '进阶', label: '进阶', desc: '能写简单代码/练习,想系统化' },
  { value: '高级', label: '高级', desc: '已有实操经验,想深入原理' },
];

const TOPIC_EXAMPLES = ['机器学习', 'Python 数据分析', 'Rust 系统编程', '摄影入门', 'Web 安全'];
const TOPIC_COUNTER = ['AI', '编程', '学习', '技术'];

const StepTopicLevel: FC<{ step: 1 | 2 }> = ({ step }) => {
  const {
    topic, level,
    setField,
  } = useCreateRoadmapWizardStore();
  const [validation, setValidation] = useState(validateTopic(topic));

  useEffect(() => {
    setValidation(validateTopic(topic));
  }, [topic]);

  if (step === 1) {
    return (
      <WizardShell
        title="你想学习什么?"
        subtitle="越具体,生成的路线越贴合你"
        aiHint="我会分析这个主题,设计 3-6 个学习阶段,覆盖核心概念到实践。"
      >
        <div>
          <input
            type="text"
            value={topic}
            onChange={(e) => setField('topic', e.target.value)}
            placeholder="例如:机器学习、Python 编程、Web 开发"
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
            autoFocus
          />
          {validation.error && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
              <AlertCircle size={14} />
              {validation.error}
            </p>
          )}
          {validation.warning && !validation.error && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
              <Lightbulb size={14} />
              {validation.warning}
            </p>
          )}
        </div>

        <div className="mt-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">好例子:</p>
          <div className="flex flex-wrap gap-2">
            {TOPIC_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setField('topic', ex)}
                className="px-3 py-1.5 rounded-full text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">反例(过于宽泛):</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {TOPIC_COUNTER.map((ex) => (
              <span
                key={ex}
                className="px-3 py-1.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 line-through"
              >
                {ex}
              </span>
            ))}
          </div>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell
      title="你当前的水平?"
      subtitle="AI 会根据你的起点调整内容的深度和跳过的基础"
      aiHint="入门会从基础概念讲起,进阶直接进入实操,高级会拓展到原理与最佳实践。"
    >
      <div className="space-y-3">
        {LEVEL_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setField('level', opt.value)}
            className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
              level === opt.value
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  level === opt.value ? 'border-primary-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {level === opt.value && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">{opt.label}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </WizardShell>
  );
};

export default StepTopicLevel;
