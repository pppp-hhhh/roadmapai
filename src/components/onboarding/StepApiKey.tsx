import { useState, type FC } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
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
        baseUrl,
        model,
        providerType,
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
      <h2 className="text-3xl font-bold text-white text-center mb-2">配置 API Key</h2>
      <p className="text-white/70 text-center mb-8">Key 仅保存在本地,不会上传任何服务器</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setField('apiKey', e.target.value);
                setTestResult(null);
              }}
              placeholder="sk-…"
              className="w-full px-4 py-3 pr-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-white/40 outline-none focus:border-primary-400"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {provider === 'custom' && (
          <>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setField('baseUrl', e.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-white/40 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setField('model', e.target.value)}
                placeholder="gpt-4o"
                className="w-full px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-white/40 outline-none"
              />
            </div>
          </>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={!canTest || testing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-sm font-medium border border-white/20"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : null}
            {testing ? '测试中…' : '测试连接'}
          </button>
          {testResult === 'success' && (
            <div className="flex items-center gap-1.5 text-green-300 text-sm">
              <CheckCircle2 size={16} />
              连接成功
            </div>
          )}
          {testResult === 'error' && (
            <div className="flex items-center gap-1.5 text-red-300 text-sm">
              <XCircle size={16} />
              连接失败,请检查 Key
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StepApiKey;
