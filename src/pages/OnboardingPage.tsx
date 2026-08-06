import { useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useOnboardingStore } from '../stores/useOnboardingStore';
import { StepApiKey } from '../components/onboarding';
import ManuscriptMark from '../components/manuscript/ManuscriptMark';

const OnboardingPage: FC = () => {
  const navigate = useNavigate();
  const { apiKey, baseUrl, model, saveApiConfig, markCompleted } = useOnboardingStore();
  const [completing, setCompleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canFinish = apiKey.trim().length > 0 && baseUrl.trim().length > 0 && model.trim().length > 0;

  const handleFinish = async () => {
    if (completing || !canFinish) return;
    setCompleting(true);
    setSaveError(null);
    try {
      await saveApiConfig();
      markCompleted();
      navigate('/', { replace: true });
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setCompleting(false);
    }
  };

  const handleSkip = () => {
    markCompleted();
    navigate('/', { replace: true });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="flex-shrink-0 px-10 pt-6 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ManuscriptMark size={26} />
          <span className="font-display text-sm font-semibold text-ink-700 dark:text-ink-100">RoadmapAI</span>
        </div>
        <span className="smallcaps text-ink-fade">初 次 启 卷</span>
      </header>

      <div className="flex-1 overflow-y-auto px-10 pb-8 pt-6">
        <StepApiKey />
      </div>

      <footer className="flex-shrink-0 px-10 py-6 border-t border-ink-200 dark:border-ink-700/40 bg-ink-50/60 dark:bg-night-100/60">
        <div className="max-w-2xl mx-auto">
          {saveError && (
            <p className="font-display italic text-xs text-seal-500 mb-3 break-words">
              配 置 落 匣 失 败: {saveError}
            </p>
          )}
          <div className="flex items-center justify-between gap-4">
            <span className="smallcaps text-ink-fade">配 钥 · 入 卷</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleSkip}
                className="font-display italic text-sm text-ink-fade hover:text-seal-500 transition-colors
                  border-b border-dotted border-ink-fade/40 hover:border-seal-500"
              >
                暂 不 配 置
              </button>
              <button
                onClick={handleFinish}
                disabled={!canFinish || completing}
                className="group flex items-center gap-3 px-6 py-3
                  bg-ink-700 dark:bg-seal-500 hover:bg-seal-500 dark:hover:bg-seal-400
                  text-ink-50 transition-all font-display text-sm
                  disabled:opacity-30 disabled:cursor-not-allowed
                  border-2 border-ink-800 dark:border-seal-600"
              >
                {completing && <Loader2 size={15} className="animate-spin" />}
                <span>{completing ? '落 匣 中' : '完 成 · 入 卷'}</span>
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default OnboardingPage;
