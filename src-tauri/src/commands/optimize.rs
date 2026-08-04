use crate::commands::roadmap::{build_roadmap_response, call_ai_with_retry};
use crate::models::{Resource, Roadmap, RoadmapResponse, Stage, Task};
use crate::services::parallel::{json_array_string, parse_string_array};
use crate::services::roadmap_parser::clean_json;
use crate::AppState;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::{info, warn};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct OptimizeRoadmapRequest {
    pub roadmap_id: String,
    pub scope: String,
    #[serde(default)]
    pub stage_id: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    pub feedback: String,
}

struct AiConnection {
    provider_type: String,
    base_url: String,
    model: String,
    api_key: String,
}

async fn resolve_ai_connection(state: &State<'_, AppState>) -> Result<AiConnection, String> {
    let (settings, api_key, (base_url_opt, model_opt, provider_type_opt)) = {
        let db = state.db.lock().await;
        let settings = db.get_settings().await?;
        let api_key = db
            .get_api_key(&settings.ai_provider)
            .await?
            .ok_or_else(|| {
                format!(
                    "{} 的 API Key 未找到，请在设置中配置 API Key",
                    settings.ai_provider
                )
            })?;
        let cfg = db.get_api_config(&settings.ai_provider).await?;
        let (b, m, p) = match cfg {
            Some(c) => (Some(c.base_url), Some(c.model), Some(c.provider_type)),
            None => (None, None, None),
        };
        (settings, api_key, (b, m, p))
    };

    let provider_type = provider_type_opt.unwrap_or_else(|| {
        let p = settings.ai_provider.to_lowercase();
        if p == "claude" || p == "anthropic" {
            "anthropic".to_string()
        } else {
            "openai".to_string()
        }
    });

    let (base_url, model) = if provider_type == "anthropic" {
        (
            "https://api.anthropic.com".to_string(),
            model_opt.unwrap_or_else(|| "claude-sonnet-4-20250514".to_string()),
        )
    } else {
        (
            base_url_opt.unwrap_or_else(|| "https://api.openai.com/v1".to_string()),
            model_opt.unwrap_or_else(|| "gpt-4o".to_string()),
        )
    };

    Ok(AiConnection {
        provider_type,
        base_url,
        model,
        api_key,
    })
}

// ============ Snapshot types (fed to the AI) ============

#[derive(Debug, Serialize)]
struct RoadmapSnapshot {
    id: String,
    title: String,
    description: String,
    estimated_total_hours: f64,
    stages: Vec<StageSnapshot>,
}

#[derive(Debug, Serialize)]
struct StageSnapshot {
    id: String,
    order: i32,
    name: String,
    objective: String,
    prerequisites: Vec<String>,
    estimated_hours: f64,
    stage_type: String,
    is_fallback: bool,
    tasks: Vec<TaskSnapshot>,
}

#[derive(Debug, Serialize)]
struct TaskSnapshot {
    id: String,
    order: i32,
    title: String,
    content: String,
    points: Vec<String>,
    prerequisites: Vec<String>,
    task_type: String,
    example: Option<String>,
    is_completed: bool,
    completed_at: Option<String>,
    resources: Vec<ResourceSnapshot>,
}

#[derive(Debug, Serialize)]
struct ResourceSnapshot {
    id: String,
    title: String,
    url: String,
    snippet: Option<String>,
    resource_type: String,
}

struct ExistingStage {
    stage: Stage,
    tasks: Vec<Task>,
}

// ============ AI response types ============

#[derive(Debug, Deserialize)]
struct OptimizedRoadmap {
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    estimated_total_hours: Option<f64>,
    #[serde(default)]
    stages: Vec<AiStage>,
}

#[derive(Debug, Deserialize)]
struct AiStage {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    order: Option<i32>,
    name: String,
    #[serde(default)]
    objective: Option<String>,
    #[serde(default)]
    prerequisites: Option<Vec<String>>,
    #[serde(default)]
    estimated_hours: Option<f64>,
    #[serde(default)]
    tasks: Vec<AiTask>,
}

#[derive(Debug, Deserialize)]
struct AiTask {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    order: Option<i32>,
    title: String,
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    points: Option<Vec<String>>,
    #[serde(default)]
    prerequisites: Option<Vec<String>>,
    #[serde(default)]
    task_type: Option<String>,
    #[serde(default)]
    example: Option<String>,
    #[serde(default)]
    video: Option<String>,
    #[serde(default)]
    deleted: Option<bool>,
    #[serde(default)]
    resources: Vec<AiResource>,
}

