use crate::models::{Stage, Task};
use crate::services::{get_provider, AiProvider};
use crate::AppState;
use reqwest::Client;
use tauri::State;
use tracing::info;
use uuid::Uuid;

const HISTORY_LIMIT: i64 = 20; // 最多给 LLM 喂 20 条历史

#[tauri::command]
pub async fn chat_send(
    state: State<'_, AppState>,
    session_id: String,
    message: String,
    stage_id: Option<String>,
    task_id: Option<String>,
) -> Result<String, String> {
    info!(
        "收到聊天消息,会话：{}, 内容长度：{}",
        session_id,
        message.len()
    );

    // 1. 一次性锁:取 settings + api_key + config + 位置上下文 + 确保 session 存在 + 拉历史
    let (settings, api_key, custom_config, context_message, history) = {
        let db = state.db.lock().await;
        let settings = db.get_settings().await?;
        let api_key = db
            .get_api_key(&settings.ai_provider)
            .await?
            .ok_or_else(|| {
                format!(
                    "{} 的 API Key 未找到,请在设置中配置 API Key",
                    settings.ai_provider
                )
            })?;
        let custom_config = db.get_api_config(&settings.ai_provider).await?;

        let mut stage_ctx: Option<Stage> = None;
        let mut task_ctx: Option<Task> = None;
        let mut roadmap_id: Option<String> = None;

        if let Some(sid) = stage_id.as_deref() {
            stage_ctx = db.get_stage_by_id(sid).await?;
        }
        if let Some(tid) = task_id.as_deref() {
            task_ctx = db.get_task_by_id(tid).await?;
            if stage_ctx.is_none() {
                if let Some(task) = &task_ctx {
                    stage_ctx = db.get_stage_by_id(&task.stage_id).await?;
                }
            }
        }
        if let Some(stage) = &stage_ctx {
            roadmap_id = Some(stage.roadmap_id.clone());
        }

        let context_message =
            build_position_context(&db, stage_ctx.as_ref(), task_ctx.as_ref()).await?;
        db.ensure_chat_session(
            &session_id,
            roadmap_id.as_deref(),
            stage_id.as_deref(),
            task_id.as_deref(),
        )
        .await?;
        if stage_id.is_some() || task_id.is_some() {
            db.update_chat_session_position(&session_id, stage_id.as_deref(), task_id.as_deref())
                .await?;
        }
        let history = db.get_chat_history(&session_id, HISTORY_LIMIT).await?;
        (settings, api_key, custom_config, context_message, history)
    };

    // 2. 持久化新 user 消息
    {
        let db = state.db.lock().await;
        db.append_chat_message(&Uuid::new_v4().to_string(), &session_id, "user", &message)
            .await?;
    }

    // 3. 拼 messages (位置上下文 + history + 新消息)
    let mut messages: Vec<(&str, &str)> = Vec::new();
    if let Some(context) = context_message.as_deref() {
        messages.push(("system", context));
    }
    messages.extend(
        history
            .iter()
            .map(|m| (m.role.as_str(), m.content.as_str())),
    );
    messages.push(("user", message.as_str()));

    // 4. 创建 HTTP client
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败：{}", e))?;

    // 5. 选 provider
    let provider: Box<dyn AiProvider> = match &custom_config {
        Some(cfg) if !cfg.base_url.is_empty() && !cfg.model.is_empty() => {
            info!(
                "Using custom config for chat: base_url={}, model={}",
                cfg.base_url, cfg.model
            );
            if cfg.provider_type == "anthropic" {
                Box::new(crate::services::ClaudeProvider::new())
            } else {
                Box::new(crate::services::CustomProvider::new(
                    cfg.base_url.clone(),
                    cfg.model.clone(),
                ))
            }
        }
        _ => get_provider(&settings.ai_provider),
    };

    // 6. 调 AI
    let response = provider
        .chat(&client, &messages, &api_key)
        .await
        .map_err(|e| format!("聊天错误：{}", e))?;

    // 7. 持久化 assistant 响应 + 更新 session 时间
    {
        let db = state.db.lock().await;
        db.append_chat_message(
            &Uuid::new_v4().to_string(),
            &session_id,
            "assistant",
            &response,
        )
        .await?;
        db.touch_chat_session(&session_id).await?;
    }

    info!("聊天响应已持久化,长度 {} 字符", response.len());
    Ok(response)
}

async fn build_position_context(
    db: &crate::Database,
    stage: Option<&Stage>,
    task: Option<&Task>,
) -> Result<Option<String>, String> {
    let stage = match stage {
        Some(s) => s,
        None => return Ok(None),
    };

    let roadmap = db
        .get_roadmap(&stage.roadmap_id)
        .await?
        .ok_or_else(|| "未找到路线".to_string())?;

    let tasks = db.get_tasks_by_stage(&stage.id).await?;
    let completed = tasks.iter().filter(|t| t.is_completed).count();
    let total = tasks.len();

    let stage_prereqs = crate::services::parallel::parse_string_array(&stage.prerequisites);
    let profile =
        serde_json::from_str::<serde_json::Value>(roadmap.metadata.as_deref().unwrap_or("{}"))
            .ok()
            .and_then(|v| v["profile"].as_str().map(str::to_string))
            .unwrap_or_default();

    let mut lines = vec![
        "你现在是用户学习路线中的导师，围绕下面的具体位置回答，不要泛泛而谈。".to_string(),
        format!("路线：{}", roadmap.title),
        format!("阶段：{}（目标：{}）", stage.name, stage.objective),
    ];
    if !stage_prereqs.is_empty() {
        lines.push(format!("本阶段前置：{}", stage_prereqs.join("、")));
    }
    lines.push(format!("该阶段进度：{}/{} 个任务已完成", completed, total));

    if let Some(task) = task {
        let points = crate::services::parallel::parse_string_array(&task.points);
        let prereqs = crate::services::parallel::parse_string_array(&task.prerequisites);
        lines.push(format!("当前任务：{}", task.title));
        if !points.is_empty() {
            lines.push(format!("任务要点：{}", points.join("；")));
        }
        if !prereqs.is_empty() {
            lines.push(format!("任务前置：{}", prereqs.join("、")));
        }
        lines.push(if task.is_completed {
            "任务状态：已完成".to_string()
        } else {
            "任务状态：未完成".to_string()
        });
    }

    if !profile.is_empty() {
        lines.push(format!("用户画像：{}", profile));
    }
    lines.push(
        "要求：以导师身份针对这个位置给出建议，结尾必须给出一条具体可执行的下一步。".to_string(),
    );

    Ok(Some(lines.join("\n")))
}

/// 列出最近 chat sessions (前端可选择性展示)
#[tauri::command]
pub async fn list_chat_sessions(
    state: State<'_, AppState>,
) -> Result<Vec<crate::models::ChatSession>, String> {
    let db = state.db.lock().await;
    db.list_chat_sessions().await
}
