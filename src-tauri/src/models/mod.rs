use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Roadmap - Top level learning plan
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Roadmap {
    pub id: String,
    pub title: String,
    pub description: String,
    pub estimated_total_hours: f64,
    pub created_at: DateTime<Utc>,
}

/// Quiz question structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizQuestion {
    pub id: String,
    pub question: String,
    pub options: Vec<String>,
    pub correct_index: usize,
    pub explanation: String,
}

/// Quiz structure for level-pass mode
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quiz {
    #[serde(default)]
    pub questions: Vec<QuizQuestion>,
    #[serde(default = "default_passing_score")]
    pub passing_score: f64,
    pub time_limit_minutes: Option<u32>,
}

fn default_passing_score() -> f64 {
    0.7
}

fn default_pass_threshold() -> f64 {
    0.7
}

/// Stage - A phase within a roadmap (extended for pass mode)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Stage {
    pub id: String,
    pub roadmap_id: String,
    pub order: i32,
    pub name: String,
    pub objective: String,
    pub estimated_hours: f64,
    pub stage_type: String,         // "learning" | "quiz" | "project"
    pub is_locked: bool,           // True if user hasn't passed previous stage
    pub quiz_json: Option<String>,  // JSON serialized Quiz (for quiz stages)
    pub pass_threshold: f64,       // Default 0.7 (70%)
    pub metadata: Option<String>,  // JSON metadata: {"is_fallback": true}
}

/// Task - Individual learning task within a stage
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Task {
    pub id: String,
    pub stage_id: String,
    pub title: String,
    pub content: String,
    pub task_type: String,
    pub code_example: Option<String>,
    pub exercise: Option<String>,
    pub is_completed: bool,
    pub completed_at: Option<DateTime<Utc>>,
}

/// Resource - Learning resource linked to a task
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Resource {
    pub id: String,
    pub task_id: String,
    pub title: String,
    pub url: String,
    pub snippet: Option<String>,
    pub resource_type: String,
}

/// Flashcard - Spaced repetition flashcard
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Flashcard {
    pub id: String,
    pub roadmap_id: String,
    pub question: String,
    pub answer: String,
    pub repetitions: i32,
    pub ease_factor: f64,
    pub interval: i32,
    pub next_review_date: DateTime<Utc>,
}

/// ChatMessage - Chat message in a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    pub timestamp: DateTime<Utc>,
}

/// ChatSession (v1.1) - 多轮对话持久化
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ChatSession {
    pub id: String,
    pub roadmap_id: Option<String>,
    pub title: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// ChatMessageRow (v1.1) - 数据库行
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ChatMessageRow {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

/// Settings - User preferences
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Settings {
    pub id: String,
    pub ai_provider: String,
    pub theme: String,
    pub default_weekly_hours: i32,
}

/// Favorite - AI 闭环 v1.1 收藏夹
/// `type` 是 SQL 关键字,因此 Rust 字段叫 `fav_type`,通过 serde rename 为 `type`
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Favorite {
    pub id: String,
    #[serde(rename = "type")]
    pub fav_type: String,
    pub ref_id: String,
    pub roadmap_id: Option<String>,
    pub title: String,
    pub preview: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl Favorite {
    pub fn new(
        fav_type: String,
        ref_id: String,
        roadmap_id: Option<String>,
        title: String,
        preview: Option<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            fav_type,
            ref_id,
            roadmap_id,
            title,
            preview,
            created_at: Utc::now(),
        }
    }
}

/// API Key storage (for secure storage plugin)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyEntry {
    pub provider: String,
    pub key: String,
}

/// API Config (v1.1 重构) — 与 ApiKey 分离
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ApiConfig {
    pub provider: String,
    pub base_url: String,
    pub model: String,
    pub provider_type: String,
}

// Request/Response types for AI services

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoadmapRequest {
    pub topic: String,
    pub level: String,
    pub goal: String,
    pub difficulty: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoadmapResponse {
    pub id: String,
    pub title: String,
    pub description: String,
    pub estimated_total_hours: f64,
    pub stages: Vec<StageResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageResponse {
    pub id: String,
    pub order: i32,
    pub name: String,
    pub objective: String,
    pub estimated_hours: f64,
    pub stage_type: String,
    #[serde(default)]
    pub is_locked: bool,
    #[serde(default)]
    pub is_fallback: bool,
    #[serde(default = "default_pass_threshold")]
    pub pass_threshold: f64,
    #[serde(default)]
    pub tasks: Vec<TaskResponse>,
    pub quiz: Option<Quiz>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResponse {
    pub id: String,
    pub title: String,
    pub content: String,
    pub task_type: String,
    pub code_example: Option<String>,
    pub exercise: Option<String>,
    #[serde(default)]
    pub resources: Vec<ResourceResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceResponse {
    pub id: String,
    pub title: String,
    pub url: String,
    pub snippet: Option<String>,
    pub resource_type: String,
}

impl Roadmap {
    pub fn new(title: String, description: String, estimated_total_hours: f64) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            title,
            description,
            estimated_total_hours,
            created_at: Utc::now(),
        }
    }
}

impl Stage {
    pub fn new(roadmap_id: String, order: i32, name: String, objective: String, estimated_hours: f64, stage_type: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            roadmap_id,
            order,
            name,
            objective,
            estimated_hours,
            stage_type,
            is_locked: order > 1,  // First stage unlocked, others locked by default
            quiz_json: None,
            pass_threshold: 0.7,
            metadata: None,
        }
    }

    pub fn with_quiz(mut self, quiz: Quiz) -> Self {
        self.quiz_json = Some(serde_json::to_string(&quiz).unwrap_or_default());
        self
    }
}

impl Task {
    pub fn new(stage_id: String, title: String, content: String, task_type: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            stage_id,
            title,
            content,
            task_type,
            code_example: None,
            exercise: None,
            is_completed: false,
            completed_at: None,
        }
    }
}

impl Resource {
    pub fn new(task_id: String, title: String, url: String, resource_type: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            task_id,
            title,
            url,
            snippet: None,
            resource_type,
        }
    }
}

/// Flashcard with full context from its roadmap
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlashcardDetail {
    pub flashcard: Flashcard,
    pub roadmap: Roadmap,
    pub stages: Vec<Stage>,
    pub tasks: Vec<Task>,
    pub resources: Vec<Resource>,
}

impl Flashcard {
    pub fn new(roadmap_id: String, question: String, answer: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            roadmap_id,
            question,
            answer,
            repetitions: 0,
            ease_factor: 2.5,
            interval: 0,
            next_review_date: Utc::now(),
        }
    }
}
