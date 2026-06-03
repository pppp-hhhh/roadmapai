import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Roadmap, RoadmapRequest, Stage, QuizResult, ProgressEvent, Resource } from '../types';

interface RoadmapState {
  roadmaps: Roadmap[];
  currentRoadmap: Roadmap & { stages: Stage[] } | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  progress: ProgressEvent | null;

  fetchRoadmaps: () => Promise<void>;
  fetchRoadmap: (id: string) => Promise<void>;
  generateRoadmap: (params: RoadmapRequest) => Promise<string>;
  deleteRoadmap: (id: string) => Promise<void>;
  markTaskCompleted: (taskId: string, completed: boolean) => Promise<void>;
  submitQuiz: (stageId: string, answers: number[]) => Promise<QuizResult>;
  getTaskCount: (roadmapId: string) => Promise<{ total: number; completed: number }>;
  addResource: (taskId: string, title: string, url: string, snippet: string, resourceType: string) => Promise<Resource>;
  updateResource: (id: string, title: string, url: string, snippet: string, resourceType: string) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  retryStage: (stageId: string) => Promise<void>;
}

export const useRoadmapStore = create<RoadmapState>((set, get) => ({
  roadmaps: [],
  currentRoadmap: null,
  isLoading: false,
  isGenerating: false,
  error: null,
  progress: null,

  fetchRoadmaps: async () => {
    set({ isLoading: true, error: null });
    try {
      const roadmaps = await invoke<Roadmap[]>('get_all_roadmaps');
      set({ roadmaps, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchRoadmap: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const roadmap = await invoke<Roadmap & { stages: Stage[] }>('get_roadmap', { id });
      set({ currentRoadmap: roadmap, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  generateRoadmap: async (params: RoadmapRequest) => {
    set({ isGenerating: true, error: null, progress: null });
    const unlisten = await listen<ProgressEvent>('roadmap-progress', (e) => {
      set({ progress: e.payload });
    });
    try {
      const result = await invoke<any>('generate_roadmap', { params });
      set({ isGenerating: false, progress: null });
      unlisten();
      await get().fetchRoadmaps();
      return result.id;
    } catch (error) {
      set({ error: String(error), isGenerating: false, progress: null });
      unlisten();
      throw error;
    }
  },

  deleteRoadmap: async (id: string) => {
    try {
      await invoke('delete_roadmap', { id });
      await get().fetchRoadmaps();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  markTaskCompleted: async (taskId: string, completed: boolean) => {
    try {
      await invoke('mark_task_completed', { taskId, completed });
      const { currentRoadmap } = get();
      if (currentRoadmap) {
        const updatedStages = currentRoadmap.stages.map(stage => ({
          ...stage,
          tasks: stage.tasks.map(task =>
            task.id === taskId ? { ...task, is_completed: completed } : task
          ),
        }));
        set({ currentRoadmap: { ...currentRoadmap, stages: updatedStages } });
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  submitQuiz: async (stageId: string, answers: number[]) => {
    try {
      const result = await invoke<QuizResult>('submit_quiz', { stageId, answers });
      await get().fetchRoadmap(get().currentRoadmap?.id || '');
      return result;
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  getTaskCount: async (roadmapId: string) => {
    try {
      const stages = await invoke<Stage[]>('get_roadmap_stages', { roadmapId });
      let total = 0;
      let completed = 0;
      for (const stage of stages) {
        const tasks = stage.tasks || [];
        total += tasks.length;
        completed += tasks.filter(t => t.is_completed).length;
      }
      return { total, completed };
    } catch {
      return { total: 0, completed: 0 };
    }
  },

  addResource: async (taskId: string, title: string, url: string, snippet: string, resourceType: string) => {
    const result = await invoke<Resource>('add_resource', {
      request: { task_id: taskId, title, url, snippet, resource_type: resourceType },
    });
    return result;
  },

  updateResource: async (id: string, title: string, url: string, snippet: string, resourceType: string) => {
    await invoke('update_resource', {
      request: { id, title, url, snippet, resource_type: resourceType },
    });
  },

  deleteResource: async (id: string) => {
    await invoke('delete_resource', { id });
  },

  retryStage: async (stageId: string) => {
    set({ isLoading: true });
    try {
      const updatedStage = await invoke<any>('retry_stage', { stageId });
      if (get().currentRoadmap) {
        const current = get().currentRoadmap!;
        const updatedStages = current.stages.map(s =>
          s.id === stageId ? { ...s, ...updatedStage, tasks: updatedStage.tasks } : s
        );
        set({ currentRoadmap: { ...current, stages: updatedStages }, isLoading: false });
      }
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },
}));
