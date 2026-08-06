import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

export interface OnboardingData {
  apiKey: string;
  baseUrl: string;
  model: string;
  tavilyKey: string;
}

interface OnboardingState extends OnboardingData {
  completed: boolean;

  setField: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  reset: () => void;
  markCompleted: () => void;
  saveApiConfig: () => Promise<void>;
}

const initialData: OnboardingData = {
  apiKey: '',
  baseUrl: '',
  model: '',
  tavilyKey: '',
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initialData,
      completed: false,

      setField: (key, value) => {
        set({ [key]: value } as any);
      },

      reset: () => set({ ...initialData, completed: false }),
      markCompleted: () => set({ completed: true }),

      saveApiConfig: async () => {
        const { apiKey, baseUrl, model, tavilyKey } = get();
        // 统一按自定义模型(OpenAI 兼容协议)保存,生成/对话都走 baseUrl + model
        const providerType: 'openai' | 'anthropic' = 'openai';
        const providerId = 'openai';

        await invoke('save_api_key', { provider: providerId, key: apiKey });
        await invoke('save_api_config', {
          provider: providerId,
          config: { base_url: baseUrl, model, provider_type: providerType },
        });
        // 资源搜索 API Key(可选,仅在填写时保存,避免覆盖已有配置)
        if (tavilyKey.trim()) {
          await invoke('save_api_key', { provider: 'tavily', key: tavilyKey.trim() });
        }
        // 同步到 useSettingsStore
        const { useSettingsStore } = await import('./useSettingsStore');
        useSettingsStore.getState().setAiProvider(providerId);

        // 立即通知 sidebar 更新"待配置"徽标(无需等 Layout 下次 mount)
        const { useSidebarStore } = await import('./useSidebarStore');
        useSidebarStore.getState().setApiStatus(providerId, !!apiKey.trim());
      },
    }),
    {
      name: 'roadmapai-onboarding',
      partialize: (s) => ({
        apiKey: s.apiKey,
        baseUrl: s.baseUrl,
        model: s.model,
        tavilyKey: s.tavilyKey,
        completed: s.completed,
      }),
      version: 1,
      migrate: (persisted) => {
        const old = (persisted ?? {}) as Partial<OnboardingData> & { completed?: boolean };
        return {
          ...initialData,
          apiKey: old.apiKey ?? '',
          baseUrl: old.baseUrl ?? '',
          model: old.model ?? '',
          tavilyKey: old.tavilyKey ?? '',
          completed: old.completed ?? false,
        };
      },
    }
  )
);
