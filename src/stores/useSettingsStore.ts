import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import type { Settings } from '../types';

interface SettingsState extends Settings {
  isLoading: boolean;
  error: string | null;
  connectionStatus: 'idle' | 'testing' | 'success' | 'error';

  saveApiKey: (provider: string, key: string) => Promise<void>;
  getApiKey: (provider: string) => Promise<string>;
  saveApiConfig: (provider: string, baseUrl: string, model: string, providerType: 'openai' | 'anthropic') => Promise<void>;
  getApiConfig: (provider: string) => Promise<{ baseUrl: string; model: string; providerType: string } | null>;
  testConnection: (provider: string, config: { baseUrl: string; model: string; providerType: string }) => Promise<boolean>;
  setTheme: (theme: 'light' | 'dark') => void;
  setAiProvider: (provider: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ai_provider: 'openai',
      theme: 'dark',
      default_weekly_hours: 10,
      isLoading: false,
      error: null,
      connectionStatus: 'idle',

      saveApiKey: async (provider: string, key: string) => {
        set({ isLoading: true, error: null });
        try {
          await invoke('save_api_key', { provider, key });
          set({ isLoading: false });
        } catch (error) {
          set({ error: String(error), isLoading: false });
          throw error;
        }
      },

      getApiKey: async (provider: string) => {
        try {
          return await invoke<string>('get_api_key', { provider });
        } catch {
          return '';
        }
      },

      saveApiConfig: async (provider: string, baseUrl: string, model: string, providerType: 'openai' | 'anthropic') => {
        set({ isLoading: true, error: null });
        try {
          await invoke('save_api_config', { provider, config: { base_url: baseUrl, model, provider_type: providerType } });
          set({ isLoading: false });
        } catch (error) {
          set({ error: String(error), isLoading: false });
          throw error;
        }
      },

      getApiConfig: async (provider: string) => {
        try {
          const result = await invoke<{ base_url: string; model: string; provider_type: string; found: boolean }>('get_api_config', { provider });
          if (result && result.found) {
            return { baseUrl: result.base_url, model: result.model, providerType: result.provider_type };
          }
          return null;
        } catch {
          return null;
        }
      },

      testConnection: async (provider: string, config: { baseUrl: string; model: string; providerType: string }) => {
        set({ connectionStatus: 'testing', error: null });
        try {
          const result = await invoke<boolean>('test_connection', {
            provider,
            config: { base_url: config.baseUrl, model: config.model, provider_type: config.providerType },
          });
          set({ connectionStatus: result ? 'success' : 'error' });
          return result;
        } catch (error) {
          const msg = String(error);
          set({ connectionStatus: 'error', error: msg });
          throw new Error(msg);
        }
      },

      setTheme: (theme: 'light' | 'dark') => {
        set({ theme });
        document.documentElement.classList.toggle('dark', theme === 'dark');
      },

      setAiProvider: (provider: string) => {
        set({ ai_provider: provider });
      },
    }),
    {
      name: 'ai-learning-planner-settings',
      partialize: state => ({
        ai_provider: state.ai_provider,
        theme: state.theme,
        default_weekly_hours: state.default_weekly_hours,
      }),
    }
  )
);