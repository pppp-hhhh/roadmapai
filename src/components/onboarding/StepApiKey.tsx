import { useState, type FC } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, KeyRound } from 'lucide-react';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import { useSettingsStore } from '../../stores/useSettingsStore';

const StepApiKey: FC = () => {
  const { provider, apiKey, baseUrl, model, setField } = useOnboardingStore();
  const { testConnection } = useSettingsStore();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const providerType: 'openai' | 'anthropic' = provider === 'anthropic' ? 'anthropic' : 'openai';
  const canTest = apiKey.trim().length > 0 && baseUrl.trim().length > 0;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await testConnection(provider === 'anthropic' ? 'anthropic' : 'openai', {
        baseUrl, model, providerType,
      });
      setTestResult(ok ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <div className="smallcaps mb-3">第 二 章 · 配 钥</div>
        <h2 className="font-display text-[40px] font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-tight mb-2">
          钥 匙 入 匣
        </h2>
        <p className="font-display italic text-base text-ink-fade">
          墨钥仅存于本机匣中,绝不上传。
        </p>
        <div className="rule-gilt mt-5 max-w-xs mx-auto" />
      </div>

      <div className="manuscript-card p-7 space-y-5">
        <div>
          <label className="smallcaps mb-2 flex items-center gap-2 text-[10px]">
            <KeyRound size={11} />
            <span>API Key</span>
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => { setField('apiKey', e.target.value); setTestResult(null); }}
              placeholder="sk-…"
              className="w-full px-4 py-3 pr-11 bg-paper dark:bg-night-100
                border-b-2 border-ink-300 dark:border-ink-600
                focus:border-seal-400 outline-none font-mono text-sm
                text-ink-700 dark:text-ink-100 placeholder-ink-fade/50 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-fade hover:text-seal-500 transition-colors"
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {provider === 'custom' && (
          <>
            <div>
              <label className="smallcaps mb-2 block text-[10px]">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setField('baseUrl', e.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full px-4 py-3 bg-paper dark:bg-night-100
                  border-b-2 border-ink-300 dark:border-ink-600
                  focus:border-seal-400 outline-none font-mono text-sm
                  text-ink-700 dark:text-ink-100 placeholder-ink-fade/50"
              />
            </div>
            <div>
              <label className="smallcaps mb-2 block text-[10px]">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setField('model', e.target.value)}
                placeholder="gpt-4o"
                className="w-full px-4 py-3 bg-paper dark:bg-night-100
                  border-b-2 border-ink-300 dark:border-ink-600
                  focus:border-seal-400 outline-none font-mono text-sm
                  text-ink-700 dark:text-ink-100 placeholder-ink-fade/50"
              />
            </div>
          </>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-ink-200/60 dark:border-ink-700/40">
          <button
            type="button"
            onClick={handleTest}
            disabled={!canTest || testing}
            className="flex items-center gap-2 px-4 py-2 border border-ink-300 dark:border-ink-600
              hover:border-seal-400 hover:text-seal-500 transition-colors
              font-display text-sm text-ink-600 dark:text-ink-200
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing && <Loader2 size={13} className="animate-spin" />}
            <span>{testing ? '试 墨 中' : '试 一 试 墨'}</span>
          </button>
          {testResult === 'success' && (
            <div className="flex items-center gap-1.5 text-seal-500 font-display text-sm">
              <CheckCircle2 size={15} />
              <span>墨 浓 · 通</span>
            </div>
          )}
          {testResult === 'error' && (
            <div className="flex items-center gap-1.5 text-seal-500 font-display text-sm">
              <XCircle size={15} />
              <span>墨 枯 · 失</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StepApiKey;