#[derive(Debug, Deserialize)]
struct AiResource {
    title: String,
    #[serde(default)]
    url: String,
    #[serde(default)]
    snippet: Option<String>,
    #[serde(default)]
    resource_type: Option<String>,
}

// ============ Loading ============

async fn load_roadmap(
    db: &crate::Database,
    roadmap_id: &str,
) -> Result<(Roadmap, Vec<ExistingStage>, RoadmapSnapshot), String> {
    let roadmap = db
        .get_roadmap(roadmap_id)
        .await?
        .ok_or_else(|| "未找到路线图".to_string())?;

    let db_stages = db.get_stages_by_roadmap(roadmap_id).await?;
    let mut existing = Vec::new();
    let mut snapshot_stages = Vec::new();

    for stage in db_stages {
        let tasks = db.get_tasks_by_stage(&stage.id).await?;
        let mut snapshot_tasks = Vec::new();

        for task in &tasks {
            let resources = db.get_resources_by_task(&task.id).await?;
            let snapshot_resources = resources
                .into_iter()
                .map(|r| ResourceSnapshot {
                    id: r.id,
                    title: r.title,
                    url: r.url,
                    snippet: r.snippet,
                    resource_type: r.resource_type,
                })
                .collect();

            snapshot_tasks.push(TaskSnapshot {
                id: task.id.clone(),
                order: task.order,
                title: task.title.clone(),
                content: task.content.clone(),
                points: parse_string_array(&task.points),
                prerequisites: parse_string_array(&task.prerequisites),
                task_type: task.task_type.clone(),
                example: task.example.clone(),
                is_completed: task.is_completed,
                completed_at: task.completed_at.map(|d| d.to_rfc3339()),
                resources: snapshot_resources,
            });
        }

        let is_fallback = stage
            .metadata
            .as_deref()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
            .and_then(|v| v["is_fallback"].as_bool())
            .unwrap_or(false);

        snapshot_stages.push(StageSnapshot {
            id: stage.id.clone(),
            order: stage.order,
            name: stage.name.clone(),
            objective: stage.objective.clone(),
            prerequisites: parse_string_array(&stage.prerequisites),
            estimated_hours: stage.estimated_hours,
            stage_type: stage.stage_type.clone(),
            is_fallback,
            tasks: snapshot_tasks,
        });

        existing.push(ExistingStage { stage, tasks });
    }

    let snapshot = RoadmapSnapshot {
        id: roadmap.id.clone(),
        title: roadmap.title.clone(),
        description: roadmap.description.clone(),
        estimated_total_hours: roadmap.estimated_total_hours,
        stages: snapshot_stages,
    };

    Ok((roadmap, existing, snapshot))
}

// ============ Prompt ============

fn build_optimize_prompt(
    roadmap_json: &str,
    request: &OptimizeRoadmapRequest,
    target_stage: Option<&str>,
    target_task: Option<&str>,
) -> String {
    let scope_rules = match request.scope.as_str() {
        "task" => {
            r#"- scope=task：只允许修改目标任务及其资源；其余阶段/任务必须原样返回。
- 如果目标任务应被删除，直接返回 {"deleted": true}，不要返回路线 JSON。"#
        }
        "stage" => {
            r#"- scope=stage：只允许修改目标阶段（名称/目标/前置/任务/资源）；其他阶段必须原样返回。
- 目标阶段内需要删除的任务直接从 tasks 数组中移除。"#
        }
        _ => {
            r#"- scope=roadmap：可以重排、合并、新增或删除阶段与任务。
- 需要删除的任务直接从 tasks 数组中移除；删除后同步移除其他任务 prerequisites 中对该任务标题的引用。"#
        }
    };

    let target_section = match (target_stage, target_task) {
        (Some(stage), Some(task)) => {
            format!("【目标任务】\n{task}\n\n【所属阶段】\n{stage}")
        }
        (Some(stage), None) => format!("【目标阶段】\n{stage}"),
        _ => String::new(),
    };

    format!(
        r#"根据用户反馈优化以下学习路线。

【当前路线 JSON】
{roadmap_json}

{target_section}
【用户反馈】
{feedback}

【优化范围】{scope}
{scope_rules}

【通用要求】
1. 返回与输入结构一致的完整路线 JSON（scope=task 删除时除外），不要输出解释或 Markdown 代码块。
2. 未涉及的内容（含 id、order、title、content、points、prerequisites、task_type、example、resources、is_completed、completed_at）必须保持与输入一致。
3. 已有条目的 id 尽量保持不变；新增条目不要伪造已有 id。
4. 任务类型只允许 reading/video/project；points 每项 ≤30 字、共 2-4 条；resources 2-4 个；禁止 flashcards/quiz/exercise 和长篇知识段落。
5. 阶段输出结构：{{"id","order","name","objective","prerequisites","estimated_hours","tasks"}}；任务输出结构：{{"id","order","title","content","points","prerequisites","task_type","example","video","resources"}}；资源输出结构：{{"title","url","snippet","resource_type"}}。
6. 直接返回 JSON。#"#,
        roadmap_json = roadmap_json,
        target_section = target_section,
        feedback = request.feedback,
        scope = request.scope,
        scope_rules = scope_rules,
    )
}

