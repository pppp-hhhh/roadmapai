import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useSidebarStore } from '../stores/useSidebarStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { CurrentRoadmapCard, TodayTodoList, MainNav, GlobalSection } from './sidebar';
import StudyTimer from './StudyTimer';

export default function Layout() {
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const setApiStatus = useSidebarStore((s) => s.setApiStatus);

  // 订阅 ai_provider 与持久化的"key 已设置"标记(后端命令或前端的本地 flag)
  // 这样:用户在任何页面改完 provider / 保存 API,sidebar 状态会立即刷新
  const aiProvider = useSettingsStore((s) => s.ai_provider);

  // 启动时 + aiProvider 变化时 重新检测 API Key
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { getApiKey } = useSettingsStore.getState();
      try {
        const key = await getApiKey(aiProvider);
        if (!cancelled) {
          setApiStatus(aiProvider, !!key && key.length > 0);
        }
      } catch {
        if (!cancelled) setApiStatus(aiProvider, false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aiProvider, setApiStatus]);

  // 跨 Tab 同步:监听 localStorage 的 settings 写入
  // SettingsPage 保存 API 后会触发 useSettingsStore.setAiProvider
  // 但若用户用其他方式设置,我们也兜底监听 storage 事件
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'roadmapai-settings') {
        // 触发 useSettingsStore 重读
        useSettingsStore.persist.rehydrate();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 快捷键 Ctrl/Cmd + B
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleCollapsed]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-[width] duration-200 ease-out ${
          isCollapsed ? 'w-16' : 'w-72'
        }`}
      >
        <CurrentRoadmapCard />
        <TodayTodoList />
        <MainNav />
        <GlobalSection />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      <StudyTimer />
    </div>
  );
}
