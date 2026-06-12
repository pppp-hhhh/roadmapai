import { useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useOnboardingStore } from '../stores/useOnboardingStore';
import { useRoadmapStore } from '../stores/useRoadmapStore';
import { toRoadmapRequest, validateTopic } from '../stores/useCreateRoadmapWizardStore';
import { ErrorState } from '../components/states';
import {
  OnboardingProgress,
  StepProvider,
  StepApiKey,
  StepTopic,
  StepPreferences,
  OnboardingComplete,
} from '../components/onboarding';
import ManuscriptMark from '../components/manuscript/ManuscriptMark';

const OnboardingPage: FC = () => {
  const navigate = useNavigate();
  const {
    currentStep, provider, apiKey, topic, level, goal, weeklyHours,
    nextStep, prevStep, markCompleted,
  } = useOnboardingStore();
  const { generateRoadmap, isGenerating, error, reset: resetRoadmap } = useRoadmapStore();
  const [skipConfirm, setSkipConfirm] = useState(false);
  const [completing, setCompleting] = useState(false);

  const canGoNext = (() => {
    if (currentStep === 1) return !!provider;
    if (currentStep === 2) return apiKey.trim().length > 0;
    if (currentStep === 3) {
      const r = validateTopic(topic);
      return r.valid && !r.error;
    }
    if (currentStep === 4) return topic.trim().length > 0 && level && goal.trim().length > 0;
    return true;
  })();

  const handleFinish = async () => {
    if (completing) return;
    setCompleting(true);
    try {
      await useOnboardingStore.getState().saveApiConfig();
      const req = toRoadmapRequest({
        topic,
        level: level as any,
        goal: 'custom',
        goalDetail: goal,
        weeklyHours,
        difficulty: '适中',
        includeProject: true,
      });
      const id = await generateRoadmap(req);
      useOnboardingStore.setState({ createdRoadmapId: id });
      nextStep();
    } catch (err) {
      /* swallow */
    } finally {
      setCompleting(false);
    }
  };

  const handleSkip = () => {
    setSkipConfirm(false);
    markCompleted();
    navigate('/', { replace: true });
  };

  // ============ 序章 ============
  if (currentStep === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center font-display italic text-[280px] text-ink-200/20 dark:text-ink-700/10 select-none pointer-events-none leading-none"
        >
          I
        </div>
        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <div className="flex justify-center mb-8">
            <ManuscriptMark size={88} />
          </div>
          <div className="smallcaps mb-4">序 · Prologue</div>
          <h1 className="font-display text-6xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-[1.05] mb-5">
            欢迎,未来的<span className="italic text-seal-500">学者</span>
          </h1>
          <p className="font-display italic text-lg text-ink-fade dark:text-ink-soft leading-relaxed mb-3 max-w-lg mx-auto">
            略备四章,即可开启你的研习之旅。
          </p>
          <p className="font-display italic text-base text-ink-fade/80 dark:text-ink-soft/80 leading-relaxed mb-10 max-w-md mx-auto">
            从一管墨、一方砚、一册经卷开始。
          </p>

          <button
            onClick={nextStep}
            className="group inline-flex items-center gap-3 px-8 py-4
              bg-ink-700 dark:bg-seal-500 hover:bg-seal-500 dark:hover:bg-seal-400
              text-ink-50 transition-all font-display text-base relative"
          >
            <span>翻 开 第 一 页</span>
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </button>

          <div className="mt-8">
            <button
              onClick={() => setSkipConfirm(true)}
              className="font-display italic text-sm text-ink-fade hover:text-seal-500 transition-colors
                border-b border-dotted border-ink-fade/40 hover:border-seal-500"
            >
              先 搁 笔 · 跳 过 序 章
            </button>
          </div>

          <div className="rule-gilt mt-12 max-w-xs mx-auto" />
        </div>

        {skipConfirm && <SkipConfirm onCancel={() => setSkipConfirm(false)} onConfirm={handleSkip} />}
      </div>
    );
  }

  // ============ 完成章 ============
  if ((currentStep as number) === 5) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center font-display italic text-[240px] text-gilt-500/15 select-none pointer-events-none leading-none"
        >
          ✦
        </div>
        <div className="relative z-10 text-center max-w-xl">
          <OnboardingComplete />
        </div>
      </div>
    );
  }

  // ============ 四章主流程 ============
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="flex-shrink-0 px-10 pt-6 pb-3 flex items-center justify-between">
        <button
          onClick={prevStep}
          className="flex items-center gap-2 font-display italic text-sm text-ink-fade hover:text-seal-500 transition-colors group"
        >
          <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-1" />
          <span>退 一 步</span>
        </button>
        <div className="flex items-center gap-2">
          <ManuscriptMark size={26} />
          <span className="font-display text-sm font-semibold text-ink-700 dark:text-ink-100">RoadmapAI</span>
        </div>
        <button
          onClick={() => setSkipConfirm(true)}
          className="font-display italic text-sm text-ink-fade hover:text-seal-500 transition-colors
            border-b border-dotted border-ink-fade/40 hover:border-seal-500"
        >
          搁 笔
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-10 pb-8">
        <OnboardingProgress currentStep={currentStep} />

        <div className="max-w-2xl mx-auto">
          {error && (
            <div className="mb-6">
              <ErrorState
                variant="card"
                level="api"
                error={error}
                onRetry={() => { resetRoadmap(); handleFinish(); }}
              />
            </div>
          )}

          {currentStep === 1 && <StepProvider />}
          {currentStep === 2 && <StepApiKey />}
          {currentStep === 3 && <StepTopic />}
          {currentStep === 4 && <StepPreferences />}
        </div>
      </div>

      <footer className="flex-shrink-0 px-10 py-6 border-t border-ink-200 dark:border-ink-700/40 bg-ink-50/60 dark:bg-night-100/60">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-display italic text-xs text-ink-fade">
            {currentStep < 4 ? '可随时退回' : '末章 · 落笔即生成'}
          </span>
          {currentStep < 4 ? (
            <button
              onClick={nextStep}
              disabled={!canGoNext}
              className="group flex items-center gap-3 px-6 py-3
                bg-ink-700 dark:bg-seal-500 hover:bg-seal-500 dark:hover:bg-seal-400
                text-ink-50 transition-all font-display text-sm
                disabled:opacity-30 disabled:cursor-not-allowed
                border-2 border-ink-800 dark:border-seal-600"
            >
              <span>续 写</span>
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={!canGoNext || completing || isGenerating}
              className="group flex items-center gap-3 px-7 py-3
                bg-seal-500 hover:bg-seal-400 text-ink-50
                transition-all font-display text-sm
                disabled:opacity-40 disabled:cursor-not-allowed
                border-2 border-seal-600"
            >
              {completing || isGenerating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>AI 落 墨 中…</span>
                </>
              ) : (
                <>
                  <span>落 笔 · 拟 写 纲 要</span>
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          )}
        </div>
      </footer>

      {skipConfirm && <SkipConfirm onCancel={() => setSkipConfirm(false)} onConfirm={handleSkip} />}
    </div>
  );
};

const SkipConfirm: FC<{ onCancel: () => void; onConfirm: () => void }> = ({ onCancel, onConfirm }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
    onClick={onCancel}
  >
    <div
      className="manuscript-card max-w-sm w-full p-7 animate-ink-spread"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="smallcaps mb-3 text-seal-500">— 提 示 —</div>
      <h3 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100 mb-2 tracking-tight">
        确 要 搁 笔?
      </h3>
      <p className="font-display italic text-sm text-ink-fade leading-relaxed mb-6">
        跳过即未配墨,首页将显"待配"朱批。
        <br />可于设置页续写。
      </p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          autoFocus
          className="px-4 py-2 font-display text-sm text-ink-fade hover:text-seal-500 transition-colors"
        >
          续 写
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-seal-500 hover:bg-seal-400 text-ink-50 font-display text-sm transition-colors"
        >
          执 意 跳 过
        </button>
      </div>
    </div>
  </div>
);

export default OnboardingPage;
