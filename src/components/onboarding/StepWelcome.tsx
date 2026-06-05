import { useEffect, type FC } from 'react';
import { Sparkles, BookOpen, Brain, ArrowRight } from 'lucide-react';
import { useOnboardingStore } from '../../stores/useOnboardingStore';

const FEATURES = [
  { icon: BookOpen, title: 'AI 生成学习路线', desc: '从主题到阶段,3 步内构建完整学习路径' },
  { icon: Brain, title: '间隔重复闪卡', desc: 'SM-2 算法自动安排复习时间,记得更牢' },
  { icon: Sparkles, title: '全程 AI 导师', desc: '回答可一键转闪卡/转任务,沉淀为个人资产' },
];

const StepWelcome: FC<{ onNext: () => void }> = ({ onNext }) => {
  const { detectRecommendedRegion, recommendProvider, setField } = useOnboardingStore();

  useEffect(() => {
    (async () => {
      const region = await detectRecommendedRegion();
      const provider = recommendProvider(region);
      setField('provider', provider);
    })();
  }, [detectRecommendedRegion, recommendProvider, setField]);

  return (
    <div className="text-center max-w-2xl mx-auto">
      <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary-500/30">
        <Sparkles size={40} className="text-white" />
      </div>
      <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">欢迎使用 RoadmapAI</h1>
      <p className="text-lg text-white/80 mb-10">让 AI 为你设计专属学习路径,从"今天该学什么"开始</p>

      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <f.icon size={20} className="text-white" />
            </div>
            <div className="font-semibold text-white mb-1">{f.title}</div>
            <div className="text-xs text-white/70">{f.desc}</div>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-white text-primary-700 font-semibold hover:scale-105 transition-transform shadow-xl"
      >
        开始设置
        <ArrowRight size={18} />
      </button>
      <p className="text-xs text-white/50 mt-4">整个过程约需 2 分钟</p>
    </div>
  );
};

export default StepWelcome;
