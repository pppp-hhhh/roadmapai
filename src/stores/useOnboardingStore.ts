import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

export type OnboardingStep = 0 | 1 | 2 | 3 | 4;
export type ProviderChoice = 'anthropic' | 'openai' | 'deepseek' | 'custom';
export type OnboardingLevel = '入门' | '进阶' | '高级';

export interface OnboardingData {
  provider: ProviderChoice;
  apiKey: string;
  baseUrl: string;
  model: string;
  topic: string;
  level: OnboardingLevel;
  goal: string;
  weeklyHours: number;
  createdRoadmapId: string | null;
}

interface OnboardingState extends OnboardingData {
  currentStep: OnboardingStep;
  completed: boolean;
  hasUnsavedChanges: boolean;

  setField: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  nextStep: () => void;
  prevStep: () => void;
  gotoStep: (step: OnboardingStep) => void;
  reset: () => void;
  markCompleted: () => void;
  detectRecommendedRegion: () => Promise<'cn' | 'us' | 'other'>;
  recommendProvider: (region: 'cn' | 'us' | 'other') => ProviderChoice;
  saveApiConfig: () => Promise<void>;
}

const initialData: OnboardingData = {
  provider: 'anthropic',
  apiKey: '',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-3-5-sonnet-20241022',
  topic: '',
  level: '入门',
  goal: '',
  weeklyHours: 5,
  createdRoadmapId: null,
};

const PROVIDER_DEFAULTS: Record<ProviderChoice, { baseUrl: string; model: string }> = {
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-3-5-sonnet-20241022' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  custom: { baseUrl: '', model: '' },
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initialData,
      currentStep: 0,
      completed: false,
      hasUnsavedChanges: false,

      setField: (key, value) => {
        // provider 切换时,自动填充 baseUrl/model
        if (key === 'provider' && typeof value === 'string') {
          const def = PROVIDER_DEFAULTS[value as ProviderChoice];
          set({
            provider: value as ProviderChoice,
            baseUrl: def.baseUrl,
            model: def.model,
            hasUnsavedChanges: true,
          } as any);
          return;
        }
        set({ [key]: value, hasUnsavedChanges: true } as any);
      },

      nextStep: () => {
        const s = get().currentStep;
        if (s < 4) set({ currentStep: (s + 1) as OnboardingStep });
      },
      prevStep: () => {
        const s = get().currentStep;
        if (s > 0) set({ currentStep: (s - 1) as OnboardingStep });
      },
      gotoStep: (step) => set({ currentStep: step }),
      reset: () => set({ ...initialData, currentStep: 0, completed: false, hasUnsavedChanges: false }),
      markCompleted: () => set({ completed: true }),

      detectRecommendedRegion: async () => {
        try {
          const region = await invoke<'cn' | 'us' | 'other'>('detect_user_region');
          return region;
        } catch {
          return 'other';
        }
      },

      recommendProvider: (region) => {
        if (region === 'cn') return 'deepseek';
        return 'anthropic';
      },

      saveApiConfig: async () => {
        const { provider, apiKey, baseUrl, model } = get();
        // 映射:deepseek/custom 都走 openai 协议
        const providerType: 'openai' | 'anthropic' =
          provider === 'anthropic' ? 'anthropic' : 'openai';
        const providerId = provider === 'anthropic' ? 'anthropic' : 'openai';

        await invoke('save_api_key', { provider: providerId, key: apiKey });
        await invoke('save_api_config', {
          provider: providerId,
          config: { base_url: baseUrl, model, provider_type: providerType },
        });
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
        provider: s.provider,
        apiKey: s.apiKey,
        baseUrl: s.baseUrl,
        model: s.model,
        topic: s.topic,
        level: s.level,
        goal: s.goal,
        weeklyHours: s.weeklyHours,
        currentStep: s.currentStep,
        completed: s.completed,
      }),
    }
  )
);