// ============ Parsing ============

fn parse_optimized_roadmap(raw: &str) -> Result<OptimizedRoadmap, String> {
    let cleaned = clean_json(raw);
    match serde_json::from_str::<OptimizedRoadmap>(&cleaned) {
        Ok(v) => Ok(v),
        Err(first_err) => {
            warn!("优化结果 JSON 第 1 次解析失败：{first_err}，尝试修复截断...");
            let repaired = clean_json(&crate::services::roadmap_parser::repair_truncated_json(raw));
            serde_json::from_str::<OptimizedRoadmap>(&repaired)
                .map_err(|e| format!("优化结果 JSON 解析失败：{} / {}", first_err, e))
        }
    }
}

fn indicates_deletion(raw: &str) -> bool {
    let cleaned = clean_json(raw);
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&cleaned) else {
        return false;
    };
    if v.get("deleted").and_then(|d| d.as_bool()).unwrap_or(false) {
        return true;
    }
    if v.get("action").and_then(|a| a.as_str()) == Some("delete") {
        return true;
    }
    v.get("task")
        .and_then(|t| t.get("deleted"))
        .and_then(|d| d.as_bool())
        .unwrap_or(false)
}

// ============ Matching helpers ============

fn matches_ai_stage(ai: &AiStage, stage: &Stage) -> bool {
    ai.id.as_deref() == Some(stage.id.as_str()) || ai.name.trim() == stage.name
}

fn matches_ai_task(ai: &AiTask, task: &Task) -> bool {
    ai.id.as_deref() == Some(task.id.as_str()) || ai.title.trim() == task.title
}

fn find_ai_task<'a>(stages: &'a [AiStage], current: &Task, stage_name: &str) -> Option<&'a AiTask> {
    for stage in stages {
        for task in &stage.tasks {
            if task.id.as_deref() == Some(current.id.as_str()) {
                return Some(task);
            }
        }
    }
    let stage = stages.iter().find(|s| s.name.trim() == stage_name)?;
    stage.tasks.iter().find(|t| t.title.trim() == current.title)
}

fn normalize_task_type(t: Option<&str>) -> Option<String> {
    match t.map(str::trim) {
        Some(v) if v == "reading" || v == "video" || v == "project" => Some(v.to_string()),
        _ => None,
    }
}

fn normalize_resource_type(t: Option<&str>) -> String {
    match t.map(str::trim) {
        Some(v) if !v.is_empty() => v.to_string(),
        _ => "article".to_string(),
    }
}

fn derive_stage_type(tasks: &[Task]) -> String {
    if tasks.iter().any(|t| t.task_type == "project") {
        "project".to_string()
    } else {
        "learning".to_string()
    }
}

