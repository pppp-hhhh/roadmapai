import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Flashcard, FlashcardDetail } from '../types';

interface FlashcardState {
  dueCards: Flashcard[];
  newCards: Flashcard[];
  currentCardIndex: number;
  isReviewing: boolean;
  isLearning: boolean;
  isLoading: boolean;
  error: string | null;
  reviewStats: {
    total: number;
    correct: number;
    incorrect: number;
  };
  selectedCardDetail: FlashcardDetail | null;

  fetchDueCards: () => Promise<void>;
  fetchNewCards: () => Promise<void>;
  createFlashcard: (roadmapId: string, question: string, answer: string) => Promise<void>;
  fetchFlashcardDetail: (cardId: string) => Promise<FlashcardDetail>;
  clearCardDetail: () => void;
  startReview: () => void;
  startLearning: () => void;
  reviewCard: (cardId: string, quality: number) => Promise<void>;
  learnCard: (cardId: string) => Promise<void>;
  nextCard: () => void;
  endReview: () => void;
}

export const useFlashcardStore = create<FlashcardState>((set, get) => ({
  dueCards: [],
  newCards: [],
  currentCardIndex: 0,
  isReviewing: false,
  isLearning: false,
  isLoading: false,
  error: null,
  reviewStats: {
    total: 0,
    correct: 0,
    incorrect: 0,
  },
  selectedCardDetail: null,

  fetchDueCards: async () => {
    set({ isLoading: true, error: null });
    try {
      const cards = await invoke<Flashcard[]>('get_due_flashcards');
      set({ dueCards: cards, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchNewCards: async () => {
    set({ isLoading: true, error: null });
    try {
      const cards = await invoke<Flashcard[]>('get_new_flashcards');
      set({ newCards: cards, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createFlashcard: async (roadmapId: string, question: string, answer: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke<Flashcard>('create_flashcard', {
        request: { roadmap_id: roadmapId, question, answer },
      });
      await Promise.all([get().fetchNewCards(), get().fetchDueCards()]);
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchFlashcardDetail: async (cardId: string) => {
    set({ isLoading: true, error: null });
    try {
      const detail = await invoke<FlashcardDetail>('get_flashcard_detail', { cardId });
      set({ selectedCardDetail: detail, isLoading: false });
      return detail;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  clearCardDetail: () => {
    set({ selectedCardDetail: null });
  },

  startReview: () => {
    set({
      isReviewing: true,
      isLearning: false,
      currentCardIndex: 0,
      reviewStats: { total: 0, correct: 0, incorrect: 0 },
    });
  },

  startLearning: () => {
    set({
      isLearning: true,
      isReviewing: false,
      currentCardIndex: 0,
    });
  },

  reviewCard: async (cardId: string, quality: number) => {
    const { reviewStats } = get();
    try {
      await invoke('review_flashcard', { cardId, quality });
      set({
        reviewStats: {
          total: reviewStats.total + 1,
          correct: quality >= 3 ? reviewStats.correct + 1 : reviewStats.correct,
          incorrect: quality < 3 ? reviewStats.incorrect + 1 : reviewStats.incorrect,
        },
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  learnCard: async (cardId: string) => {
    try {
      await invoke('learn_flashcard', { cardId });
      // Refresh new cards list
      await get().fetchNewCards();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  nextCard: () => {
    const { currentCardIndex, dueCards, newCards, isReviewing, isLearning } = get();
    const list = isReviewing ? dueCards : isLearning ? newCards : [];
    if (currentCardIndex < list.length - 1) {
      set({ currentCardIndex: currentCardIndex + 1 });
    }
  },

  endReview: () => {
    set({ isReviewing: false });
  },
}));
