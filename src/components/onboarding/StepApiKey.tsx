import { useState, type FC } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, KeyRound, ScrollText, Search } from 'lucide-react';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import { useSettingsStore } from '../../stores/useSettingsStore';

const StepApiKey: FC = () => {
  const { apiKey, baseUrl, model, tavilyKey, setField } = useOnboardingStore();
  const { saveApiKey, saveApiConfig, testConnection } = useSettingsStore();
  const [showKey, setShowKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const canTest = apiKey.trim().length > 0 && baseUrl.trim().length > 0 && model.trim().length > 0;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // 先落库再测试:后端 test_connection 需要从 DB 读取 API Key
      await saveApiKey('openai', apiKey);
      await saveApiConfig('openai', baseUrl, model, 'openai');
      const ok = await testConnection('openai', {
        baseUrl, model, providerType: 'openai',
      });
      setTestResult(ok
        ? { success: true, message: '墨 浓 · 通' }
        : { success: false, message: '墨 枯 · 失 败' });
    } catch (e) {
      setTestResult({ success: false, message: `连 接 失 败: ${e}` });
    } finally {
      setTesting(false);
    }
  };

  const inputClass = `w-full px-4 py-3 bg-paper dark:bg-night-100
    border-b-2 border-ink-300 dark:border-ink-600
    focus:border-seal-400 outline-none font-mono text-sm
    text-ink-700 dark:text-ink-100 placeholder-ink-fade/50 transition-colors`;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <div className="smallcaps mb-3">第 一 章 · 配 钥</div>
        <h2 className="font-display text-[40px] font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-tight mb-2">
          钥 匙 入 匣
        </h2>
        <p className="font-display italic text-base text-ink-fade">
          自定义模型,兼容 OpenAI 协议即可。墨钥仅存于本机匣中,绝不上传。
        </p>
        <div className="rule-gilt mt-5 max-w-xs mx-auto" />
      </div>

      <div className="manuscript-card p-7 space-y-6">
        {/* ====== 自定义模型配置 ====== */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <KeyRound size={13} className="text-seal-500" />
            <span className="smallcaps text-[10px]">自 定 义 模 型</span>
          </div>

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
                className={inputClass}
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

          <div>
            <label className="smallcaps mb-2 block text-[10px]">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => { setField('baseUrl', e.target.value); setTestResult(null); }}
              placeholder="https://api.deepseek.com/v1"
              className={inputClass}
            />
            <p className="font-display italic text-[11px] text-ink-fade mt-1.5">
              兼容 OpenAI 协议的端点地址,如 DeepSeek / MiniMax / 中转站。
            </p>
          </div>

          <div>
            <label className="smallcaps mb-2 block text-[10px]">模 型</label>
            <input
              type="text"
              value={model}
              onChange={(e) => { setField('model', e.target.value); setTestResult(null); }}
              placeholder="deepseek-chat、gpt-4o 等"
              className={inputClass}
            />
          </div>

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
            {testResult && (
              <div className="flex items-center gap-1.5 font-display text-sm text-seal-500">
                {testResult.success ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* ====== 资源搜索(可选) ====== */}
        <div className="pt-5 border-t border-dashed border-ink-200/60 dark:border-ink-700/40 space-y-4">
          <div className="flex items-center gap-2">
            <Search size={13} className="text-seal-500" />
            <span className="smallcaps text-[10px]">资 源 搜 索 · 可 选</span>
          </div>

          <div>
            <label className="smallcaps mb-2 flex items-center gap-2 text-[10px]">
              <ScrollText size={11} />
              <span>Tavily API Key</span>
            </label>
            <div className="relative">
              <input
                type={showTavilyKey ? 'text' : 'password'}
                value={tavilyKey}
                onChange={(e) => setField('tavilyKey', e.target.value)}
                placeholder="tvly-…"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowTavilyKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-fade hover:text-seal-500 transition-colors"
              >
                {showTavilyKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="font-display italic text-[11px] text-ink-fade mt-1.5">
              于 <a href="https://tavily.com" target="_blank" rel="noopener noreferrer"
                className="text-seal-500 border-b border-seal-400/50 hover:border-seal-500">tavily.com</a> 免费注册。
              配置后生成路线时将自动寻访真实学习链接;留空亦可继续。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepApiKey;