fn build_task_for_ai(
    ai_task: &AiTask,
    idx: usize,
    stage_id: &str,
    existing: Option<&Task>,
) -> Task {
    let order = ai_task.order.unwrap_or(idx as i32 + 1);
    match existing {
        Some(t) => {
            let current_points = parse_string_array(&t.points);
            let current_prereqs = parse_string_array(&t.prerequisites);
            let mut task = t.clone();
            task.order = order;
            task.title = ai_task.title.trim().to_string();
            if let Some(content) = ai_task
                .content
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                task.content = content.to_string();
            }
            task.points = json_array_string(ai_task.points.as_deref().unwrap_or(&current_points));
            task.prerequisites =
                json_array_string(ai_task.prerequisites.as_deref().unwrap_or(&current_prereqs));
            if let Some(task_type) = normalize_task_type(ai_task.task_type.as_deref()) {
                task.task_type = task_type;
            }
            if ai_task.example.is_some() {
                task.example = ai_task.example.clone();
            }
            task
        }
        None => Task {
            id: Uuid::new_v4().to_string(),
            stage_id: stage_id.to_string(),
            order,
            title: ai_task.title.trim().to_string(),
            content: ai_task.content.clone().unwrap_or_default(),
            points: json_array_string(ai_task.points.as_deref().unwrap_or(&[])),
            prerequisites: json_array_string(ai_task.prerequisites.as_deref().unwrap_or(&[])),
            task_type: normalize_task_type(ai_task.task_type.as_deref())
                .unwrap_or_else(|| "reading".to_string()),
            example: ai_task.example.clone(),
            is_completed: false,
            completed_at: None,
        },
    }
}

// ============ DB writes ============

async fn write_task_resources(
    db: &crate::Database,
    task_id: &str,
    resources: &[AiResource],
    video: Option<&str>,
) -> Result<(), String> {
    db.delete_resources_by_task(task_id).await?;

    let mut seen: Vec<String> = Vec::new();
    for r in resources {
        let url = r.url.trim().to_string();
        if url.is_empty() || seen.contains(&url) {
            continue;
        }
        seen.push(url.clone());
        db.create_resource(&Resource {
            id: Uuid::new_v4().to_string(),
            task_id: task_id.to_string(),
            title: r.title.trim().to_string(),
            url,
            snippet: r.snippet.clone(),
            resource_type: normalize_resource_type(r.resource_type.as_deref()),
        })
        .await?;
    }

    if let Some(video_url) = video.map(str::trim).filter(|s| !s.is_empty()) {
        if !seen.iter().any(|u| u == video_url) {
            db.create_resource(&Resource {
                id: Uuid::new_v4().to_string(),
                task_id: task_id.to_string(),
                title: "视频讲解".to_string(),
                url: video_url.to_string(),
                snippet: Some("AI 推荐的视频资源".to_string()),
                resource_type: "video".to_string(),
            })
            .await?;
        }
    }

    Ok(())
}

async fn strip_task_titles(
    db: &crate::Database,
    roadmap_id: &str,
    titles: &[String],
) -> Result<(), String> {
    if titles.is_empty() {
        return Ok(());
    }
    let stages = db.get_stages_by_roadmap(roadmap_id).await?;
    for stage in stages {
        let tasks = db.get_tasks_by_stage(&stage.id).await?;
        for task in tasks {
            let prereqs = parse_string_array(&task.prerequisites);
            let filtered: Vec<String> = prereqs
                .iter()
                .filter(|p| !titles.contains(p))
                .cloned()
                .collect();
            if filtered.len() != prereqs.len() {
                let mut updated = task.clone();
                updated.prerequisites = json_array_string(&filtered);
                db.upsert_task(&updated).await?;
            }
        }
    }
    Ok(())
}

async fn strip_stage_titles(
    db: &crate::Database,
    roadmap_id: &str,
    titles: &[String],
) -> Result<(), String> {
    if titles.is_empty() {
        return Ok(());
    }
    let stages = db.get_stages_by_roadmap(roadmap_id).await?;
    for stage in stages {
        let prereqs = parse_string_array(&stage.prerequisites);
        let filtered: Vec<String> = prereqs
            .iter()
            .filter(|p| !titles.contains(p))
            .cloned()
            .collect();
        if filtered.len() != prereqs.len() {
            let mut updated = stage.clone();
            updated.prerequisites = json_array_string(&filtered);
            db.update_stage(&updated).await?;
        }
    }
    Ok(())
}

async fn recompute_stage_type(db: &crate::Database, stage_id: &str) -> Result<(), String> {
    let stage = db
        .get_stage_by_id(stage_id)
        .await?
        .ok_or_else(|| "未找到阶段".to_string())?;
    let tasks = db.get_tasks_by_stage(stage_id).await?;
    let stage_type = derive_stage_type(&tasks);
    if stage.stage_type != stage_type {
        let mut updated = stage;
        updated.stage_type = stage_type;
        db.update_stage(&updated).await?;
    }
    Ok(())
}

