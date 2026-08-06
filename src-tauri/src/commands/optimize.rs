use crate::commands::roadmap::{build_roadmap_response, call_ai_with_retry};
use crate::models::{Resource, Roadmap, RoadmapResponse, Stage, Task};
use crate::services::parallel::{json_array_string, parse_string_array};
use crate::services::roadmap_parser::clean_json;
use crate::services::tavily;
use crate::AppState;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::sync::Arc;
use tauri::State;
use tracing::info;
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

struct TavilyEnricher {
    key: Option<String>,
    client: Option<Client>,
}

impl TavilyEnricher {
    fn empty() -> Self {
        Self {
            key: None,
            client: None,
        }
    }
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

impl TaskSnapshot {
    fn compact_json(&self) -> Value {
        let clip = |s: &str, max: usize| {
            if s.chars().count() > max {
                let head: String = s.chars().take(max).collect();
                format!("{head}…")
            } else {
                s.to_string()
            }
        };
        serde_json::json!({
            "id": self.id,
            "order": self.order,
            "title": self.title,
            "content_preview": clip(&self.content, 300),
            "points": self.points,
            "prerequisites": self.prerequisites,
            "task_type": self.task_type,
            "example_preview": self.example.as_deref().map(|e| clip(e, 150)),
            "is_completed": self.is_completed,
            "resources": self.resources,
        })
    }
}

#[derive(Debug, Serialize)]
struct ResourceSnapshot {
    id: String,
    title: String,
    url: String,
    snippet: Option<String>,
    resource_type: String,
}

impl StageSnapshot {
    fn compact_json(&self) -> Value {
        serde_json::json!({
            "id": self.id,
            "order": self.order,
            "name": self.name,
            "objective": self.objective,
            "prerequisites": self.prerequisites,
            "estimated_hours": self.estimated_hours,
            "stage_type": self.stage_type,
            "is_fallback": self.is_fallback,
            "tasks": self.tasks.iter().map(|t| t.compact_json()).collect::<Vec<_>>(),
        })
    }
}

struct ExistingStage {
    stage: Stage,
    tasks: Vec<Task>,
}

// ============ AI response types ============

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
    resources: Option<Vec<AiResource>>,
}

