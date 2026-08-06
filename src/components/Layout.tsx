import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useSidebarStore } from '../stores/useSidebarStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { TodayTodoList, MainNav, GlobalSection } from './sidebar';
import AiCompanion from './AiCompanion';
import ManuscriptMark from './manuscript/ManuscriptMark';

export default function Layout() {
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const setApiStatus = useSidebarStore((s) => s.setApiStatus);
  const aiProvider = useSettingsStore((s) => s.ai_provider);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { getApiKey } = useSettingsStore.getState();
      try {
        const key = await getApiKey(aiProvider);
        if (!cancelled) setApiStatus(aiProvider, !!key && key.length > 0);
      } catch {
        if (!cancelled) setApiStatus(aiProvider, false);
      }
    })();
    return () => { cancelled = true; };
  }, [aiProvider, setApiStatus]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'roadmapai-settings') useSettingsStore.persist.rehydrate();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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
    <div className="flex h-full font-body text-ink-700 dark:text-ink-100">
      <aside
        className={`relative flex flex-col transition-[width] duration-300 ease-out
          ${isCollapsed ? 'w-[68px]' : 'w-[296px]'}
          bg-ink-50 dark:bg-night-100
          border-r border-ink-200 dark:border-ink-700/50`}
      >
        {/* 装订线 */}
        <div
          aria-hidden
          className="absolute top-0 left-0 bottom-0 w-[3px]
            bg-gradient-to-b from-transparent via-ink-300/60 to-transparent
            dark:via-ink-500/40"
        />
        <div
          aria-hidden
          className="absolute top-3 left-[7px] bottom-3 w-px
            border-l border-dashed border-ink-300/40 dark:border-ink-500/30"
        />

        {/* 品牌区 — 像书脊 */}
        <div className={`px-5 pt-4 pb-2 ${isCollapsed ? 'px-2' : ''}`}>
          <div className="flex items-center gap-2.5">
            <ManuscriptMark size={isCollapsed ? 32 : 36} />
            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-ink-spread">
                <div className="font-display text-[15px] font-semibold tracking-tight text-ink-700 dark:text-ink-100 leading-none">
                  RoadmapAI
                </div>
                <div className="smallcaps mt-1 text-[9px]">
                  Vol. I · 学习者的手稿
                </div>
              </div>
            )}
          </div>
          {!isCollapsed && <div className="rule-gilt mt-4" />}
        </div>

        <TodayTodoList />
        <MainNav />
        <GlobalSection />
      </aside>

      <main className="flex-1 overflow-hidden relative">
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 w-12 h-12 z-10
            bg-gradient-to-bl from-ink-200/40 to-transparent dark:from-ink-700/30"
          style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
        />
        <Outlet />
      </main>

      <AiCompanion />
    </div>
  );
}