async fn delete_task_with_cleanup(
    db: &crate::Database,
    roadmap_id: &str,
    task: &Task,
) -> Result<(), String> {
    db.delete_task_complete(&task.id).await?;
    strip_task_titles(db, roadmap_id, &[task.title.clone()]).await?;
    recompute_stage_type(db, &task.stage_id).await?;
    Ok(())
}

// ============ Scope application ============

async fn apply_task_scope(
    db: &crate::Database,
    request: &OptimizeRoadmapRequest,
    existing: &[ExistingStage],
    ai: &OptimizedRoadmap,
) -> Result<(), String> {
    let task_id = request
        .task_id
        .as_deref()
        .ok_or_else(|| "task 范围优化需要 task_id".to_string())?;
    let current = db
        .get_task_by_id(task_id)
        .await?
        .ok_or_else(|| "未找到目标任务".to_string())?;
    let stage_name = existing
        .iter()
        .find(|s| s.stage.id == current.stage_id)
        .map(|s| s.stage.name.clone())
        .unwrap_or_default();

    let ai_task = find_ai_task(&ai.stages, &current, &stage_name);
    match ai_task {
        Some(t) if t.deleted.unwrap_or(false) => {
            delete_task_with_cleanup(db, &request.roadmap_id, &current).await?;
        }
        Some(t) => {
            let current_points = parse_string_array(&current.points);
            let current_prereqs = parse_string_array(&current.prerequisites);
            let mut updated = current.clone();
            updated.order = t.order.unwrap_or(current.order);
            updated.title = t.title.trim().to_string();
            if let Some(content) = t
                .content
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                updated.content = content.to_string();
            }
            updated.points = json_array_string(t.points.as_deref().unwrap_or(&current_points));
            updated.prerequisites =
                json_array_string(t.prerequisites.as_deref().unwrap_or(&current_prereqs));
            if let Some(task_type) = normalize_task_type(t.task_type.as_deref()) {
                updated.task_type = task_type;
            }
            if t.example.is_some() {
                updated.example = t.example.clone();
            }
            db.upsert_task(&updated).await?;
            write_task_resources(db, &updated.id, &t.resources, t.video.as_deref()).await?;
            recompute_stage_type(db, &updated.stage_id).await?;
        }
        None => {
            delete_task_with_cleanup(db, &request.roadmap_id, &current).await?;
        }
    }
    Ok(())
}

async fn apply_stage_scope(
    db: &crate::Database,
    request: &OptimizeRoadmapRequest,
    existing: &[ExistingStage],
    ai: &OptimizedRoadmap,
) -> Result<(), String> {
    let stage_id = request
        .stage_id
        .as_deref()
        .ok_or_else(|| "stage 范围优化需要 stage_id".to_string())?;
    let current = existing
        .iter()
        .find(|s| s.stage.id == stage_id)
        .ok_or_else(|| "未找到目标阶段".to_string())?;
    let ai_stage = ai
        .stages
        .iter()
        .find(|s| matches_ai_stage(s, &current.stage))
        .ok_or_else(|| "AI 未返回目标阶段，请重试".to_string())?;

    let mut stage = current.stage.clone();
    stage.name = ai_stage.name.trim().to_string();
    if let Some(objective) = ai_stage
        .objective
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        stage.objective = objective.to_string();
    }
    stage.prerequisites = json_array_string(ai_stage.prerequisites.as_deref().unwrap_or(&[]));
    if let Some(hours) = ai_stage.estimated_hours {
        if hours > 0.0 {
            stage.estimated_hours = hours;
        }
    }
    stage.metadata = None;

    let mut retained_tasks = Vec::new();
    let mut removed_titles = Vec::new();

    for (idx, ai_task) in ai_stage.tasks.iter().enumerate() {
        if ai_task.deleted.unwrap_or(false) {
            continue;
        }
        let existing_task = current.tasks.iter().find(|t| matches_ai_task(ai_task, t));
        let task = build_task_for_ai(ai_task, idx, &stage.id, existing_task);
        db.upsert_task(&task).await?;
        write_task_resources(db, &task.id, &ai_task.resources, ai_task.video.as_deref()).await?;
        retained_tasks.push(task);
    }

    for existing_task in &current.tasks {
        if !retained_tasks.iter().any(|t| t.id == existing_task.id) {
            removed_titles.push(existing_task.title.clone());
            db.delete_task_complete(&existing_task.id).await?;
        }
    }
    if !removed_titles.is_empty() {
        strip_task_titles(db, &request.roadmap_id, &removed_titles).await?;
    }

    stage.stage_type = derive_stage_type(&retained_tasks);
    db.update_stage(&stage).await?;
    Ok(())
}

