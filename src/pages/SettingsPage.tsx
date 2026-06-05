import { useState, useEffect, useRef } from 'react';
import { Key, Settings as SettingsIcon, Check, X, Loader2, Save, ChevronDown, Sun, Moon, Search, Zap } from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useOnboardingStore } from '../stores/useOnboardingStore';

export default function SettingsPage() {
  const {
    theme,
    setTheme,
    saveApiKey,
    getApiKey,
    saveApiConfig,
    getApiConfig,
    testConnection,
    setAiProvider,
    error,
  } = useSettingsStore();

  const [config, setConfig] = useState<{
    apiKey: string;
    baseUrl: string;
    model: string;
    providerType: 'openai' | 'anthropic';
  }>({
    apiKey: '',
    baseUrl: '',
    model: '',
    providerType: 'openai',
  });
  const [showKey, setShowKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [tavilyKey, setTavilyKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const providerOptions = [
    { value: 'openai', label: 'OpenAI（GPT 系列）', icon: '' },
    { value: 'anthropic', label: 'Anthropic（Claude 系列）', icon: '🟣' },
  ];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProviderDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      // Load API key
      try {
        const key = await getApiKey(config.providerType);
        if (key) {
          setConfig(prev => ({ ...prev, apiKey: key }));
        }
      } catch {
        // Key not found
      }

      // Load custom config
      try {
        const customConfig = await getApiConfig(config.providerType);
        if (customConfig) {
          setConfig(prev => ({
            ...prev,
            baseUrl: customConfig.baseUrl,
            model: customConfig.model,
            providerType: (customConfig.providerType || config.providerType) as 'openai' | 'anthropic',
          }));
        }
      } catch {
        // Config not found
      }

      // Load Tavily key
      try {
        const key = await getApiKey('tavily');
        if (key) setTavilyKey(key);
      } catch {
        // Key not found
      }
    };
    loadConfig();
  }, [getApiKey, getApiConfig]);

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);

    try {
      // Save API key and config under the selected provider
      await saveApiKey(config.providerType, config.apiKey);
      await saveApiConfig(config.providerType, config.baseUrl, config.model, config.providerType);
      setAiProvider(config.providerType);

      // 立即通知 sidebar 更新"待配置"徽标
      const { useSidebarStore } = await import('../stores/useSidebarStore');
      useSidebarStore.getState().setApiStatus(config.providerType, !!config.apiKey.trim());

      // Save Tavily key
      await saveApiKey('tavily', tavilyKey);

      setTestResult({ success: true, message: '设置已成功保存！' });
    } catch (e) {
      setTestResult({ success: false, message: `保存失败：${e}` });
    }

    setSaving(false);
  };

  const handleTest = async () => {
    if (!config.apiKey) {
      setTestResult({ success: false, message: '请先填写 API Key' });
      return;
    }

    setSaving(true);
    setTestResult(null);

    try {
      // Save for test
      await saveApiKey(config.providerType, config.apiKey);
      await saveApiConfig(config.providerType, config.baseUrl, config.model, config.providerType);

      const success = await testConnection(config.providerType, {
        baseUrl: config.baseUrl,
        model: config.model,
        providerType: config.providerType,
      });
      setTestResult({
        success,
        message: success ? '连接成功！' : '连接失败，请检查 API Key 和设置。'
      });
    } catch (e) {
      setTestResult({
        success: false,
        message: `连接失败：${e}`
      });
    }

    setSaving(false);
  };

  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">设置</h1>
            <p className="text-gray-500 dark:text-gray-400">
              配置你的 AI API 设置
            </p>
          </div>
          <button
            onClick={() => {
              if (confirm('确定重新运行新手引导?这将清空当前引导进度。')) {
                useOnboardingStore.getState().reset();
                window.location.assign('/onboarding');
              }
            }}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            重新运行新手引导
          </button>
        </div>

        <div className="space-y-8">
          {/* AI API Configuration */}
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                <Key size={20} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">AI 接口配置</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">填写你的 API 凭证</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Provider Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  提供方格式
                </label>
                <div ref={dropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white hover:border-primary-400 dark:hover:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  >
                    <span>{providerOptions.find(o => o.value === config.providerType)?.label}</span>
                    <ChevronDown
                      size={18}
                      className={`text-gray-400 transition-transform duration-200 ${showProviderDropdown ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {showProviderDropdown && (
                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                      {providerOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setConfig({ ...config, providerType: option.value as 'openai' | 'anthropic' });
                            setAiProvider(option.value);
                            setShowProviderDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            config.providerType === option.value
                              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                              : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {config.providerType === option.value && (
                            <Check size={16} className="text-primary-500 flex-shrink-0" />
                          )}
                          <span className={config.providerType === option.value ? '' : 'pl-5'}>
                            {option.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick presets */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  快速预设
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig({
                      ...config,
                      providerType: 'openai',
                      baseUrl: 'https://api.deepseek.com/v1',
                      model: 'deepseek-v4-flash',
                    })}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-700 dark:text-blue-300 text-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <Zap size={16} />DeepSeek V4 Flash
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({
                      ...config,
                      providerType: 'openai',
                      baseUrl: 'https://api.openai.com/v1',
                      model: 'gpt-4o',
                    })}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                  >
                    <Zap size={16} />GPT-4o
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({
                      ...config,
                      providerType: 'anthropic',
                      baseUrl: '',
                      model: 'claude-sonnet-4-20250514',
                    })}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl text-purple-700 dark:text-purple-300 text-sm hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                  >
                    <Zap size={16} />Claude
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">一键填入推荐配置 · 只需补充 API Key</p>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={config.apiKey}
                    onChange={e => setConfig({ ...config, apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showKey ? '隐藏' : '显示'}
                  </button>
                </div>
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Base URL
                </label>
                <input
                  type="text"
                  value={config.baseUrl}
                  onChange={e => setConfig({ ...config, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  API 端点的基础 URL（例如：https://api.openai.com/v1、https://api.anthropic.com/v1）
                </p>
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  模型
                </label>
                <input
                  type="text"
                  value={config.model}
                  onChange={e => setConfig({ ...config, model: e.target.value })}
                  placeholder="gpt-4o、gpt-4o-mini、claude-sonnet-4-20250514 等"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  用于对话和学习路线生成的模型名称
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleTest}
                  disabled={saving || !config.apiKey}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  <Loader2 size={18} className={saving ? 'animate-spin' : ''} />
                  测试连接
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  <Save size={18} />
                  保存设置
                </button>
              </div>

              {/* Result Message */}
              {testResult && (
                <div className={`flex items-center gap-3 p-4 rounded-xl ${
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                }`}>
                  {testResult.success ? <Check size={20} /> : <X size={20} />}
                  <span className="font-medium">{testResult.message}</span>
                </div>
              )}
            </div>
          </section>

          {/* Tavily Resource Search */}
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <Search size={20} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">资源搜索</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Tavily API — 自动搜索真实学习资源</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tavily API Key
              </label>
              <div className="relative">
                <input
                  type={showTavilyKey ? 'text' : 'password'}
                  value={tavilyKey}
                  onChange={e => setTavilyKey(e.target.value)}
                  placeholder="tvly-..."
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowTavilyKey(!showTavilyKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showTavilyKey ? '隐藏' : '显示'}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                在 <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:underline">tavily.com</a> 免费注册获取。配置后生成路线时将自动查找真实可访问的学习链接。
              </p>
            </div>
          </section>

          {/* General */}
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                <SettingsIcon size={20} className="text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">通用</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">应用偏好</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <Moon size={20} className="text-gray-500 dark:text-gray-400" />
                ) : (
                  <Sun size={20} className="text-gray-500 dark:text-gray-400" />
                )}
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">主题</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {theme === 'dark' ? '深色模式' : '浅色模式'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                  theme === 'dark' ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </section>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
