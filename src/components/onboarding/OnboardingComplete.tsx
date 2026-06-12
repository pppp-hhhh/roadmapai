import { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import ManuscriptMark from '../manuscript/ManuscriptMark';

const OnboardingComplete: FC = () => {
  const navigate = useNavigate();
  const { createdRoadmapId, markCompleted } = useOnboardingStore();
  const [countdown, setCountdown] = useState(5);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => { markCompleted(); }, [markCompleted]);

  useEffect(() => {
    if (cancelled) return;
    if (countdown <= 0) { handleGo(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, cancelled]);

  const handleGo = () => {
    if (createdRoadmapId) navigate(`/roadmap/${createdRoadmapId}`);
    else navigate('/');
  };

  return (
    <div className="text-center max-w-xl mx-auto relative">
      <div className="flex justify-center mb-6">
        <div className="animate-stamp">
          <ManuscriptMark size={96} />
        </div>
      </div>
      <div className="smallcaps mb-4 text-gilt-500">— 完 笔 —</div>
      <h2 className="font-display text-5xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-tight mb-3">
        纲 已 拟 就
      </h2>
      <p className="font-display italic text-lg text-ink-fade dark:text-ink-soft mb-2">
        你的第一条学习路线已落墨。
      </p>
      {createdRoadmapId && (
        <p className="font-display italic text-sm text-ink-fade mb-8">
          将自动翻至详情。
        </p>
      )}

      <div className="rule-gilt max-w-xs mx-auto my-8" />

      <div className="space-y-3">
        <button
          onClick={handleGo}
          className="group w-full inline-flex items-center justify-center gap-3 px-8 py-4
            bg-ink-700 dark:bg-seal-500 hover:bg-seal-500 dark:hover:bg-seal-400
            text-ink-50 transition-all font-display text-base"
        >
          <BookOpen size={17} />
          <span>启 卷 · 第 一 章</span>
          <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
        </button>
        {!cancelled ? (
          <button
            onClick={() => setCancelled(true)}
            className="font-display italic text-xs text-ink-fade hover:text-seal-500 transition-colors"
          >
            {countdown} 秒后自动翻页 (点击留步)
          </button>
        ) : (
          <div className="font-display italic text-xs text-ink-fade/60">已留步</div>
        )}
      </div>
    </div>
  );
};

export default OnboardingComplete;
