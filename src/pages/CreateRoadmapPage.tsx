import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, Loader2, X } from 'lucide-react';
import { useRoadmapStore } from '../stores/useRoadmapStore';
import {
  useCreateRoadmapWizardStore,
  canProceedFromStep,
  toRoadmapRequest,
} from '../stores/useCreateRoadmapWizardStore';
import {
  WizardProgress,
  StepTopicLevel,
  StepGoalPreference,
} from '../components/wizard';
import { ErrorState } from '../components/states';

export default function CreateRoadmapPage() {
  const navigate = useNavigate();
  const { generateRoadmap, isGenerating, error, progress, reset: resetRoadmap } =
    useRoadmapStore();
  const wizard = useCreateRoadmapWizardStore();
  const {
    currentStep,
    topic,
    level,
    goal,
    goalDetail,
    weeklyHours,
    difficulty,
    includeProject,
    nextStep,
    prevStep,
    gotoStep,
    reset,
  } = wizard;

  // 离开确认
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (topic.trim()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [topic]);

  const canGo = canProceedFromStep(currentStep, {
    topic,
    level,
    goal,
    goalDetail,
    weeklyHours,
    difficulty,
    includeProject,
  });

  const handleSubmit = async () => {
    if (!canProceedFromStep(4, { topic, level, goal, goalDetail, weeklyHours, difficulty, includeProject })) {
      return;
    }
    try {
      const req = toRoadmapRequest({ topic, level, goal, goalDetail, weeklyHours, difficulty, includeProject });
      const id = await generateRoadmap(req);
      reset();
      navigate(`/roadmap/${id}`);
    } catch {
      /* store handles error */
    }
  };

  const isOutlinePhase =
    !progress ||
    progress.type === 'started' ||
    progress.type === 'outline_complete';

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-6 md:p-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6"
        >
          <ArrowLeft size={20} />
          <span>返回首页</span>
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">创建学习路线</h1>
          <p className="text-gray-500 dark:text-gray-400">4 步引导,让 AI 更懂你</p>
        </div>

        <WizardProgress currentStep={currentStep} onStepClick={gotoStep} />

        {error && (
          <div className="mb-6">
            <ErrorState
              variant="card"
              level="api"
              error={error}
              onRetry={() => {
                resetRoadmap();
                handleSubmit();
              }}
            />
          </div>
        )}

        <div className="p-6 md:p-8 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          {currentStep <= 2 ? (
            <StepTopicLevel step={currentStep as 1 | 2} />
          ) : (
            <StepGoalPreference step={currentStep as 3 | 4} />
          )}
        </div>

        {/* 操作栏 */}
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft size={18} />
            上一步
          </button>

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={!canGo}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium transition-colors"
            >
              继续
              <ArrowRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canGo || isGenerating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 disabled:opacity-50 text-white font-medium transition-colors"
            >
              <Sparkles size={18} />
              生成学习路线
            </button>
          )}
        </div>
      </div>

      {/* 进度弹窗 - 保留 v1.0 视觉 */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-white/20 dark:border-gray-700/50 relative">
            <button
              onClick={() => navigate('/')}
              className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={18} />
            </button>

            <div className="flex items-center justify-center gap-1 mb-8">
              {[
                { id: 1, label: '大纲', icon: '🧠' },
                { id: 2, label: '骨架', icon: '📋' },
                { id: 3, label: '内容', icon: '📝' },
                { id: 4, label: '完成', icon: '✅' },
              ].map((step) => {
                const isActive =
                  (step.id === 1 && (!progress || progress.type === 'started' || progress.type === 'outline_complete')) ||
                  (step.id === 2 && (progress?.type === 'stage_started' || progress?.type === 'stage_completed')) ||
                  (step.id === 3 && (progress?.type === 'stage_completed' && progress.current > 0)) ||
                  (step.id === 4 && progress?.type === 'completed');
                const isDone =
                  step.id <
                  (progress?.type === 'completed'
                    ? 5
                    : progress?.type === 'stage_completed'
                      ? 3
                      : progress?.type === 'outline_complete'
                        ? 2
                        : 1);
                return (
                  <div key={step.id} className="flex items-center gap-1">
                    <div
                      className={`flex flex-col items-center gap-1 transition-all duration-700 ${
                        isActive ? 'scale-110' : isDone ? 'opacity-50 scale-95' : 'opacity-25 scale-90'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm transition-all duration-500 ${
                          isActive
                            ? 'bg-primary-500 text-white shadow-primary-500/30 ring-4 ring-primary-100 dark:ring-primary-900/50'
                            : isDone
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : 'bg-gray-100 dark:bg-gray-700'
                        }`}
                      >
                        {isDone ? '✓' : step.icon}
                      </div>
                      <span
                        className={`text-[10px] font-medium transition-colors duration-500 ${
                          isActive
                            ? 'text-primary-600 dark:text-primary-400'
                            : isDone
                              ? 'text-green-500'
                              : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {step.id < 4 && (
                      <div
                        className={`w-6 h-0.5 rounded-full mb-4 transition-all duration-700 ${
                          isDone
                            ? 'bg-green-400'
                            : isActive && step.id < 4
                              ? 'bg-primary-300 animate-pulse'
                              : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-medium mb-3">
                <Loader2 size={12} className="animate-spin" />
                {!progress || progress.type === 'started'
                  ? 'Layer 1: 大纲生成'
                  : progress.type === 'outline_complete'
                    ? 'Layer 2: 阶段架构'
                    : progress.type === 'stage_started' || progress.type === 'stage_completed'
                      ? 'Layer 3: 任务内容'
                      : progress.type === 'completed'
                        ? '写入数据库'
                        : '处理中'}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {!progress || progress.type === 'started'
                  ? 'AI 正在规划学习路径'
                  : progress.type === 'outline_complete'
                    ? '大纲生成完毕,正在细化'
                    : '正在并行生成任务内容'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {!progress || progress.type === 'started'
                  ? '分析主题、评估难度、设计阶段划分…'
                  : progress.type === 'outline_complete'
                    ? `已规划 ${progress.total} 个阶段,正在为每个阶段生成任务列表…`
                    : progress.stage_title
                      ? `当前阶段:${progress.stage_title}`
                      : 'AI 正在为每个任务编写详细内容、推荐资源和生成记忆卡片…'}
              </p>
            </div>

            {!isOutlinePhase && progress && progress.total > 0 && (
              <div className="space-y-3">
                <div className="relative">
                  <div className="w-full bg-gray-100 dark:bg-gray-700/50 rounded-full h-4 overflow-hidden shadow-inner">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden bg-gradient-to-r from-blue-400 via-primary-500 to-purple-500"
                      style={{ width: `${Math.max(progressPercent, 4)}%` }}
                    />
                  </div>
                  <div
                    className="absolute -top-3 right-0 bg-primary-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg"
                    style={{ transform: `translateX(-${100 - progressPercent}%)` }}
                  >
                    {progressPercent}%
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>
                    {progress.current}/{progress.total} 阶段
                  </span>
                </div>
              </div>
            )}

            {isOutlinePhase && (
              <div className="flex justify-center gap-2 mt-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s`, animationDuration: '1s' }}
                  />
                ))}
              </div>
            )}

            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/')}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                取消生成 · 返回首页后可稍后查看已生成部分
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