#[derive(Debug, Deserialize)]
struct AiStage {
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

#[derive(Debug, Clone, Deserialize)]
struct AiResource {
    title: String,
    #[serde(default)]
    url: String,
    #[serde(default)]
    snippet: Option<String>,
    #[serde(default)]
    resource_type: Option<String>,
}

/// 整路线优化的操作计划：只描述变化，不重放未修改内容。
#[derive(Debug, Deserialize)]
struct OptimizePlan {
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    estimated_total_hours: Option<f64>,
    #[serde(default)]
    stage_orders: Vec<String>,
    #[serde(default)]
    stage_updates: Vec<PlanStageUpdate>,
    #[serde(default)]
    new_stages: Vec<PlanNewStage>,
    #[serde(default)]
    deleted_stage_ids: Vec<String>,
    #[serde(default)]
    task_updates: Vec<PlanTaskUpdate>,
    #[serde(default)]
    new_tasks: Vec<PlanNewTask>,
    #[serde(default)]
    task_moves: Vec<PlanTaskMove>,
    #[serde(default)]
    deleted_task_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct PlanStageUpdate {
    id: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    objective: Option<String>,
    #[serde(default)]
    prerequisites: Option<Vec<String>>,
    #[serde(default)]
    estimated_hours: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct PlanNewStage {
    id: String,
    order: i32,
    name: String,
    #[serde(default)]
    objective: Option<String>,
    #[serde(default)]
    prerequisites: Option<Vec<String>>,
    #[serde(default)]
    estimated_hours: Option<f64>,
    #[serde(default)]
    tasks: Vec<PlanNewTask>,
}

#[derive(Debug, Deserialize)]
struct PlanTaskUpdate {
    id: String,
    #[serde(default)]
    order: Option<i32>,
    #[serde(default)]
    title: Option<String>,
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
    resources: Option<Vec<AiResource>>,
}

#[derive(Debug, Deserialize)]
struct PlanNewTask {
    #[serde(default)]
    stage_id: Option<String>,
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
    resources: Vec<AiResource>,
}

#[derive(Debug, Deserialize)]
struct PlanTaskMove {
    id: String,
    stage_id: String,
    #[serde(default)]
    order: Option<i32>,
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
    new_stage_ids: &[String],
) -> String {
    let scope_rules = match request.scope.as_str() {
        "task" => {
            r#"- scope=task：只返回目标任务这一个对象，不要返回阶段、路线或任何未修改的内容。
- 如果目标任务应被删除，直接返回 {"deleted": true}。"#
        }
        "stage" => {
            r#"- scope=stage：只返回目标阶段这一个对象，不要返回其他阶段或路线。
- 目标阶段内需要删除的任务直接从 tasks 数组中移除。"#
        }
        _ => {
            r#"- scope=roadmap：只返回操作计划，不要重放整条路线，不得把未修改的内容原样拷贝进输出。
- 需要删除的任务放入 deleted_task_ids；需要删除的阶段放入 deleted_stage_ids。
- 移动任务到另一阶段（含合并/拆分阶段）用 task_moves；移动后原阶段为空时再删除该阶段。"#
        }
    };

    let target_section = match (target_stage, target_task) {
        (Some(stage), Some(task)) => {
            format!("【目标任务】\n{task}\n\n【阶段上下文】\n{stage}")
        }
        (Some(stage), None) => format!("【目标阶段】\n{stage}"),
        _ => String::new(),
    };

    let new_stage_ids_text = if new_stage_ids.is_empty() {
        "（本次不新增阶段，不要输出 new_stages）".to_string()
    } else {
        format!(
            "可用的新阶段 ID（新增阶段必须使用）：{}",
            new_stage_ids.join(", ")
        )
    };

    let response_format = if request.scope == "task" {
        r#"【输出 JSON（严格）】
一个任务对象：
{"id":"原任务ID","order":1,"title":"...","content":"...","points":[...],"prerequisites":[...],"task_type":"reading|video|project","example":"...","video":"...","resources":[{"title":"...","url":"...","snippet":"...","resource_type":"..."}]}
若删除：{"deleted":true}"#
    } else if request.scope == "stage" {
        r#"【输出 JSON（严格）】
一个阶段对象：
{"id":"原阶段ID","order":1,"name":"...","objective":"...","prerequisites":[...],"estimated_hours":12.0,"tasks":[
  {"id":"原任务ID或留空","order":1,"title":"...","content":"...","points":[...],"prerequisites":[...],"task_type":"reading|video|project","example":"...","video":"...","resources":[...]}
]}"#
    } else {
        r#"【输出 JSON（严格，操作计划）】
{
  "title": "可选的路线标题（不变则省略）",
  "description": "可选的路线描述（不变则省略）",
  "estimated_total_hours": 120.0,
  "stage_orders": ["阶段ID按新顺序排列"],
  "stage_updates": [{"id":"阶段ID","name":"...","objective":"...","prerequisites":[...],"estimated_hours":8.0}],
  "new_stages": [{"id":"new-stage-1","order":3,"name":"...","objective":"...","prerequisites":[...],"estimated_hours":10.0,"tasks":[{"order":1,"title":"...","content":"...","points":[...],"prerequisites":[...],"task_type":"reading|video|project","example":"...","video":"...","resources":[...]}]}],
  "deleted_stage_ids": ["阶段ID"],
  "task_updates": [{"id":"任务ID","order":1,"title":"...","content":"...","points":[...],"prerequisites":[...],"task_type":"...","example":"...","video":"...","resources":[...]}],
  "new_tasks": [{"stage_id":"阶段ID或new-stage-1","order":2,"title":"...","content":"...","points":[...],"prerequisites":[...],"task_type":"...","example":"...","video":"...","resources":[...]}],
  "task_moves": [{"id":"任务ID","stage_id":"目标阶段ID或new-stage-1","order":2}],
  "deleted_task_ids": ["任务ID"]
}
字段不改动就省略；resources 省略表示保留原资源，填 [] 表示清空。"#
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

【新阶段 ID】
{new_stage_ids_text}

【通用要求】
1. {response_format}
2. 不要输出解释、思考或 Markdown 代码块，直接返回 JSON。
3. 任务类型只允许 reading/video/project；points 每项 ≤30 字、共 2-4 条；resources 2-4 个；禁止 flashcards/quiz/exercise 和长篇知识段落。
4. 已有条目的 id 必须保持不变；新增条目不写 id（由后端生成），新增阶段必须使用上面给出的 new-stage ID。
5. 未修改的内容不要出现在输出里，控制输出体积；无法在合理篇幅内完成的修改可以省略，保持原样。"#,
        roadmap_json = roadmap_json,
        target_section = target_section,
        feedback = request.feedback,
        scope = request.scope,
        scope_rules = scope_rules,
        new_stage_ids_text = new_stage_ids_text,
        response_format = response_format,
    )
}

// ============ Parsing ============

fn normalize_required_string(obj: &mut Map<String, Value>, key: &str) -> String {
    match obj.get_mut(key) {
        Some(Value::String(value)) => {
            let normalized = value.trim().to_string();
            *value = normalized.clone();
            normalized
        }
        _ => {
            obj.insert(key.to_string(), Value::String(String::new()));
            String::new()
        }
    }
}

fn drop_if_wrong_string(obj: &mut Map<String, Value>, key: &str) {
    if obj.contains_key(key) && !matches!(obj.get(key), Some(Value::String(_))) {
        obj.remove(key);
    }
}

fn drop_if_wrong_number(obj: &mut Map<String, Value>, key: &str) {
    if obj.contains_key(key) && !matches!(obj.get(key), Some(Value::Number(_))) {
        obj.remove(key);
    }
}

fn drop_if_wrong_array(obj: &mut Map<String, Value>, key: &str) {
    if obj.contains_key(key) && !matches!(obj.get(key), Some(Value::Array(_))) {
        obj.remove(key);
    }
}

fn drop_if_wrong_bool(obj: &mut Map<String, Value>, key: &str) {
    if obj.contains_key(key) && !matches!(obj.get(key), Some(Value::Bool(_))) {
        obj.remove(key);
    }
}

fn sanitize_resource(value: &mut Value) -> bool {
    let Some(obj) = value.as_object_mut() else {
        return false;
    };
    if normalize_required_string(obj, "title").is_empty() {
        return false;
    }
    drop_if_wrong_string(obj, "url");
    drop_if_wrong_string(obj, "snippet");
    drop_if_wrong_string(obj, "resource_type");
    true
}

fn sanitize_task(value: &mut Value) -> bool {
    let Some(obj) = value.as_object_mut() else {
        return false;
    };
    if normalize_required_string(obj, "title").is_empty() {
        return false;
    }
    drop_if_wrong_string(obj, "id");
    drop_if_wrong_number(obj, "order");
    drop_if_wrong_string(obj, "content");
    drop_if_wrong_array(obj, "points");
    drop_if_wrong_array(obj, "prerequisites");
    drop_if_wrong_string(obj, "task_type");
    drop_if_wrong_string(obj, "example");
    drop_if_wrong_string(obj, "video");
    drop_if_wrong_bool(obj, "deleted");
    match obj.get_mut("resources") {
        Some(Value::Array(resources)) => {
            resources.retain_mut(sanitize_resource);
        }
        Some(_) => {
            obj.remove("resources");
        }
        None => {}
    }
    true
}

fn sanitize_stage(value: &mut Value) -> bool {
    let Some(obj) = value.as_object_mut() else {
        return false;
    };
    if normalize_required_string(obj, "name").is_empty() {
        return false;
    }
    drop_if_wrong_string(obj, "id");
    drop_if_wrong_number(obj, "order");
    drop_if_wrong_string(obj, "objective");
    drop_if_wrong_array(obj, "prerequisites");
    drop_if_wrong_number(obj, "estimated_hours");
    match obj.get_mut("tasks") {
        Some(Value::Array(tasks)) => {
            tasks.retain_mut(sanitize_task);
        }
        Some(_) => {
            obj.remove("tasks");
        }
        None => {}
    }
    true
}

fn sanitize_optimized_task(value: &mut Value) -> bool {
    let Some(obj) = value.as_object_mut() else {
        return false;
    };
    if obj
        .get("deleted")
        .and_then(|d| d.as_bool())
        .unwrap_or(false)
    {
        return true;
    }
    sanitize_task(value)
}

fn sanitize_optimized_stage(value: &mut Value) -> bool {
    let Some(obj) = value.as_object_mut() else {
        return false;
    };
    if obj
        .get("deleted")
        .and_then(|d| d.as_bool())
        .unwrap_or(false)
    {
        return false;
    }
    sanitize_stage(value)
}

fn sanitize_plan_task(value: &mut Value) -> bool {
    sanitize_task(value)
}

fn sanitize_plan_stage(value: &mut Value) -> bool {
    let Some(obj) = value.as_object_mut() else {
        return false;
    };
    if normalize_required_string(obj, "id").is_empty() {
        return false;
    }
    if !matches!(obj.get("order"), Some(Value::Number(_))) {
        return false;
    }
    if normalize_required_string(obj, "name").is_empty() {
        return false;
    }
    drop_if_wrong_string(obj, "objective");
    drop_if_wrong_array(obj, "prerequisites");
    drop_if_wrong_number(obj, "estimated_hours");
    match obj.get_mut("tasks") {
        Some(Value::Array(tasks)) => {
            tasks.retain_mut(sanitize_plan_task);
        }
        Some(_) => {
            obj.remove("tasks");
        }
        None => {}
    }
    true
}

fn sanitize_plan_update(value: &mut Value) -> bool {
    let Some(obj) = value.as_object_mut() else {
        return false;
    };
    if normalize_required_string(obj, "id").is_empty() {
        return false;
    }
    drop_if_wrong_string(obj, "name");
    drop_if_wrong_string(obj, "objective");
    drop_if_wrong_array(obj, "prerequisites");
    drop_if_wrong_number(obj, "estimated_hours");
    true
}

fn sanitize_plan_task_update(value: &mut Value) -> bool {
    let Some(obj) = value.as_object_mut() else {
        return false;
    };
    if normalize_required_string(obj, "id").is_empty() {
        return false;
    }
    drop_if_wrong_number(obj, "order");
    drop_if_wrong_string(obj, "title");
    drop_if_wrong_string(obj, "content");
    drop_if_wrong_array(obj, "points");
    drop_if_wrong_array(obj, "prerequisites");
    drop_if_wrong_string(obj, "task_type");
    drop_if_wrong_string(obj, "example");
    drop_if_wrong_string(obj, "video");
    match obj.get_mut("resources") {
        Some(Value::Array(resources)) => {
            resources.retain_mut(sanitize_resource);
        }
        _ => {
            // 省略 resources 表示保留原资源；只有显式给出数组才替换。
            obj.remove("resources");
        }
    }
    true
}

fn sanitize_plan_move(value: &mut Value) -> bool {
    let Some(obj) = value.as_object_mut() else {
        return false;
    };
    if normalize_required_string(obj, "id").is_empty()
        || normalize_required_string(obj, "stage_id").is_empty()
    {
        return false;
    }
    drop_if_wrong_number(obj, "order");
    true
}

fn sanitize_plan(value: Value) -> Value {
    let Some(mut obj) = value.as_object().cloned() else {
        return serde_json::json!({});
    };
    drop_if_wrong_string(&mut obj, "title");
    drop_if_wrong_string(&mut obj, "description");
    drop_if_wrong_number(&mut obj, "estimated_total_hours");
    for key in [
        "stage_orders",
        "stage_updates",
        "new_stages",
        "deleted_stage_ids",
        "task_updates",
        "new_tasks",
        "task_moves",
        "deleted_task_ids",
    ] {
        drop_if_wrong_array(&mut obj, key);
    }
    if let Some(Value::Array(stages)) = obj.get_mut("stage_orders") {
        stages.retain(|v| v.as_str().is_some());
    }
    if let Some(Value::Array(updates)) = obj.get_mut("stage_updates") {
        updates.retain_mut(sanitize_plan_update);
    }
    if let Some(Value::Array(stages)) = obj.get_mut("new_stages") {
        stages.retain_mut(sanitize_plan_stage);
    }
    if let Some(Value::Array(ids)) = obj.get_mut("deleted_stage_ids") {
        ids.retain(|v| v.as_str().is_some());
    }
    if let Some(Value::Array(updates)) = obj.get_mut("task_updates") {
        updates.retain_mut(sanitize_plan_task_update);
    }
    if let Some(Value::Array(tasks)) = obj.get_mut("new_tasks") {
        tasks.retain_mut(sanitize_plan_task);
    }
    if let Some(Value::Array(moves)) = obj.get_mut("task_moves") {
        moves.retain_mut(sanitize_plan_move);
    }
    if let Some(Value::Array(ids)) = obj.get_mut("deleted_task_ids") {
        ids.retain(|v| v.as_str().is_some());
    }
    Value::Object(obj)
}

fn parse_optimized_task(raw: &str) -> Result<AiTask, String> {
    let cleaned = clean_json(raw);
    let value: Value =
        serde_json::from_str(&cleaned).map_err(|e| format!("优化结果 JSON 解析失败：{}", e))?;
    let mut value = value;
    if !sanitize_optimized_task(&mut value) {
        return Err("优化结果不是有效的任务对象".to_string());
    }
    serde_json::from_value(value).map_err(|e| format!("优化结果结构解析失败：{}", e))
}

fn parse_optimized_stage(raw: &str) -> Result<AiStage, String> {
    let cleaned = clean_json(raw);
    let value: Value =
        serde_json::from_str(&cleaned).map_err(|e| format!("优化结果 JSON 解析失败：{}", e))?;
    let mut value = value;
    if !sanitize_optimized_stage(&mut value) {
        return Err("优化结果不是有效的阶段对象".to_string());
    }
    serde_json::from_value(value).map_err(|e| format!("优化结果结构解析失败：{}", e))
}

fn parse_optimize_plan(raw: &str) -> Result<OptimizePlan, String> {
    let cleaned = clean_json(raw);
    let value: Value =
        serde_json::from_str(&cleaned).map_err(|e| format!("优化结果 JSON 解析失败：{}", e))?;
    let sanitized = sanitize_plan(value);
    serde_json::from_value(sanitized).map_err(|e| format!("优化结果结构解析失败：{}", e))
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

fn matches_ai_task(ai: &AiTask, task: &Task) -> bool {
    ai.id.as_deref() == Some(task.id.as_str()) || ai.title.trim() == task.title
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

async fn load_existing_resources(
    db: &crate::Database,
    task_id: &str,
) -> Result<Vec<AiResource>, String> {
    let resources = db.get_resources_by_task(task_id).await?;
    Ok(resources
        .into_iter()
        .map(|r| AiResource {
            title: r.title,
            url: r.url,
            snippet: r.snippet,
            resource_type: Some(r.resource_type),
        })
        .collect())
}

async fn apply_task_resources(
    db: &crate::Database,
    task_id: &str,
    resources: Option<&[AiResource]>,
    video: Option<&str>,
) -> Result<(), String> {
    match resources {
        Some(resources) => write_task_resources(db, task_id, resources, video).await,
        None => {
            let video = video.map(str::trim).filter(|s| !s.is_empty());
            match video {
                Some(video) => {
                    let existing = load_existing_resources(db, task_id).await?;
                    write_task_resources(db, task_id, &existing, Some(video)).await
                }
                None => Ok(()),
            }
        }
    }
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
    ai: &AiTask,
    enricher: &TavilyEnricher,
    enriched_tasks: &mut Vec<String>,
) -> Result<(), String> {
    let task_id = request
        .task_id
        .as_deref()
        .ok_or_else(|| "task 范围优化需要 task_id".to_string())?;
    let current = db
        .get_task_by_id(task_id)
        .await?
        .ok_or_else(|| "未找到目标任务".to_string())?;
    let current_points = parse_string_array(&current.points);
    let current_prereqs = parse_string_array(&current.prerequisites);
    let mut updated = current.clone();
    updated.order = ai.order.unwrap_or(current.order);
    updated.title = ai.title.trim().to_string();
    if let Some(content) = ai
        .content
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        updated.content = content.to_string();
    }
    updated.points = json_array_string(ai.points.as_deref().unwrap_or(&current_points));
    updated.prerequisites =
        json_array_string(ai.prerequisites.as_deref().unwrap_or(&current_prereqs));
    if let Some(task_type) = normalize_task_type(ai.task_type.as_deref()) {
        updated.task_type = task_type;
    }
    if ai.example.is_some() {
        updated.example = ai.example.clone();
    }
    db.upsert_task(&updated).await?;
    apply_task_resources(
        db,
        &updated.id,
        ai.resources.as_deref(),
        ai.video.as_deref(),
    )
    .await?;
    if ai.resources.is_some() && enricher.key.is_some() {
        enriched_tasks.push(updated.id.clone());
    }
    recompute_stage_type(db, &updated.stage_id).await?;
    Ok(())
}

async fn apply_stage_scope(
    db: &crate::Database,
    request: &OptimizeRoadmapRequest,
    ai: &AiStage,
    enricher: &TavilyEnricher,
    enriched_tasks: &mut Vec<String>,
) -> Result<(), String> {
    let stage_id = request
        .stage_id
        .as_deref()
        .ok_or_else(|| "stage 范围优化需要 stage_id".to_string())?;
    let current_stage = db
        .get_stage_by_id(stage_id)
        .await?
        .ok_or_else(|| "未找到目标阶段".to_string())?;
    let current_tasks = db.get_tasks_by_stage(stage_id).await?;

    let mut stage = current_stage.clone();
    stage.name = ai.name.trim().to_string();
    if let Some(objective) = ai
        .objective
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        stage.objective = objective.to_string();
    }
    stage.prerequisites = json_array_string(ai.prerequisites.as_deref().unwrap_or(&[]));
    if let Some(hours) = ai.estimated_hours {
        if hours > 0.0 {
            stage.estimated_hours = hours;
        }
    }
    stage.metadata = None;

    let mut retained_tasks = Vec::new();
    let mut removed_titles = Vec::new();

    for (idx, ai_task) in ai.tasks.iter().enumerate() {
        if ai_task.deleted.unwrap_or(false) {
            continue;
        }
        let existing_task = current_tasks.iter().find(|t| matches_ai_task(ai_task, t));
        let task = build_task_for_ai(ai_task, idx, &stage.id, existing_task);
        db.upsert_task(&task).await?;
        apply_task_resources(
            db,
            &task.id,
            ai_task.resources.as_deref(),
            ai_task.video.as_deref(),
        )
        .await?;
        if ai_task.resources.is_some() && enricher.key.is_some() {
            enriched_tasks.push(task.id.clone());
        }
        retained_tasks.push(task);
    }

    for existing_task in &current_tasks {
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
    ai: &OptimizePlan,
    roadmap: &Roadmap,
    enricher: &TavilyEnricher,
    enriched_tasks: &mut Vec<String>,
) -> Result<(), String> {
    let all_stage_ids: std::collections::HashSet<&str> =
        existing.iter().map(|s| s.stage.id.as_str()).collect();
    let all_task_ids: std::collections::HashSet<&str> = existing
        .iter()
        .flat_map(|s| s.tasks.iter())
        .map(|t| t.id.as_str())
        .collect();
    let new_stage_ids: Vec<String> = ai.new_stages.iter().map(|s| s.id.clone()).collect();

    for id in &ai.deleted_stage_ids {
        if !all_stage_ids.contains(id.as_str()) {
            return Err(format!("操作计划引用了不存在的阶段 ID：{id}"));
        }
    }
    for id in &new_stage_ids {
        if all_stage_ids.contains(id.as_str()) {
            return Err(format!("新增阶段 ID 与已有阶段冲突：{id}"));
        }
    }
    for id in ai
        .task_updates
        .iter()
        .map(|u| u.id.as_str())
        .chain(ai.task_moves.iter().map(|m| m.id.as_str()))
        .chain(ai.deleted_task_ids.iter().map(|s| s.as_str()))
    {
        if !all_task_ids.contains(id) {
            return Err(format!("操作计划引用了不存在的任务 ID：{id}"));
        }
    }

    let mut stage_id_to_db: std::collections::HashMap<String, String> = existing
        .iter()
        .map(|s| (s.stage.id.clone(), s.stage.id.clone()))
        .collect();
    for s in &ai.new_stages {
        stage_id_to_db.insert(s.id.clone(), s.id.clone());
    }

    // 1. 创建新阶段
    for new_stage in &ai.new_stages {
        let stage = Stage {
            id: Uuid::new_v4().to_string(),
            roadmap_id: request.roadmap_id.clone(),
            order: new_stage.order,
            name: new_stage.name.trim().to_string(),
            objective: new_stage.objective.clone().unwrap_or_default(),
            estimated_hours: new_stage.estimated_hours.unwrap_or(4.0),
            stage_type: "learning".to_string(),
            prerequisites: json_array_string(new_stage.prerequisites.as_deref().unwrap_or(&[])),
            metadata: None,
        };
        db.create_stage(&stage).await?;
        stage_id_to_db.insert(new_stage.id.clone(), stage.id.clone());
        for (task_idx, task) in new_stage.tasks.iter().enumerate() {
            let built = build_task_for_ai(
                &AiTask {
                    id: None,
                    order: task.order,
                    title: task.title.clone(),
                    content: task.content.clone(),
                    points: task.points.clone(),
                    prerequisites: task.prerequisites.clone(),
                    task_type: task.task_type.clone(),
                    example: task.example.clone(),
                    video: task.video.clone(),
                    deleted: None,
                    resources: Some(task.resources.clone()),
                },
                task_idx,
                &stage.id,
                None,
            );
            db.upsert_task(&built).await?;
            apply_task_resources(db, &built.id, Some(&task.resources), task.video.as_deref())
                .await?;
            if enricher.key.is_some() {
                enriched_tasks.push(built.id.clone());
            }
        }
        recompute_stage_type(db, &stage.id).await?;
    }

    // 2. 阶段排序
    let mut stage_orders: Vec<String> = Vec::with_capacity(existing.len());
    for id in &ai.stage_orders {
        if let Some(es) = existing.iter().find(|s| s.stage.id == *id) {
            stage_orders.push(es.stage.id.clone());
        }
    }
    for es in existing {
        if !stage_orders.contains(&es.stage.id) {
            stage_orders.push(es.stage.id.clone());
        }
    }
    for (idx, stage_id) in stage_orders.iter().enumerate() {
        let mut stage = db
            .get_stage_by_id(stage_id)
            .await?
            .ok_or_else(|| format!("未找到阶段：{stage_id}"))?;
        if stage.order != idx as i32 + 1 {
            stage.order = idx as i32 + 1;
            db.update_stage(&stage).await?;
        }
    }

    // 3. 阶段字段更新
    for update in &ai.stage_updates {
        let Some(es) = existing.iter().find(|s| s.stage.id == update.id) else {
            continue;
        };
        let mut stage = es.stage.clone();
        if let Some(name) = update
            .name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            stage.name = name.to_string();
        }
        if let Some(objective) = update
            .objective
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            stage.objective = objective.to_string();
        }
        if let Some(prereqs) = &update.prerequisites {
            stage.prerequisites = json_array_string(prereqs);
        }
        if let Some(hours) = update.estimated_hours {
            if hours > 0.0 {
                stage.estimated_hours = hours;
            }
        }
        stage.metadata = None;
        db.update_stage(&stage).await?;
    }

    // 4. 任务移动
    for mv in &ai.task_moves {
        let Some(db_stage_id) = stage_id_to_db.get(&mv.stage_id) else {
            return Err(format!("移动目标阶段不存在：{}", mv.stage_id));
        };
        let task = db
            .get_task_by_id(&mv.id)
            .await?
            .ok_or_else(|| format!("未找到任务：{}", mv.id))?;
        let mut updated = task;
        updated.stage_id = db_stage_id.clone();
        if let Some(order) = mv.order {
            updated.order = order;
        }
        db.upsert_task(&updated).await?;
    }

    // 5. 任务字段更新
    let mut affected_stages: Vec<String> = Vec::new();
    for update in &ai.task_updates {
        let task = db
            .get_task_by_id(&update.id)
            .await?
            .ok_or_else(|| format!("未找到任务：{}", update.id))?;
        let mut updated = task.clone();
        if let Some(order) = update.order {
            updated.order = order;
        }
        if let Some(title) = update
            .title
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            updated.title = title.to_string();
        }
        if let Some(content) = update
            .content
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            updated.content = content.to_string();
        }
        if let Some(points) = &update.points {
            updated.points = json_array_string(points);
        }
        if let Some(prereqs) = &update.prerequisites {
            updated.prerequisites = json_array_string(prereqs);
        }
        if let Some(task_type) = normalize_task_type(update.task_type.as_deref()) {
            updated.task_type = task_type;
        }
        if let Some(example) = &update.example {
            updated.example = Some(example.trim().to_string());
        }
        db.upsert_task(&updated).await?;
        if let Some(resources) = &update.resources {
            apply_task_resources(db, &updated.id, Some(resources), update.video.as_deref()).await?;
            if enricher.key.is_some() {
                enriched_tasks.push(updated.id.clone());
            }
        } else {
            apply_task_resources(db, &updated.id, None, update.video.as_deref()).await?;
        }
        if !affected_stages.contains(&updated.stage_id) {
            affected_stages.push(updated.stage_id.clone());
        }
    }

