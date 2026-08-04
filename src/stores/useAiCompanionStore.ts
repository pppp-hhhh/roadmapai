import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CompanionContext {
  stageId?: string | null;
  taskId?: string | null;
}

interface AiCompanionState {
  isOpen: boolean;
  isExpanded: boolean;
  position: { x: number; y: number } | null;
  context: CompanionContext | null;

  openCompanion: (context?: CompanionContext | null) => void;
  closeCompanion: () => void;
  toggleOpen: () => void;
  setExpanded: (expanded: boolean) => void;
  setPosition: (x: number, y: number) => void;
  setContext: (context: CompanionContext | null) => void;
}

export const useAiCompanionStore = create<AiCompanionState>()(
  persist(
    (set) => ({
      isOpen: false,
      isExpanded: true,
      position: null,
      context: null,

      openCompanion: (context = null) =>
        set({ isOpen: true, isExpanded: true, context }),

      closeCompanion: () =>
        set({ isOpen: false, context: null }),

      toggleOpen: () =>
        set((s) => ({ isOpen: !s.isOpen, isExpanded: s.isOpen ? s.isExpanded : true })),

      setExpanded: (isExpanded) => set({ isExpanded }),

      setPosition: (x, y) => set({ position: { x, y } }),

      setContext: (context) => set({ context }),
    }),
    {
      name: 'roadmapai-companion',
      partialize: (state) => ({
        isOpen: state.isOpen,
        isExpanded: state.isExpanded,
        position: state.position,
      }),
    }
  )
);
