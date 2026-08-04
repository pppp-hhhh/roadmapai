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
    #[serde(default)]
    pub metadata: Option<String>,
}

/// Stage - A phase within a roadmap
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Stage {
    pub id: String,
    pub roadmap_id: String,
    pub order: i32,
    pub name: String,
    pub objective: String,
    pub estimated_hours: f64,
    pub stage_type: String,       // "learning" | "project"
    pub prerequisites: String,    // JSON array text, e.g. ["前一阶段"]
    pub metadata: Option<String>, // JSON metadata: {"is_fallback": true}
}

/// Task - Individual learning task within a stage
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Task {
    pub id: String,
    pub stage_id: String,
    pub order: i32,
    pub title: String,
    pub content: String,
    pub points: String,        // JSON array text, e.g. ["要点1"]
    pub prerequisites: String, // JSON array text, e.g. ["前置任务"]
    pub task_type: String,
    pub example: Option<String>,
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
    pub stage_id: Option<String>,
    pub task_id: Option<String>,
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
    #[serde(default)]
    pub profile: Option<String>,
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
    #[serde(default)]
    pub prerequisites: Vec<String>,
    pub estimated_hours: f64,
    pub stage_type: String,
    #[serde(default)]
    pub is_fallback: bool,
    #[serde(default)]
    pub tasks: Vec<TaskResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResponse {
    pub id: String,
    pub order: i32,
    pub title: String,
    pub content: String,
    #[serde(default)]
    pub points: Vec<String>,
    #[serde(default)]
    pub prerequisites: Vec<String>,
    pub task_type: String,
    pub example: Option<String>,
    #[serde(default)]
    pub is_completed: bool,
    #[serde(default)]
    pub completed_at: Option<DateTime<Utc>>,
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
            metadata: None,
        }
    }
}

impl Stage {
    pub fn new(
        roadmap_id: String,
        order: i32,
        name: String,
        objective: String,
        estimated_hours: f64,
        stage_type: String,
        prerequisites: String,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            roadmap_id,
            order,
            name,
            objective,
            estimated_hours,
            stage_type,
            prerequisites,
            metadata: None,
        }
    }
}

impl Task {
    pub fn new(
        stage_id: String,
        order: i32,
        title: String,
        content: String,
        task_type: String,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            stage_id,
            order,
            title,
            content,
            points: "[]".to_string(),
            prerequisites: "[]".to_string(),
            task_type,
            example: None,
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
