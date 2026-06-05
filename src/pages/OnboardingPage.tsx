import { useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useOnboardingStore } from '../stores/useOnboardingStore';
import { useRoadmapStore } from '../stores/useRoadmapStore';
import { toRoadmapRequest, validateTopic } from '../stores/useCreateRoadmapWizardStore';
import { ErrorState } from '../components/states';
import {
  OnboardingProgress,
  StepWelcome,
  StepProvider,
  StepApiKey,
  StepTopic,
  StepPreferences,
  OnboardingComplete,
} from '../components/onboarding';

const OnboardingPage: FC = () => {
  const navigate = useNavigate();
  const {
    currentStep,
    provider,
    apiKey,
    topic,
    level,
    goal,
    weeklyHours,
    nextStep,
    prevStep,
    markCompleted,
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
      // 保存 API 配置
      await useOnboardingStore.getState().saveApiConfig();
      // 生成路线
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
      // 错误展示
    } finally {
      setCompleting(false);
    }
  };

  const handleSkip = () => {
    setSkipConfirm(false);
    markCompleted();
    // 用 replace 避免 back 按钮回到引导
    navigate('/', { replace: true });
  };

  // 渲染各 step 的主体内容
  const renderStep = () => {
    if (currentStep === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary-600 via-purple-600 to-pink-600 p-8">
          <StepWelcome onNext={nextStep} />
          <button
            onClick={() => setSkipConfirm(true)}
            className="mt-8 text-sm text-white/50 hover:text-white"
          >
            跳过引导
          </button>
        </div>
      );
    }
    if ((currentStep as number) === 5) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-green-500 via-emerald-600 to-teal-600 p-8">
          <OnboardingComplete />
        </div>
      );
    }
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-primary-600 via-purple-600 to-pink-600">
        {/* 顶部 */}
        <div className="flex items-center justify-between px-8 py-5">
          <button
            onClick={prevStep}
            className="flex items-center gap-1 text-white/70 hover:text-white text-sm"
          >
            <ArrowLeft size={16} />
            上一步
          </button>
          <button
            onClick={() => setSkipConfirm(true)}
            className="text-sm text-white/70 hover:text-white"
          >
            跳过引导
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <OnboardingProgress currentStep={currentStep} />

          {error && (
            <div className="max-w-2xl mx-auto mb-6">
              <ErrorState
                variant="card"
                level="api"
                error={error}
                onRetry={() => {
                  resetRoadmap();
                  handleFinish();
                }}
              />
            </div>
          )}

          {currentStep === 1 && <StepProvider />}
          {currentStep === 2 && <StepApiKey />}
          {currentStep === 3 && <StepTopic />}
          {currentStep === 4 && <StepPreferences />}
        </div>

        {/* 底部操作 */}
        <div className="px-8 py-6 flex justify-end">
          {currentStep < 4 ? (
            <button
              onClick={nextStep}
              disabled={!canGoNext}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-primary-700 font-semibold disabled:opacity-50 hover:scale-105 transition-transform shadow-xl"
            >
              继续
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={!canGoNext || completing || isGenerating}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-primary-700 font-semibold disabled:opacity-50 hover:scale-105 transition-transform shadow-xl"
            >
              {completing || isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  生成中…
                </>
              ) : (
                <>
                  生成学习路线
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {renderStep()}

      {/* 跳过确认弹窗 - 在所有 step 上方共享,确保 step 0 也能用 */}
      {skipConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSkipConfirm(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">确定跳过引导?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              跳过意味着未配置 API Key,首页会显示"待配置"提示。你可以稍后从设置页继续配置。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSkipConfirm(false)}
                autoFocus
                className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                继续引导
              </button>
              <button
                onClick={handleSkip}
                className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700"
              >
                跳过引导
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OnboardingPage;
