import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { useRoadmapStore } from '../stores/useRoadmapStore';
import { useIntakeStore } from '../stores/useIntakeStore';
import { IntakeFlow } from '../components/wizard';
import { ErrorState } from '../components/states';
import { roman } from '../components/manuscript/roman';
import type { RoadmapRequest } from '../types';

export default function CreateRoadmapPage() {
  const navigate = useNavigate();
  const { generateRoadmap, isGenerating, error, progress, reset: resetRoadmap } = useRoadmapStore();
  const intake = useIntakeStore();
  const lastRequestRef = useRef<RoadmapRequest | null>(null);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (intake.topic.trim() || useRoadmapStore.getState().isGenerating) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [intake.topic]);

  // 离开创建页时若生成仍在进行,主动取消,避免后台继续生成
  useEffect(() => {
    return () => {
      if (useRoadmapStore.getState().isGenerating) {
        void useRoadmapStore.getState().cancelGeneration();
      }
    };
  }, []);

  const handleGenerate = async (params: RoadmapRequest) => {
    lastRequestRef.current = params;
    try {
      const id = await generateRoadmap(params);
      intake.reset();
      navigate(`/roadmap/${id}`);
    } catch {
      // store 负责展示错误
    }
  };

  const handleRetry = () => {
    if (!lastRequestRef.current) return;
    resetRoadmap();
    void handleGenerate(lastRequestRef.current);
  };

  const isOutlinePhase = !progress || progress.type === 'started' || progress.type === 'outline_complete';
  const progressPercent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-12 py-10">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 font-display italic text-sm text-ink-fade hover:text-seal-500 mb-6 group transition-colors"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
          <span>返 回 首 页</span>
        </button>

        <header className="mb-8 animate-ink-spread">
          <div className="smallcaps mb-3">第 二 章 · 访 谈</div>
          <h1 className="font-display text-5xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-none">
            <span className="italic text-seal-500">创</span>建 学 习 路 线
          </h1>
          <p className="font-display italic text-base text-ink-fade dark:text-ink-soft mt-3">
            几 轮 对 话,让 AI 更 懂 你
          </p>
          <div className="rule-gilt mt-5 max-w-xs" />
        </header>

        {error && (
          <div className="my-6">
            <ErrorState
              variant="card"
              level="api"
              error={error}
              onRetry={handleRetry}
            />
          </div>
        )}

        <div className="mt-6">
          <IntakeFlow onConfirm={handleGenerate} generating={isGenerating} />
        </div>
      </div>

      {/* 进度弹窗 */}
      {isGenerating && (
        <div className="fixed inset-0 bg-ink-900/50 dark:bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="manuscript-card max-w-lg w-full p-8 relative">
            <button
              onClick={() => navigate('/')}
              className="absolute top-4 right-4 p-1.5 text-ink-fade hover:text-seal-500 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="smallcaps mb-3 text-center">— AI 落 墨 中 —</div>
            <h3 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100 text-center mb-6 tracking-tight">
              {roman(1)} — {roman(4)} 章 生 成
            </h3>

            <div className="flex items-center justify-center gap-2 mb-8">
              {[
                { id: 1, label: '大 纲', icon: '✦' },
                { id: 2, label: '骨 架', icon: '§' },
                { id: 3, label: '内 容', icon: '✎' },
                { id: 4, label: '完 成', icon: '✦' },
              ].map((step) => {
                const isActive =
                  (step.id === 1 && (!progress || progress.type === 'started' || progress.type === 'outline_complete')) ||
                  (step.id === 2 && (progress?.type === 'stage_started' || progress?.type === 'stage_completed')) ||
                  (step.id === 3 && (progress?.type === 'stage_completed' && (progress.current ?? 0) > 0)) ||
                  (step.id === 4 && (progress?.type === 'enriching' || progress?.type === 'enrich_done' || progress?.type === 'completed'));
                const isDone =
                  step.id < (progress?.type === 'completed' ? 5
                    : progress?.type === 'enriching' || progress?.type === 'enrich_done' ? 4
                    : progress?.type === 'stage_completed' ? 3
                    : progress?.type === 'outline_complete' ? 2 : 1);
                return (
                  <div key={step.id} className="flex items-center gap-2">
                    <div className={`flex flex-col items-center gap-1 transition-all duration-700
                      ${isActive ? 'scale-110' : isDone ? 'opacity-50 scale-95' : 'opacity-30 scale-90'}`}
                    >
                      <div className={`w-11 h-11 flex items-center justify-center font-display italic text-lg border-2
                        ${isActive
                          ? 'border-seal-400 bg-seal-50 dark:bg-seal-700/20 text-seal-500'
                          : isDone
                            ? 'border-gilt-500 bg-gilt-500/10 text-gilt-500'
                            : 'border-ink-300 dark:border-ink-600 text-ink-fade'
                        }`}>
                        {isDone ? '✓' : roman(step.id)}
                      </div>
                      <span className={`font-display text-[10px] tracking-wider
                        ${isActive ? 'text-seal-500' : isDone ? 'text-gilt-500' : 'text-ink-fade/60'}`}>
                        {step.label}
                      </span>
                    </div>
                    {step.id < 4 && (
                      <div className={`w-6 h-px mb-4 transition-all duration-700
                        ${isDone ? 'bg-gilt-500' : isActive && step.id < 4 ? 'bg-seal-400 animate-pulse' : 'bg-ink-200 dark:bg-ink-700'}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-l-2 border-seal-400 pl-4 py-2 bg-seal-50/40 dark:bg-seal-700/10 mb-4">
              <div className="smallcaps text-seal-500 mb-1.5 text-[9px]">
                {!progress || progress.type === 'started' ? '第 一 阶 段'
                  : progress.type === 'outline_complete' ? '第 二 阶 段'
                  : progress.type === 'stage_started' || progress.type === 'stage_completed' ? '第 三 阶 段'
                  : progress.type === 'enriching' || progress.type === 'enrich_done' ? '第 四 阶 段'
                  : progress.type === 'completed' ? '写 入 完 毕' : '处 理 中'}
              </div>
              <h4 className="font-display text-base font-semibold text-ink-700 dark:text-ink-100 mb-1">
                {!progress || progress.type === 'started'
                  ? 'AI 正 在 规 划 学 习 路 径'
                  : progress.type === 'outline_complete'
                    ? '大 纲 已 毕,正 在 细 化'
                    : progress.type === 'enriching' || progress.type === 'enrich_done'
                      ? '正 在 搜 索 真 实 学 习 资 源'
                    : '正 在 并 行 生 成 任 务 内 容'}
              </h4>
              <p className="font-display italic text-xs text-ink-fade leading-relaxed">
                {!progress || progress.type === 'started'
                  ? '分 析 主 题 · 评 估 难 度 · 设 计 阶 段 划 分'
                  : progress.type === 'outline_complete'
                    ? `已 规 划 ${progress.total} 个 阶 段,正 在 为 每 个 阶 段 生 成 任 务 列 表`
                    : progress.type === 'enriching' || progress.type === 'enrich_done'
                      ? progress.message
                    : progress.stage_title
                      ? `当 前 阶 段 · ${progress.stage_title}`
                      : 'AI 正 在 为 每 个 任 务 编 写 详 细 内 容 与 推 荐 资 源'}
              </p>
            </div>

            {!isOutlinePhase && progress && progress.total > 0 && (
              <div className="space-y-3">
                <div className="relative">
                  <div className="w-full h-1 bg-ink-200 dark:bg-ink-700 overflow-hidden">
                    <div className="h-full bg-seal-400 transition-all duration-1000 ease-out"
                      style={{ width: `${Math.max(progressPercent, 4)}%` }} />
                  </div>
                  <div className="absolute -top-3 right-0 bg-seal-500 text-ink-50 text-[10px] font-bold px-2 py-0.5 font-mono"
                    style={{ transform: `translateX(-${100 - progressPercent}%)` }}>
                    {progressPercent}%
                  </div>
                </div>
                <div className="flex justify-between font-mono text-[10px] text-ink-fade">
                  <span>{progress.current}/{progress.total} {progress.type === 'outline_complete' ? '阶 段' : '进 度'}</span>
                </div>
              </div>
            )}

            {isOutlinePhase && (
              <div className="flex justify-center gap-2 mt-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-seal-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s`, animationDuration: '1s' }} />
                ))}
              </div>
            )}

            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/')}
                className="font-display italic text-xs text-ink-fade hover:text-seal-500 transition-colors
                  border-b border-dotted border-ink-fade/40 hover:border-seal-500"
              >
                取 消 生 成 · 返 回 首 页
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
