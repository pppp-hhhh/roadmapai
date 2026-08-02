export interface Roadmap {
  id: string;
  title: string;
  description: string;
  estimated_total_hours: number;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Quiz {
  questions: QuizQuestion[];
  passingScore: number;
  timeLimitMinutes?: number;
}

export interface Stage {
  id: string;
  order: number;
  name: string;
  objective: string;
  estimated_hours: number;
  tasks: Task[];
  stageType: 'learning' | 'quiz' | 'project';
  isLocked: boolean;
  isFallback?: boolean;
  quiz?: Quiz;
  passThreshold: number;
}

export interface Task {
  id: string;
  stage_id?: string;
  title: string;
  content: string;
  task_type: 'reading' | 'exercise' | 'project' | 'video' | 'quiz';
  code_example?: string;
  exercise?: string;
  is_completed: boolean;
  completed_at?: string;
  resources: Resource[];
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  snippet?: string;
  resource_type: 'documentation' | 'video' | 'course' | 'article';
}

export interface Flashcard {
  id: string;
  roadmap_id: string;
  question: string;
  answer: string;
  repetitions: number;
  ease_factor: number;
  interval: number;
  next_review_date: string;
}

export interface FlashcardDetail {
  flashcard: Flashcard;
  roadmap: Roadmap;
  stages: Stage[];
  tasks: Task[];
  resources: Resource[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface RoadmapRequest {
  topic: string;
  level: string;
  goal: string;
  difficulty: string;
}

export interface Settings {
  ai_provider: string;
  theme: 'light' | 'dark';
  default_weekly_hours: number;
}

export interface QuestionFeedback {
  questionId: string;
  correct: boolean;
  correctIndex: number;
  explanation: string;
}

export interface QuizResult {
  passed: boolean;
  score: number;
  correctCount: number;
  totalQuestions: number;
  feedback: QuestionFeedback[];
}

export interface ProgressEvent {
  type: 'started' | 'outline_complete' | 'stage_started' | 'stage_completed' | 'stage_failed' | 'enriching' | 'enrich_done' | 'completed' | 'failed';
  current: number;
  total: number;
  stage_title?: string;
  message: string;
}
