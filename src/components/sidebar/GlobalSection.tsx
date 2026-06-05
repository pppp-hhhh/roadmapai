import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Moon, Sun, PanelLeftClose, PanelLeftOpen, LogOut, Download, KeyRound } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useSidebarStore } from '../../stores/useSidebarStore';

export default function GlobalSection() {
  const navigate = useNavigate();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const hasApiKey = useSidebarStore((s) => s.hasApiKey);

  const [menuOpen, setMenuOpen] = useState(false);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  if (isCollapsed) {
    return (
      <div className="px-2 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-col items-center gap-1">
        <button
          onClick={toggleCollapsed}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="展开侧边栏"
        >
          <PanelLeftOpen size={18} />
        </button>
        <button
          onClick={() => navigate('/settings')}
          className={`p-2 rounded-lg ${
            hasApiKey
              ? 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              : 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'
          }`}
          title="设置"
        >
          <Settings size={18} />
        </button>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="切换主题"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
      <button
        onClick={() => navigate('/settings')}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
          hasApiKey
            ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
            : 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
        }`}
        title={hasApiKey ? '设置' : '待配置 API Key'}
      >
        {hasApiKey ? <Settings size={18} /> : <KeyRound size={18} />}
        <span className="text-sm flex-1 text-left">设置</span>
        {!hasApiKey && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
            待配置
          </span>
        )}
      </button>

      <button
        onClick={toggleTheme}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        <span className="text-sm flex-1 text-left">
          {theme === 'dark' ? '浅色模式' : '深色模式'}
        </span>
      </button>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
            U
          </div>
          <span className="text-sm flex-1 text-left">用户</span>
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-full left-0 right-0 mb-1 p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-40">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  // 占位：导出
                  alert('导出功能即将推出');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Download size={14} />
                导出本地数据
              </button>
              <button
                disabled
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 dark:text-gray-600 cursor-not-allowed"
              >
                <LogOut size={14} />
                退出登录
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700">
                  即将
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
        title="折叠侧边栏 (Ctrl/Cmd+B)"
      >
        <PanelLeftClose size={18} />
        <span className="text-sm flex-1 text-left">折叠</span>
        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">
          ⌘B
        </kbd>
      </button>
    </div>
  );
}
