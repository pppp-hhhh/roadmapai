export interface Roadmap {
  id: string;
  title: string;
  description: string;
  estimated_total_hours: number;
  created_at: string;
  metadata?: string | null;
}

export interface Stage {
  id: string;
  order: number;
  name: string;
  objective: string;
  prerequisites: string[];
  estimated_hours: number;
  tasks: Task[];
  stage_type: 'learning' | 'project';
  is_fallback?: boolean;
}

export interface Task {
  id: string;
  stage_id?: string;
  order: number;
  title: string;
  content: string;
  points: string[];
  prerequisites: string[];
  task_type: 'reading' | 'video' | 'project';
  example?: string | null;
  is_completed: boolean;
  completed_at?: string | null;
  resources: Resource[];
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  snippet?: string;
  resource_type: 'documentation' | 'video' | 'course' | 'article';
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
  profile?: string;
}

export interface Settings {
  ai_provider: string;
  theme: 'light' | 'dark';
  default_weekly_hours: number;
}

export interface IntakeAskRequest {
  topic: string;
  goal: string;
  conversation: string[];
  skipped: string[];
  round: number;
}

export interface IntakeAskResponse {
  question: string;
  round: number;
}

export interface IntakeSummarizeRequest {
  topic: string;
  goal: string;
  conversation: string[];
  supplementary?: string;
}

export interface IntakeSummary {
  topic: string;
  goal: string;
  level: string;
  difficulty: string;
  profile: string;
}

export type OptimizeScope = 'roadmap' | 'stage' | 'task';

export interface OptimizeRoadmapRequest {
  roadmap_id: string;
  scope: OptimizeScope;
  stage_id?: string | null;
  task_id?: string | null;
  feedback: string;
}

export interface RoadmapDetail {
  id: string;
  title: string;
  description: string;
  estimated_total_hours: number;
  created_at: string;
  metadata?: string | null;
  stages: Stage[];
}

export interface ProgressEvent {
  type: 'started' | 'outline_complete' | 'stage_started' | 'stage_completed' | 'stage_failed' | 'enriching' | 'enrich_done' | 'completed' | 'failed';
  current: number;
  total: number;
  stage_title?: string;
  message: string;
}
