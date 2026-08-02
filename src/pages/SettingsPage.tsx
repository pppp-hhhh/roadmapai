import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, Settings as SettingsIcon, Check, X, Loader2, Save, ChevronDown, Sun, Moon, Search, Zap, Eye, EyeOff, ScrollText, Compass } from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useOnboardingStore } from '../stores/useOnboardingStore';
import { roman } from '../components/manuscript/roman';

export default function SettingsPage() {
  const navigate = useNavigate();
  const {
    theme, setTheme, saveApiKey, getApiKey, saveApiConfig, getApiConfig, testConnection, setAiProvider, error,
  } = useSettingsStore();

  const [config, setConfig] = useState<{
    apiKey: string; baseUrl: string; model: string; providerType: 'openai' | 'anthropic';
  }>({ apiKey: '', baseUrl: '', model: '', providerType: 'openai' });
  const [showKey, setShowKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [tavilyKey, setTavilyKey] = useState('');
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const providerOptions = [
    { value: 'openai',    label: 'OpenAI（GPT 系列）' },
    { value: 'anthropic', label: 'Anthropic（Claude 系列）' },
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
      try {
        const key = await getApiKey(config.providerType);
        if (key) setConfig(prev => ({ ...prev, apiKey: key }));
      } catch { /* */ }
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
      } catch { /* */ }
      try {
        const key = await getApiKey('tavily');
        if (key) setTavilyKey(key);
      } catch { /* */ }
    };
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tavilySaving, setTavilySaving] = useState(false);
  const [tavilySavedAt, setTavilySavedAt] = useState<number | null>(null);

  const handleSaveTavily = async () => {
    if (tavilySaving) return;
    setTavilySaving(true);
    try {
      await saveApiKey('tavily', tavilyKey);
      setTavilySavedAt(Date.now());
    } catch (e) {
      setTestResult({ success: false, message: `保 存 失 败: ${e}` });
    } finally {
      setTavilySaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      await saveApiKey(config.providerType, config.apiKey);
      await saveApiConfig(config.providerType, config.baseUrl, config.model, config.providerType);
      setAiProvider(config.providerType);
      const { useSidebarStore } = await import('../stores/useSidebarStore');
      useSidebarStore.getState().setApiStatus(config.providerType, !!config.apiKey.trim());
      await saveApiKey('tavily', tavilyKey);
      setTestResult({ success: true, message: '已 落 卷' });
    } catch (e) {
      setTestResult({ success: false, message: `保 存 失 败: ${e}` });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!config.apiKey) { setTestResult({ success: false, message: '请 先 填 写 API Key' }); return; }
    setSaving(true);
    setTestResult(null);
    try {
      await saveApiKey(config.providerType, config.apiKey);
      await saveApiConfig(config.providerType, config.baseUrl, config.model, config.providerType);
      const success = await testConnection(config.providerType, {
        baseUrl: config.baseUrl, model: config.model, providerType: config.providerType,
      });
      setTestResult({ success, message: success ? '墨 浓 · 通' : '墨 枯 · 失 败' });
    } catch (e) {
      setTestResult({ success: false, message: `连 接 失 败: ${e}` });
    }
    setSaving(false);
  };

  // ===== 共享表单控件样式 =====
  const inputClass = `w-full px-4 py-3 bg-paper-fold dark:bg-night-300
    border-b-2 border-ink-300 dark:border-ink-600
    focus:border-seal-400 outline-none font-mono text-sm font-semibold
    text-ink-700 dark:text-ink-100 transition-colors`;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto px-12 py-10 relative">
        {/* ====== 顶部 — 卷首 ====== */}
        <header className="mb-10 flex items-start justify-between animate-ink-spread">
          <div>
            <div className="smallcaps mb-3">第 八 章 · 置 砚</div>
            <h1 className="font-display text-5xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-none">
              <span className="italic text-seal-500">设</span>置
            </h1>
            <p className="font-display italic text-base text-ink-fade dark:text-ink-soft mt-3">
              配 置 你 的 AI API 设 置
            </p>
            <div className="rule-gilt mt-5 max-w-xs" />
          </div>
          <button
            onClick={() => setShowRestartConfirm(true)}
            className="font-display italic text-xs text-ink-fade hover:text-seal-500
              border-b border-dotted border-ink-fade/40 hover:border-seal-500 transition-colors mt-2"
          >
            重 启 序 章 →
          </button>
        </header>

        <div className="space-y-6">
          {/* ========== AI 接口配置 ========== */}
          <section className="manuscript-card p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 border border-ink-300 dark:border-ink-600 bg-paper dark:bg-night-200 flex items-center justify-center text-seal-500">
                <Key size={18} />
              </div>
              <div>
                <div className="smallcaps">第 一 节 · 配 钥</div>
                <h2 className="font-display text-xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight mt-0.5">
                  AI 接 口 配 置
                </h2>
              </div>
            </div>

            <div className="space-y-5">
              {/* 提供方格式 */}
              <div>
                <label className="smallcaps mb-2 block text-[10px]">提 供 方 格 式</label>
                <div ref={dropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-paper-fold dark:bg-night-300
                      border border-ink-300 dark:border-ink-600
                      hover:border-seal-400 focus:border-seal-400 outline-none transition-colors
                      font-display text-sm text-ink-700 dark:text-ink-100"
                  >
                    <span>{providerOptions.find(o => o.value === config.providerType)?.label}</span>
                    <ChevronDown size={16}
                      className={`text-ink-fade transition-transform duration-200 ${showProviderDropdown ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {showProviderDropdown && (
                    <div className="absolute z-50 w-full mt-1 manuscript-card p-1 shadow-ink-2 animate-ink-spread">
                      {providerOptions.map((option, i) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setConfig({ ...config, providerType: option.value as 'openai' | 'anthropic' });
                            setAiProvider(option.value);
                            setShowProviderDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                            ${config.providerType === option.value
                              ? 'bg-seal-50/60 dark:bg-seal-700/15 text-seal-500'
                              : 'text-ink-700 dark:text-ink-200 hover:bg-ink-100/50 dark:hover:bg-night-300/50'
                            }`}
                        >
                          <span className="font-display italic text-xs text-ink-fade w-5 tabular-nums">{roman(i + 1)}</span>
                          {config.providerType === option.value && <Check size={14} className="text-seal-500 flex-shrink-0" />}
                          <span className={config.providerType === option.value ? '' : 'pl-5'}>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 快速预设 */}
              <div>
                <label className="smallcaps mb-2 block text-[10px]">快 速 预 设</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'DeepSeek V4 Flash', provider: 'openai',    baseUrl: 'https://api.deepseek.com/v1',  model: 'deepseek-v4-flash',           active: 'seal' as const },
                    { label: 'GPT-4o',            provider: 'openai',    baseUrl: 'https://api.openai.com/v1',     model: 'gpt-4o',                       active: 'gilt' as const },
                    { label: 'Claude',            provider: 'anthropic', baseUrl: '',                              model: 'claude-sonnet-4-20250514',    active: 'gilt' as const },
                  ].map((p, i) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setConfig({
                        ...config,
                        providerType: p.provider as 'openai' | 'anthropic',
                        baseUrl: p.baseUrl,
                        model: p.model,
                      })}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5
                        bg-ink-50/60 dark:bg-night-200/40 border border-ink-200 dark:border-ink-700/40
                        hover:border-seal-400 hover:text-seal-500 transition-colors
                        font-display text-xs text-ink-600 dark:text-ink-200"
                    >
                      <span className="font-display italic text-ink-fade/70 text-[10px]">{roman(i + 1)}</span>
                      <Zap size={12} className={p.active === 'seal' ? 'text-seal-500' : 'text-gilt-500'} />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
                <p className="font-display italic text-[11px] text-ink-fade mt-2">
                  一键填入推荐配置 · 只需补充 API Key
                </p>
              </div>

              {/* API Key */}
              <div>
                <label className="smallcaps mb-2 flex items-center gap-2 text-[10px]">
                  <Key size={11} />
                  <span>API Key</span>
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={config.apiKey}
                    onChange={e => setConfig({ ...config, apiKey: e.target.value })}
                    placeholder="sk-..."
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-fade hover:text-seal-500 transition-colors"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Base URL */}
              <div>
                <label className="smallcaps mb-2 block text-[10px]">Base URL</label>
                <input
                  type="text"
                  value={config.baseUrl}
                  onChange={e => setConfig({ ...config, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className={inputClass}
                />
                <p className="font-display italic text-[11px] text-ink-fade mt-1.5">
                  API 端点的基础 URL(例:<span className="text-ink-600 dark:text-ink-soft font-mono text-[11px]">https://api.openai.com/v1</span>)
                </p>
              </div>

              {/* Model */}
              <div>
                <label className="smallcaps mb-2 block text-[10px]">模 型</label>
                <input
                  type="text"
                  value={config.model}
                  onChange={e => setConfig({ ...config, model: e.target.value })}
                  placeholder="gpt-4o、claude-sonnet-4-20250514 等"
                  className={inputClass}
                />
                <p className="font-display italic text-[11px] text-ink-fade mt-1.5">
                  用于对话和学习路线生成的模型名称
                </p>
              </div>

              {/* 按钮组 */}
              <div className="flex gap-3 pt-3 border-t border-dashed border-ink-200/60 dark:border-ink-700/40">
                <button
                  onClick={handleTest}
                  disabled={saving || !config.apiKey}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3
                    border border-ink-300 dark:border-ink-600
                    hover:border-seal-400 hover:text-seal-500 transition-colors
                    font-display text-sm text-ink-600 dark:text-ink-200
                    disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Compass size={15} />}
                  <span>试 一 试 墨</span>
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3
                    bg-seal-500 hover:bg-seal-400 text-ink-50
                    transition-colors font-display text-sm border-2 border-seal-600
                    disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save size={15} />
                  <span>落 笔 保 存</span>
                </button>
              </div>

              {/* 结果 */}
              {testResult && (
                <div className={`flex items-center gap-3 px-4 py-3 border-l-2
                  ${testResult.success
                    ? 'border-seal-400 bg-seal-50/40 dark:bg-seal-700/10 text-seal-500'
                    : 'border-seal-400 bg-seal-50/40 dark:bg-seal-700/10 text-seal-500'
                  }`}
                >
                  {testResult.success ? <Check size={16} /> : <X size={16} />}
                  <span className="font-display text-sm">{testResult.message}</span>
                </div>
              )}
            </div>
          </section>

          {/* ========== 资源搜索 ========== */}
          <section className="manuscript-card p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 border border-ink-300 dark:border-ink-600 bg-paper dark:bg-night-200 flex items-center justify-center text-seal-500">
                <Search size={18} />
              </div>
              <div>
                <div className="smallcaps">第 二 节 · 觅 典</div>
                <h2 className="font-display text-xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight mt-0.5">
                  资 源 搜 索
                </h2>
                <p className="font-display italic text-[12px] text-ink-fade mt-0.5">
                  Tavily API — 自动寻访真实学习资源
                </p>
              </div>
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
                  onChange={e => setTavilyKey(e.target.value)}
                  placeholder="tvly-..."
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setShowTavilyKey(!showTavilyKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-fade hover:text-seal-500 transition-colors"
                >
                  {showTavilyKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="font-display italic text-[11px] text-ink-fade mt-1.5">
                于 <a href="https://tavily.com" target="_blank" rel="noopener noreferrer"
                  className="text-seal-500 border-b border-seal-400/50 hover:border-seal-500">tavily.com</a> 免费注册。
                配置后生成路线时将自动寻访真实可访问的学习链接。
              </p>
              <div className="mt-4 pt-3 border-t border-dashed border-ink-200/60 dark:border-ink-700/40 flex items-center justify-between">
                <span className="font-display italic text-[11px] text-ink-fade">
                  {tavilySavedAt
                    ? <span className="text-seal-500">✓ 已 落 匣 · {new Date(tavilySavedAt).toLocaleTimeString()}</span>
                    : '未 单 独 保 存'}
                </span>
                <button
                  type="button"
                  onClick={handleSaveTavily}
                  disabled={tavilySaving}
                  className="flex items-center gap-2 px-5 py-2
                    border border-ink-300 dark:border-ink-600
                    hover:border-seal-400 hover:text-seal-500
                    transition-colors font-display text-xs text-ink-600 dark:text-ink-200
                    disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {tavilySaving
                    ? <><Loader2 size={12} className="animate-spin" /><span>落 匣 中</span></>
                    : <><Save size={12} /><span>单 独 落 匣</span></>
                  }
                </button>
              </div>
            </div>
          </section>

          {/* ========== 通用 ========== */}
          <section className="manuscript-card p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 border border-ink-300 dark:border-ink-600 bg-paper dark:bg-night-200 flex items-center justify-center text-ink-500 dark:text-ink-200">
                <SettingsIcon size={18} />
              </div>
              <div>
                <div className="smallcaps">第 三 节 · 律 动</div>
                <h2 className="font-display text-xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight mt-0.5">
                  通 用
                </h2>
                <p className="font-display italic text-[12px] text-ink-fade mt-0.5">应用偏好</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === 'dark'
                  ? <Moon size={18} className="text-ink-fade" />
                  : <Sun size={18} className="text-gilt-500" />
                }
                <div>
                  <div className="font-display text-sm text-ink-700 dark:text-ink-100">主 题</div>
                  <p className="font-display italic text-[11px] text-ink-fade">
                    {theme === 'dark' ? '夜 读 模 式' : '日 读 模 式'}
                  </p>
                </div>
              </div>

              {/* 切换器 — 印章式双框 */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`relative w-14 h-7 border-2 transition-colors flex-shrink-0
                  ${theme === 'dark'
                    ? 'border-seal-400 bg-night-300/50'
                    : 'border-gilt-500 bg-gilt-500/10'}`}
                title="切换主题"
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 transition-all duration-300 flex items-center justify-center
                    ${theme === 'dark'
                      ? 'left-0.5 bg-seal-500 text-ink-50'
                      : 'left-7 bg-gilt-500 text-ink-50'}`}
                >
                  {theme === 'dark' ? <Moon size={11} /> : <Sun size={11} />}
                </span>
              </button>
            </div>
          </section>

          {error && (
            <div className="border-l-2 border-seal-400 pl-4 py-3 bg-seal-50/40 dark:bg-seal-700/10 text-seal-500 font-display text-sm">
              {error}
            </div>
          )}
        </div>

        {/* 末页装饰 */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-3 smallcaps text-ink-fade">
            <span className="w-8 h-px bg-gilt-500/60" />
            <span>Fin · 本卷止于此</span>
            <span className="w-8 h-px bg-gilt-500/60" />
          </div>
        </div>
      </div>

      {showRestartConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setShowRestartConfirm(false)}
        >
          <div
            className="manuscript-card max-w-sm w-full p-7 animate-ink-spread"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="smallcaps mb-3 text-seal-500">— 提 示 —</div>
            <h3 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100 mb-2 tracking-tight">
              重 启 序 章?
            </h3>
            <p className="font-display italic text-sm text-ink-fade leading-relaxed mb-6">
              将重新运行新手引导,并清空当前引导进度。
              <br />已有路线与笔记不受影响。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRestartConfirm(false)}
                autoFocus
                className="px-4 py-2 font-display text-sm text-ink-fade hover:text-seal-500 transition-colors"
              >
                续 写
              </button>
              <button
                onClick={() => {
                  setShowRestartConfirm(false);
                  useOnboardingStore.getState().reset();
                  navigate('/onboarding');
                }}
                className="px-4 py-2 bg-seal-500 hover:bg-seal-400 text-ink-50 font-display text-sm transition-colors"
              >
                重 启
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
