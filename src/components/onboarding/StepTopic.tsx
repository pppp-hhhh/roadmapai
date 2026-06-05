import { useEffect, useState, type FC } from 'react';
import { AlertCircle, Lightbulb } from 'lucide-react';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import { validateTopic } from '../../stores/useCreateRoadmapWizardStore';

const EXAMPLES = ['机器学习', 'Python 数据分析', 'Rust 系统编程', '摄影入门', 'Web 安全', '日语 N2'];
const COUNTER = ['AI', '编程', '学习', '技术'];

const StepTopic: FC = () => {
  const { topic, setField } = useOnboardingStore();
  const [v, setV] = useState(validateTopic(topic));

  useEffect(() => {
    setV(validateTopic(topic));
  }, [topic]);

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold text-white text-center mb-2">选择学习主题</h2>
      <p className="text-white/70 text-center mb-8">我们将为这个主题生成你的第一条学习路线</p>

      <input
        type="text"
        value={topic}
        onChange={(e) => setField('topic', e.target.value)}
        placeholder="例如:机器学习、Python 编程"
        className="w-full px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-white/40 outline-none focus:border-primary-400 mb-3"
        autoFocus
      />

      {v.error && (
        <p className="flex items-center gap-1.5 text-sm text-red-300 mb-3">
          <AlertCircle size={14} />
          {v.error}
        </p>
      )}
      {v.warning && !v.error && (
        <p className="flex items-center gap-1.5 text-sm text-amber-300 mb-3">
          <Lightbulb size={14} />
          {v.warning}
        </p>
      )}

      <div className="mt-4">
        <p className="text-xs text-white/60 mb-2">热门主题:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setField('topic', ex)}
              className="px-3 py-1.5 rounded-full text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20"
            >
              {ex}
            </button>
          ))}
        </div>
        <p className="text-xs text-white/40 mt-3">反例:</p>
        <div className="flex flex-wrap gap-2 mt-1">
          {COUNTER.map((ex) => (
            <span
              key={ex}
              className="px-3 py-1.5 rounded-full text-xs bg-white/5 text-white/40 line-through"
            >
              {ex}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StepTopic;
