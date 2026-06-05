import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RoadmapRequest } from '../types';

export type WizardStep = 1 | 2 | 3 | 4;

export type Level = '入门' | '进阶' | '高级';
export type Difficulty = '简单' | '适中' | '困难';
export type GoalTemplate = 'job' | 'exam' | 'project' | 'interest' | 'custom';

export interface WizardData {
  topic: string;
  level: Level;
  goal: GoalTemplate;
  goalDetail: string;
  weeklyHours: number;
  difficulty: Difficulty;
  includeProject: boolean;
}

export const GOAL_TEMPLATES: { key: GoalTemplate; label: string; placeholder: string }[] = [
  { key: 'job', label: '求职面试', placeholder: '如：3 个月内拿到前端岗 offer' },
  { key: 'exam', label: '期末复习', placeholder: '如：本学期通过 XXX 考试' },
  { key: 'project', label: '项目实战', placeholder: '如：3 个月内做出可上线的 MVP' },
  { key: 'interest', label: '个人兴趣', placeholder: '如：系统了解、不赶进度' },
  { key: 'custom', label: '其他', placeholder: '请描述你的目标' },
];

interface WizardState extends WizardData {
  currentStep: WizardStep;
  hasUnsavedChanges: boolean;
  setField: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;
  nextStep: () => void;
  prevStep: () => void;
  gotoStep: (step: WizardStep) => void;
  reset: () => void;
}

const initialData: WizardData = {
  topic: '',
  level: '入门',
  goal: 'interest',
  goalDetail: '',
  weeklyHours: 5,
  difficulty: '适中',
  includeProject: true,
};

export const useCreateRoadmapWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      ...initialData,
      currentStep: 1,
      hasUnsavedChanges: false,

      setField: (key, value) => {
        set({ [key]: value, hasUnsavedChanges: true } as any);
      },

      nextStep: () => {
        const s = get().currentStep;
        if (s < 4) set({ currentStep: (s + 1) as WizardStep });
      },
      prevStep: () => {
        const s = get().currentStep;
        if (s > 1) set({ currentStep: (s - 1) as WizardStep });
      },
      gotoStep: (step) => set({ currentStep: step }),
      reset: () => set({ ...initialData, currentStep: 1, hasUnsavedChanges: false }),
    }),
    {
      name: 'roadmapai-create-wizard',
      partialize: (s) => ({
        topic: s.topic,
        level: s.level,
        goal: s.goal,
        goalDetail: s.goalDetail,
        weeklyHours: s.weeklyHours,
        difficulty: s.difficulty,
        includeProject: s.includeProject,
        currentStep: s.currentStep,
      }),
    }
  )
);

// ========== 校验与拼装 ==========

export interface ValidateTopicResult {
  valid: boolean;
  /** 温和建议(主题合法但太宽泛) */
  warning?: string;
  /** 非法原因 */
  error?: string;
}

const TOO_VAGUE = ['AI', '编程', '学习', '技术', '数学', '英语', '前端', '后端', '开发'];

export function validateTopic(topic: string): ValidateTopicResult {
  const t = topic.trim();
  if (t.length < 2) {
    return { valid: false, error: '主题太短,至少 2 个字' };
  }
  if (t.length > 60) {
    return { valid: false, error: '主题过长,不超过 60 字' };
  }
  if (TOO_VAGUE.includes(t)) {
    return {
      valid: true,
      warning: '主题过于宽泛,建议具体一些(如 "机器学习" 比 "AI" 更聚焦)',
    };
  }
  return { valid: true };
}

export function canProceedFromStep(
  step: WizardStep,
  data: WizardData,
): boolean {
  if (step === 1) {
    const r = validateTopic(data.topic);
    return r.valid && !r.error;
  }
  if (step === 2) {
    return !!data.level;
  }
  if (step === 3) {
    if (!data.goal) return false;
    if (data.goal === 'custom' && !data.goalDetail.trim()) return false;
    return true;
  }
  if (step === 4) {
    return data.weeklyHours > 0 && !!data.difficulty;
  }
  return true;
}

/** 把 wizard 字段拼回 v1.0 的 RoadmapRequest,后端零改动 */
export function toRoadmapRequest(data: WizardData): RoadmapRequest {
  const goalText = (() => {
    const t = GOAL_TEMPLATES.find((g) => g.key === data.goal);
    if (!t) return data.goalDetail;
    if (data.goal === 'custom') return data.goalDetail;
    if (data.goalDetail.trim()) {
      return `${t.label}:${data.goalDetail.trim()}`;
    }
    return t.label;
  })();

  const difficultyText = `${data.difficulty} · 每周约 ${data.weeklyHours} 小时${
    data.includeProject ? ' · 含项目实战' : ''
  }`;

  return {
    topic: data.topic.trim(),
    level: data.level,
    goal: goalText,
    difficulty: difficultyText,
  };
}