    // 6. 新增任务
    for task in &ai.new_tasks {
        let Some(stage_id) = task.stage_id.clone() else {
            continue;
        };
        let Some(db_stage_id) = stage_id_to_db.get(&stage_id) else {
            return Err(format!("新增任务的目标阶段不存在：{stage_id}"));
        };
        let existing_tasks = db.get_tasks_by_stage(db_stage_id).await?;
        let order = task.order.unwrap_or(existing_tasks.len() as i32 + 1);
        let built = build_task_for_ai(
            &AiTask {
                id: None,
                order: Some(order),
                title: task.title.clone(),
                content: task.content.clone(),
                points: task.points.clone(),
                prerequisites: task.prerequisites.clone(),
                task_type: task.task_type.clone(),
                example: task.example.clone(),
                video: task.video.clone(),
                deleted: None,
                resources: Some(task.resources.clone()),
            },
            order as usize - 1,
            db_stage_id,
            None,
        );
        db.upsert_task(&built).await?;
        apply_task_resources(db, &built.id, Some(&task.resources), task.video.as_deref()).await?;
        if enricher.key.is_some() {
            enriched_tasks.push(built.id.clone());
        }
        if !affected_stages.contains(db_stage_id) {
            affected_stages.push(db_stage_id.clone());
        }
    }

