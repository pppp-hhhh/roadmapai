import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export type FavoriteType = 'task' | 'resource' | 'message';

export interface Favorite {
  id: string;
  type: FavoriteType;
  ref_id: string;
  roadmap_id: string | null;
  title: string;
  preview: string | null;
  created_at: string;
}

interface FavoriteState {
  favorites: Favorite[];
  isLoading: boolean;
  error: string | null;
  filter: FavoriteType | 'all';

  setFilter: (f: FavoriteType | 'all') => void;
  fetchFavorites: () => Promise<void>;
  addFavorite: (input: Omit<Favorite, 'id' | 'created_at'>) => Promise<Favorite | null>;
  removeFavorite: (id: string) => Promise<void>;
  isFavorited: (type: FavoriteType, refId: string) => boolean;
}

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  favorites: [],
  isLoading: false,
  error: null,
  filter: 'all',

  setFilter: (f) => {
    set({ filter: f });
    get().fetchFavorites();
  },

  fetchFavorites: async () => {
    set({ isLoading: true, error: null });
    try {
      const filter = get().filter;
      const filterType = filter === 'all' ? null : filter;
      const list = await invoke<Favorite[]>('list_favorites', { filterType });
      set({ favorites: list, isLoading: false });
    } catch (e) {
      // 后端命令未实现时降级为本地存储
      try {
        const local = localStorage.getItem('roadmapai-favorites');
        const list: Favorite[] = local ? JSON.parse(local) : [];
        const filter = get().filter;
        const filtered = filter === 'all' ? list : list.filter((f) => f.type === filter);
        set({ favorites: filtered, isLoading: false });
      } catch {
        set({ favorites: [], isLoading: false, error: String(e) });
      }
    }
  },

  addFavorite: async (input) => {
    try {
      const f = await invoke<Favorite>('add_favorite', { input });
      set({ favorites: [f, ...get().favorites] });
      return f;
    } catch {
      // 降级:localStorage
      const f: Favorite = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...input,
      };
      const list = [f, ...get().favorites];
      set({ favorites: list });
      try {
        localStorage.setItem('roadmapai-favorites', JSON.stringify(list));
      } catch {
        /* quota */
      }
      return f;
    }
  },

  removeFavorite: async (id) => {
    const prev = get().favorites;
    set({ favorites: prev.filter((f) => f.id !== id) });
    try {
      await invoke('remove_favorite', { id });
    } catch {
      // 降级:localStorage
      try {
        const list = prev.filter((f) => f.id !== id);
        localStorage.setItem('roadmapai-favorites', JSON.stringify(list));
      } catch {
        /* quota */
      }
    }
  },

  isFavorited: (type, refId) =>
    get().favorites.some((f) => f.type === type && f.ref_id === refId),
}));
