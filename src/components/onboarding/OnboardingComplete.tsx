import { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useOnboardingStore } from '../../stores/useOnboardingStore';

const OnboardingComplete: FC = () => {
  const navigate = useNavigate();
  const { createdRoadmapId, markCompleted } = useOnboardingStore();
  const [countdown, setCountdown] = useState(5);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    markCompleted();
    return () => {
      // 离开完成页不清空已生成路线 id
    };
  }, [markCompleted]);

  useEffect(() => {
    if (cancelled) return;
    if (countdown <= 0) {
      handleGo();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, cancelled]);

  const handleGo = () => {
    if (createdRoadmapId) {
      navigate(`/roadmap/${createdRoadmapId}`);
    } else {
      navigate('/');
    }
    // 不 reset,保留 completed 状态
  };

  return (
    <div className="text-center max-w-xl mx-auto relative">
      {/* 撒花 emoji */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {['🎉', '✨', '🌟', '🎊', '⭐', '💫'].map((emoji, i) => (
          <div
            key={i}
            className="absolute text-2xl animate-bounce"
            style={{
              left: `${10 + (i * 15) % 80}%`,
              top: `${(i * 23) % 60}%`,
              animationDelay: `${i * 0.2}s`,
              animationDuration: '1.5s',
            }}
          >
            {emoji}
          </div>
        ))}
      </div>

      <div className="relative z-10">
        <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-500/30">
          <Sparkles size={48} className="text-white" />
        </div>
        <h2 className="text-4xl font-bold text-white mb-3">准备就绪!</h2>
        <p className="text-lg text-white/80 mb-2">你的第一条学习路线已生成</p>
        {createdRoadmapId && (
          <p className="text-sm text-white/60 mb-8">已自动跳转到路线详情</p>
        )}

        <div className="space-y-3">
          <button
            onClick={handleGo}
            className="w-full flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white text-primary-700 font-semibold hover:scale-105 transition-transform shadow-xl"
          >
            开始第 1 关
            <ArrowRight size={18} />
          </button>
          {!cancelled ? (
            <button
              onClick={() => setCancelled(true)}
              className="text-sm text-white/60 hover:text-white"
            >
              {countdown} 秒后自动跳转(点击取消)
            </button>
          ) : (
            <div className="text-sm text-white/40">已取消自动跳转</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingComplete;