    // 7. 删除任务与阶段
    let mut removed_task_titles = Vec::new();
    let mut removed_stage_titles = Vec::new();
    for task_id in &ai.deleted_task_ids {
        if let Ok(Some(task)) = db.get_task_by_id(task_id).await {
            removed_task_titles.push(task.title.clone());
            db.delete_task_complete(task_id).await?;
        }
    }
    for stage_id in &ai.deleted_stage_ids {
        if let Ok(Some(stage)) = db.get_stage_by_id(stage_id).await {
            let tasks = db.get_tasks_by_stage(stage_id).await?;
            removed_stage_titles.push(stage.name.clone());
            for task in tasks {
                removed_task_titles.push(task.title.clone());
            }
            db.delete_stage_complete(stage_id).await?;
        }
    }
    if !removed_task_titles.is_empty() {
        strip_task_titles(db, &request.roadmap_id, &removed_task_titles).await?;
    }
    if !removed_stage_titles.is_empty() {
        strip_stage_titles(db, &request.roadmap_id, &removed_stage_titles).await?;
    }
    for stage_id in affected_stages {
        recompute_stage_type(db, &stage_id).await?;
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
        .filter(|h| *h > 0.0)
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

async fn enrich_tasks_with_tavily(
    db: &crate::Database,
    enricher: &TavilyEnricher,
    topic: &str,
    task_ids: &[String],
) -> Result<(), String> {
    let (Some(key), Some(client)) = (&enricher.key, &enricher.client) else {
        return Ok(());
    };

    let mut seen = std::collections::HashSet::new();
    let unique_ids: Vec<&str> = task_ids
        .iter()
        .filter(|id| seen.insert(id.as_str()))
        .map(String::as_str)
        .collect();
    if unique_ids.is_empty() {
        return Ok(());
    }

    let mut tasks = Vec::new();
    for task_id in &unique_ids {
        let task = match db.get_task_by_id(task_id).await {
            Ok(Some(task)) => task,
            _ => continue,
        };
        tasks.push(task);
    }

    let semaphore = Arc::new(tokio::sync::Semaphore::new(4));
    let mut handles = Vec::new();
    for task in tasks {
        let permit = semaphore.clone();
        let client = client.clone();
        let key = key.clone();
        let topic = topic.to_string();
        handles.push(tokio::spawn(async move {
            let _guard = permit.acquire().await.expect("信号量");
            let query = tavily::build_search_query(&topic, &task.title, &task.task_type);
            let result = tavily::search_resources(&client, &key, &query, 4).await;
            (task, result)
        }));
    }

    let mut results = Vec::new();
    for handle in handles {
        match handle.await {
            Ok((task, Ok(resources))) => results.push((task, Ok(resources))),
            Ok((task, Err(e))) => results.push((task, Err(e))),
            Err(_) => {}
        }
    }

    for (task, result) in results {
        match result {
            Ok(resources) if !resources.is_empty() => {
                info!(
                    "  [Tavily] ✔「{}」→ {} 个资源",
                    task.title,
                    resources.len()
                );
                db.delete_resources_by_task(&task.id).await?;
                for resource in resources {
                    db.create_resource(&Resource {
                        id: Uuid::new_v4().to_string(),
                        task_id: task.id.clone(),
                        title: resource.title,
                        url: resource.url,
                        snippet: resource.snippet,
                        resource_type: resource.resource_type,
                    })
                    .await?;
                }
            }
            Ok(_) => {
                info!("  [Tavily] ○「{}」→ 无结果，保留原资源", task.title);
            }
            Err(e) => {
                info!("  [Tavily] ✘「{}」→ {}，保留原资源", task.title, e);
            }
        }
    }
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

    let tavily_key = {
        let db = state.db.lock().await;
        db.get_api_key("tavily").await.unwrap_or(None)
    };
    let enricher = match tavily_key.as_deref().filter(|k| !k.is_empty()) {
        Some(key) => {
            info!("→ [Tavily] 已配置，优化后将为变更任务搜索真实资源");
            TavilyEnricher {
                key: Some(key.to_string()),
                client: Some(
                    Client::builder()
                        .timeout(std::time::Duration::from_secs(30))
                        .build()
                        .map_err(|e| format!("创建 Tavily 客户端失败: {}", e))?,
                ),
            }
        }
        None => {
            info!(
                "→ [Tavily] 已跳过：未找到 Tavily key，优化保留 AI 生成的资源"
            );
            TavilyEnricher::empty()
        }
    };

    let (roadmap, existing, snapshot) = {
        let db = state.db.lock().await;
        load_roadmap(&db, &request.roadmap_id).await?
    };
    let topic = roadmap
        .metadata
        .as_deref()
        .and_then(|m| serde_json::from_str::<serde_json::Value>(m).ok())
        .and_then(|v| v["topic"].as_str().map(str::to_string))
        .unwrap_or_else(|| roadmap.title.clone());

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
        let stage_snapshot = snapshot
            .stages
            .iter()
            .find(|s| s.tasks.iter().any(|t| t.id == task_id))
            .ok_or_else(|| "未找到目标任务所属阶段".to_string())?;
        Some(
            serde_json::to_string(&serde_json::json!({
                "task": task_snapshot,
                "stage_name": stage_snapshot.name,
                "stage_tasks": stage_snapshot.tasks.iter().map(|t| &t.title).collect::<Vec<_>>(),
            }))
            .map_err(|e| format!("序列化目标任务失败：{}", e))?,
        )
    } else {
        None
    };

    let (roadmap_json, new_stage_ids, max_tokens) = if request.scope == "roadmap" {
        let roadmap_json = serde_json::to_string_pretty(&serde_json::json!({
            "id": snapshot.id,
            "title": snapshot.title,
            "description": snapshot.description,
            "estimated_total_hours": snapshot.estimated_total_hours,
            "stages": snapshot.stages.iter().map(|s| s.compact_json()).collect::<Vec<_>>(),
        }))
        .map_err(|e| format!("序列化路线失败：{}", e))?;
        let new_stage_ids: Vec<String> = (1..=4).map(|i| format!("new-stage-{i}")).collect();
        (roadmap_json, new_stage_ids, 12000)
    } else {
        (
            "（局部优化：只需查看下面给出的目标内容）".to_string(),
            Vec::new(),
            if request.scope == "task" { 2500 } else { 6000 },
        )
    };
    let prompt = build_optimize_prompt(
        &roadmap_json,
        &request,
        target_stage_json.as_deref(),
        target_task_json.as_deref(),
        &new_stage_ids,
    );

    let raw = call_ai_with_retry(
        &client,
        &conn.provider_type,
        &conn.base_url,
        &conn.model,
        &conn.api_key,
        "你是学习路线优化专家。严格按 JSON 返回，不要输出任何解释、思考或 Markdown 代码块。",
        &prompt,
        max_tokens,
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

    let db = state.db.lock().await;
    match request.scope.as_str() {
        "task" => {
            let ai = parse_optimized_task(&raw)?;
            let mut enriched_tasks = Vec::new();
            apply_task_scope(&db, &request, &ai, &enricher, &mut enriched_tasks).await?;
            enrich_tasks_with_tavily(&db, &enricher, &topic, &enriched_tasks).await?;
        }
        "stage" => {
            let ai = parse_optimized_stage(&raw)?;
            let mut enriched_tasks = Vec::new();
            apply_stage_scope(&db, &request, &ai, &enricher, &mut enriched_tasks).await?;
            enrich_tasks_with_tavily(&db, &enricher, &topic, &enriched_tasks).await?;
        }
        _ => {
            let plan = parse_optimize_plan(&raw)?;
            let mut enriched_tasks = Vec::new();
            apply_roadmap_scope(
                &db,
                &request,
                &existing,
                &plan,
                &roadmap,
                &enricher,
                &mut enriched_tasks,
            )
            .await?;
            enrich_tasks_with_tavily(&db, &enricher, &topic, &enriched_tasks).await?;
        }
    }
    build_roadmap_response(&db, &request.roadmap_id).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_optimize_plan() {
        let raw = r#"{
            "title": "新标题",
            "estimated_total_hours": 88.0,
            "stage_orders": ["s2", "s1"],
            "stage_updates": [{"id": "s1", "name": "改名", "prerequisites": []}],
            "new_stages": [{"id": "new-stage-1", "order": 3, "name": "新阶段", "tasks": [{"title": "新任务", "points": ["a"]}]}],
            "deleted_stage_ids": ["s3"],
            "task_updates": [{"id": "t1", "content": "新内容", "resources": []}],
            "new_tasks": [{"stage_id": "new-stage-1", "order": 2, "title": "追加任务"}],
            "task_moves": [{"id": "t2", "stage_id": "s1", "order": 1}],
            "deleted_task_ids": ["t3"]
        }"#;
        let plan = parse_optimize_plan(raw).expect("plan parses");
        assert_eq!(plan.title.as_deref(), Some("新标题"));
        assert_eq!(plan.stage_orders, vec!["s2", "s1"]);
        assert_eq!(plan.new_stages.len(), 1);
        assert_eq!(plan.new_stages[0].tasks[0].title, "新任务");
        assert_eq!(plan.task_updates.len(), 1);
        assert!(plan.task_updates[0]
            .resources
            .as_deref()
            .unwrap()
            .is_empty());
        assert_eq!(plan.new_tasks[0].stage_id.as_deref(), Some("new-stage-1"));
        assert_eq!(plan.task_moves[0].stage_id, "s1");
    }

    #[test]
    fn parses_optimized_task_and_stage() {
        let task_raw = r#"{"id":"t1","order":2,"title":"重写任务","points":["p1"],"task_type":"project","resources":[{"title":"R","url":"https://x"}]}"#;
        let task = parse_optimized_task(task_raw).expect("task parses");
        assert_eq!(task.id.as_deref(), Some("t1"));
        assert_eq!(task.order, Some(2));
        assert_eq!(task.points.as_deref().unwrap(), &["p1".to_string()]);

        let stage_raw = r#"{"id":"s1","order":1,"name":"重写阶段","tasks":[{"id":"t1","title":"任务","content":"内容","resources":[]}]}"#;
        let stage = parse_optimized_stage(stage_raw).expect("stage parses");
        assert_eq!(stage.name, "重写阶段");
        assert_eq!(stage.tasks.len(), 1);
        assert_eq!(stage.tasks[0].title, "任务");
    }

    #[test]
    fn sanitize_plan_drops_bad_field_types() {
        let raw = r#"{
            "stage_orders": [1, "s1"],
            "task_updates": [{"id": "t1", "points": "not-an-array", "resources": "bad"}],
            "new_tasks": [{"title": "ok"}, {"title": ""}]
        }"#;
        let plan = parse_optimize_plan(raw).expect("plan parses");
        assert_eq!(plan.stage_orders, vec!["s1"]);
        assert!(plan.task_updates[0].points.is_none());
        assert!(plan.task_updates[0].resources.is_none());
        assert_eq!(plan.new_tasks.len(), 1);
    }
}
