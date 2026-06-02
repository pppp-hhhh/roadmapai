import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ChatMessage } from '../types';

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sessionId: string;

  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  error: null,
  sessionId: crypto.randomUUID(),

  sendMessage: async (content: string) => {
    const { messages, sessionId } = get();

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    set({
      messages: [...messages, userMessage],
      isStreaming: true,
      error: null,
    });

    try {
      const response = await invoke<string>('chat_send', { sessionId, message: content });

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      set({
        messages: [...messages, userMessage, assistantMessage],
        isStreaming: false,
      });
    } catch (error) {
      set({ error: String(error), isStreaming: false });
    }
  },

  clearMessages: () => {
    set({
      messages: [],
      sessionId: crypto.randomUUID(),
    });
  },
}));