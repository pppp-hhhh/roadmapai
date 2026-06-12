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
      <div className="px-2 py-3 mt-auto border-t border-ink-200/60 dark:border-ink-700/40 flex flex-col items-center gap-1">
        <button onClick={toggleCollapsed}
          className="p-2 text-ink-fade hover:text-seal-400 hover:bg-ink-100/50 dark:hover:bg-night-300/50 transition-colors"
          title="展开侧边栏">
          <PanelLeftOpen size={16} />
        </button>
        <button onClick={() => navigate('/settings')}
          className={`p-2 transition-colors ${hasApiKey
            ? 'text-ink-fade hover:text-seal-400 hover:bg-ink-100/50 dark:hover:bg-night-300/50'
            : 'text-seal-500 bg-seal-50 dark:bg-seal-700/20 animate-flame'}`}
          title="设置">
          <Settings size={16} />
        </button>
        <button onClick={toggleTheme}
          className="p-2 text-ink-fade hover:text-seal-400 hover:bg-ink-100/50 dark:hover:bg-night-300/50 transition-colors"
          title="切换主题">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-3 mt-auto border-t border-ink-200/60 dark:border-ink-700/40 space-y-0.5">
      <div className="rule-gilt mb-3" />

      <button
        onClick={() => navigate('/settings')}
        className={`w-full flex items-center gap-3 px-2 py-2 transition-colors
          ${hasApiKey
            ? 'text-ink-500 dark:text-ink-200 hover:text-seal-500 hover:bg-ink-100/50 dark:hover:bg-night-300/50'
            : 'text-seal-500 dark:text-seal-300 bg-seal-50/60 dark:bg-seal-700/15 hover:bg-seal-50 dark:hover:bg-seal-700/25'
          }`}
        title={hasApiKey ? '设置' : '待配置 API Key'}
      >
        {hasApiKey ? <Settings size={15} /> : <KeyRound size={15} />}
        <span className="font-display text-[13px] flex-1 text-left">设置</span>
        {!hasApiKey && (
          <span className="seal-stamp text-[9px] text-seal-500 border-seal-400">
            待 配
          </span>
        )}
      </button>

      <button
        onClick={toggleTheme}
        className="w-full flex items-center gap-3 px-2 py-2 text-ink-500 dark:text-ink-200
          hover:text-seal-500 hover:bg-ink-100/50 dark:hover:bg-night-300/50 transition-colors"
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        <span className="font-display text-[13px] flex-1 text-left">
          {theme === 'dark' ? '夜读模式' : '日读模式'}
        </span>
      </button>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-2 py-2 text-ink-500 dark:text-ink-200
            hover:text-seal-500 hover:bg-ink-100/50 dark:hover:bg-night-300/50 transition-colors"
        >
          <span className="w-6 h-6 border border-ink-300 dark:border-ink-600 flex items-center justify-center
            font-display text-[11px] font-semibold text-ink-600 dark:text-ink-100">
            翁
          </span>
          <span className="font-display text-[13px] flex-1 text-left">读者</span>
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-full left-0 right-0 mb-1 p-1 manuscript-card z-40">
              <button
                onClick={() => { setMenuOpen(false); alert('导出功能即将推出'); }}
                className="w-full flex items-center gap-2 px-3 py-2 font-display text-[13px] text-ink-600 dark:text-ink-200
                  hover:bg-ink-100/60 dark:hover:bg-night-300/60"
              >
                <Download size={13} />
                抄本导出
              </button>
              <button
                disabled
                className="w-full flex items-center gap-2 px-3 py-2 font-display text-[13px] text-ink-fade cursor-not-allowed"
              >
                <LogOut size={13} />
                罢 笔
                <span className="ml-auto smallcaps text-[8px]">待启</span>
              </button>
            </div>
          </>
        )}
      </div>

      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center gap-3 px-2 py-2 text-ink-fade
          hover:text-seal-500 hover:bg-ink-100/50 dark:hover:bg-night-300/50 transition-colors"
        title="折叠侧边栏 (Ctrl/Cmd+B)"
      >
        <PanelLeftClose size={15} />
        <span className="font-display text-[13px] flex-1 text-left">合 卷</span>
        <kbd className="font-mono text-[9px] px-1.5 py-0.5 border border-ink-300/60 dark:border-ink-600/60 text-ink-fade">
          ⌘B
        </kbd>
      </button>
    </div>
  );
}
