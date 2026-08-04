import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { IntakeAskResponse, IntakeSummary } from '../types';

export const INTAKE_SUMMARY_ROUND = 10;

export type IntakeStatus =
  | 'baseline'
  | 'asking'
  | 'question'
  | 'summarizing'
  | 'summary'
  | 'error';

export type IntakeErrorAction = 'ask' | 'summarize';

interface IntakeState {
  topic: string;
  goal: string;
  conversation: string[];
  supplementary: string;
  round: number;
  question: string;
  status: IntakeStatus;
  error: string | null;
  errorAction: IntakeErrorAction | null;
  summary: IntakeSummary | null;

  setBaseline: (topic: string, goal: string) => void;
  askNext: () => Promise<void>;
  submitAnswer: (answer: string) => void;
  backToQuestion: () => void;
  setSupplementary: (value: string) => void;
  summarize: () => Promise<void>;
  setSummary: (patch: Partial<IntakeSummary>) => void;
  reset: () => void;
}

export const useIntakeStore = create<IntakeState>((set, get) => ({
  topic: '',
  goal: '',
  conversation: [],
  supplementary: '',
  round: 0,
  question: '',
  status: 'baseline',
  error: null,
  errorAction: null,
  summary: null,

  setBaseline: (topic, goal) =>
    set({ topic: topic.trim(), goal: goal.trim(), error: null, status: 'baseline' }),

  askNext: async () => {
    const { topic, goal, conversation, round } = get();
    if (!topic.trim() || !goal.trim()) return;
    const nextRound = round + 1;
    set({ status: 'asking', error: null, errorAction: null });
    try {
      const res = await invoke<IntakeAskResponse>('intake_ask', {
        request: {
          topic: topic.trim(),
          goal: goal.trim(),
          conversation,
          round: nextRound,
        },
      });
      set({
        question: res.question,
        round: res.round ?? nextRound,
        conversation: [...get().conversation, res.question],
        status: 'question',
        error: null,
      });
    } catch (error) {
      set({ status: 'error', error: String(error), errorAction: 'ask' });
    }
  },

  submitAnswer: (answer) => {
    const text = answer.trim();
    if (!text) return;
    const { conversation } = get();
    set({
      conversation: [...conversation, text],
    });
  },

  backToQuestion: () => set({ status: 'question', error: null, errorAction: null }),

  setSupplementary: (value) => set({ supplementary: value }),

  summarize: async () => {
    const { topic, goal, conversation, supplementary } = get();
    set({ status: 'summarizing', error: null, errorAction: null });
    try {
      const summary = await invoke<IntakeSummary>('intake_summarize', {
        request: {
          topic: topic.trim(),
          goal: goal.trim(),
          conversation,
          ...(supplementary.trim() ? { supplementary: supplementary.trim() } : {}),
        },
      });
      set({ summary, status: 'summary', error: null });
    } catch (error) {
      set({ status: 'error', error: String(error), errorAction: 'summarize' });
    }
  },

  setSummary: (patch) =>
    set((s) => ({
      summary: s.summary ? { ...s.summary, ...patch } : s.summary,
    })),

  reset: () =>
    set({
      topic: '',
      goal: '',
      conversation: [],
      supplementary: '',
      round: 0,
      question: '',
      status: 'baseline',
      error: null,
      errorAction: null,
      summary: null,
    }),
}));
