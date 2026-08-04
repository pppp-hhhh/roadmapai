import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TodayTodo {
  tasks: number;
  updates: number;
}

interface SidebarState {
  isCollapsed: boolean;
  currentRoadmapId: string | null;
  todayTodo: TodayTodo;
  isLoadingTodo: boolean;
  provider: string | null;
  hasApiKey: boolean;

  toggleCollapsed: () => void;
  setCollapsed: (v: boolean) => void;
  setCurrentRoadmap: (id: string | null) => void;
  setTodayTodo: (t: Partial<TodayTodo>) => void;
  refreshTodayTodo: () => Promise<void>;
  setApiStatus: (provider: string | null, hasKey: boolean) => void;
}

const initialTodo: TodayTodo = { tasks: 0, updates: 0 };

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      isCollapsed: false,
      currentRoadmapId: null,
      todayTodo: { ...initialTodo },
      isLoadingTodo: false,
      provider: null,
      hasApiKey: false,

      toggleCollapsed: () => set({ isCollapsed: !get().isCollapsed }),
      setCollapsed: (v) => set({ isCollapsed: v }),
      setCurrentRoadmap: (id) => set({ currentRoadmapId: id }),
      setTodayTodo: (t) => set({ todayTodo: { ...get().todayTodo, ...t } }),

      refreshTodayTodo: async () => {
        set({ isLoadingTodo: true });
        try {
          // 闪卡已移除;今日任务/路线更新待后端提供专门接口后接入
        } catch {
          // ignore
        } finally {
          set({ isLoadingTodo: false });
        }
      },

      setApiStatus: (provider, hasKey) => set({ provider, hasApiKey: hasKey }),
    }),
    {
      name: 'roadmapai-sidebar',
      partialize: (s) => ({
        isCollapsed: s.isCollapsed,
        currentRoadmapId: s.currentRoadmapId,
      }),
    }
  )
);