async fn apply_roadmap_scope(
    db: &crate::Database,
    request: &OptimizeRoadmapRequest,
    existing: &[ExistingStage],
    ai: &OptimizedRoadmap,
    roadmap: &Roadmap,
) -> Result<(), String> {
    let mut removed_stage_titles = Vec::new();
    let mut removed_task_titles = Vec::new();
    let mut new_stages = Vec::new();

    for (idx, ai_stage) in ai.stages.iter().enumerate() {
        let order = ai_stage.order.unwrap_or(idx as i32 + 1);
        let existing_stage = existing
            .iter()
            .find(|s| matches_ai_stage(ai_stage, &s.stage));

        let (mut stage, existing_tasks) = match existing_stage {
            Some(es) => {
                let mut st = es.stage.clone();
                st.order = order;
                st.name = ai_stage.name.trim().to_string();
                if let Some(objective) = ai_stage
                    .objective
                    .as_deref()
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                {
                    st.objective = objective.to_string();
                }
                st.prerequisites =
                    json_array_string(ai_stage.prerequisites.as_deref().unwrap_or(&[]));
                if let Some(hours) = ai_stage.estimated_hours {
                    if hours > 0.0 {
                        st.estimated_hours = hours;
                    }
                }
                st.metadata = None;
                (st, es.tasks.clone())
            }
            None => (
                Stage {
                    id: Uuid::new_v4().to_string(),
                    roadmap_id: request.roadmap_id.clone(),
                    order,
                    name: ai_stage.name.trim().to_string(),
                    objective: ai_stage.objective.clone().unwrap_or_default(),
                    estimated_hours: ai_stage.estimated_hours.unwrap_or(4.0),
                    stage_type: "learning".to_string(),
                    prerequisites: json_array_string(
                        ai_stage.prerequisites.as_deref().unwrap_or(&[]),
                    ),
                    metadata: None,
                },
                Vec::new(),
            ),
        };

        let mut retained_tasks = Vec::new();
        for (task_idx, ai_task) in ai_stage.tasks.iter().enumerate() {
            if ai_task.deleted.unwrap_or(false) {
                continue;
            }
            let existing_task = existing_tasks.iter().find(|t| matches_ai_task(ai_task, t));
            let task = build_task_for_ai(ai_task, task_idx, &stage.id, existing_task);
            db.upsert_task(&task).await?;
            write_task_resources(db, &task.id, &ai_task.resources, ai_task.video.as_deref())
                .await?;
            retained_tasks.push(task);
        }

        for existing_task in &existing_tasks {
            if !retained_tasks.iter().any(|t| t.id == existing_task.id) {
                removed_task_titles.push(existing_task.title.clone());
                db.delete_task_complete(&existing_task.id).await?;
            }
        }

        stage.stage_type = derive_stage_type(&retained_tasks);
        if existing_stage.is_some() {
            db.update_stage(&stage).await?;
        } else {
            db.create_stage(&stage).await?;
        }
        new_stages.push(stage);
    }

    for es in existing {
        if !new_stages.iter().any(|s| s.id == es.stage.id) {
            removed_stage_titles.push(es.stage.name.clone());
            for task in &es.tasks {
                removed_task_titles.push(task.title.clone());
            }
            db.delete_stage_complete(&es.stage.id).await?;
        }
    }

    if !removed_task_titles.is_empty() {
        strip_task_titles(db, &request.roadmap_id, &removed_task_titles).await?;
    }
    if !removed_stage_titles.is_empty() {
        strip_stage_titles(db, &request.roadmap_id, &removed_stage_titles).await?;
    }

    let title = ai
        .title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| roadmap.title.as_str())
        .to_string();
    let description = ai
        .description
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| roadmap.description.as_str())
        .to_string();
    let estimated_total_hours = ai
        .estimated_total_hours
        .unwrap_or(roadmap.estimated_total_hours);
    db.update_roadmap_basic(
        &request.roadmap_id,
        &title,
        &description,
        estimated_total_hours,
    )
    .await?;

    Ok(())
}

