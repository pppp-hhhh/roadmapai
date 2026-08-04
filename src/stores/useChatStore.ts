import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ChatMessage } from '../types';

export interface SendMessageOptions {
  stageId?: string | null;
  taskId?: string | null;
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sessionId: string;

  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  error: null,
  sessionId: crypto.randomUUID(),

  sendMessage: async (content: string, options?: SendMessageOptions) => {
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
      const payload: Record<string, unknown> = { sessionId, message: content };
      if (options?.stageId != null) payload.stageId = options.stageId;
      if (options?.taskId != null) payload.taskId = options.taskId;
      const response = await invoke<string>('chat_send', payload);

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