// ============ Command ============

#[tauri::command]
pub async fn optimize_roadmap(
    state: State<'_, AppState>,
    request: OptimizeRoadmapRequest,
) -> Result<RoadmapResponse, String> {
    info!(
        "optimize_roadmap scope={} roadmap_id={} feedback_len={}",
        request.scope,
        request.roadmap_id,
        request.feedback.len()
    );

    if !matches!(request.scope.as_str(), "roadmap" | "stage" | "task") {
        return Err(format!("非法的优化范围: {}", request.scope));
    }
    if request.feedback.trim().is_empty() {
        return Err("请提供具体的优化反馈".to_string());
    }

    let conn = resolve_ai_connection(&state).await?;
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败：{}", e))?;

    let (roadmap, existing, snapshot) = {
        let db = state.db.lock().await;
        load_roadmap(&db, &request.roadmap_id).await?
    };

    let target_stage_json = if request.scope == "stage" || request.scope == "task" {
        let stage_id = request
            .stage_id
            .as_deref()
            .ok_or_else(|| format!("{} 范围优化需要 stage_id", request.scope))?;
        if !existing.iter().any(|s| s.stage.id == stage_id) {
            return Err("未找到目标阶段".to_string());
        }
        let stage_snapshot = snapshot
            .stages
            .iter()
            .find(|s| s.id == stage_id)
            .ok_or_else(|| "未找到目标阶段快照".to_string())?;
        Some(
            serde_json::to_string_pretty(stage_snapshot)
                .map_err(|e| format!("序列化目标阶段失败：{}", e))?,
        )
    } else {
        None
    };

    let target_task_json = if request.scope == "task" {
        let task_id = request
            .task_id
            .as_deref()
            .ok_or_else(|| "task 范围优化需要 task_id".to_string())?;
        if !existing
            .iter()
            .any(|s| s.tasks.iter().any(|t| t.id == task_id))
        {
            return Err("未找到目标任务".to_string());
        }
        let task_snapshot = snapshot
            .stages
            .iter()
            .flat_map(|s| &s.tasks)
            .find(|t| t.id == task_id)
            .ok_or_else(|| "未找到目标任务快照".to_string())?;
        Some(
            serde_json::to_string_pretty(task_snapshot)
                .map_err(|e| format!("序列化目标任务失败：{}", e))?,
        )
    } else {
        None
    };

    let roadmap_json =
        serde_json::to_string_pretty(&snapshot).map_err(|e| format!("序列化路线失败：{}", e))?;
    let prompt = build_optimize_prompt(
        &roadmap_json,
        &request,
        target_stage_json.as_deref(),
        target_task_json.as_deref(),
    );

    let raw = call_ai_with_retry(
        &client,
        &conn.provider_type,
        &conn.base_url,
        &conn.model,
        &conn.api_key,
        "你是学习路线优化专家。严格按 JSON 返回，不要输出任何解释、思考或 Markdown 代码块。",
        &prompt,
        8000,
    )
    .await
    .map_err(|e| format!("优化调用失败：{}", e))?;

    if request.scope == "task" && indicates_deletion(&raw) {
        let db = state.db.lock().await;
        let task_id = request
            .task_id
            .as_deref()
            .ok_or_else(|| "task 范围优化需要 task_id".to_string())?;
        let task = db
            .get_task_by_id(task_id)
            .await?
            .ok_or_else(|| "未找到目标任务".to_string())?;
        delete_task_with_cleanup(&db, &request.roadmap_id, &task).await?;
        return build_roadmap_response(&db, &request.roadmap_id).await;
    }

    let ai = parse_optimized_roadmap(&raw)?;
    let db = state.db.lock().await;
    match request.scope.as_str() {
        "task" => apply_task_scope(&db, &request, &existing, &ai).await?,
        "stage" => apply_stage_scope(&db, &request, &existing, &ai).await?,
        _ => apply_roadmap_scope(&db, &request, &existing, &ai, &roadmap).await?,
    }
    build_roadmap_response(&db, &request.roadmap_id).await
}
