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
) -> Result<String, String> {
    info!("收到聊天消息,会话：{}, 内容长度：{}", session_id, message.len());

    // 1. 一次性锁:取 settings + api_key + config + 确保 session 存在 + 拉历史
    let (settings, api_key, custom_config, history) = {
        let db = state.db.lock().await;
        let settings = db.get_settings().await?;
        let api_key = db.get_api_key(&settings.ai_provider)
            .await?
            .ok_or_else(|| format!("{} 的 API Key 未找到,请在设置中配置 API Key", settings.ai_provider))?;
        let custom_config = db.get_api_config(&settings.ai_provider).await?;
        db.ensure_chat_session(&session_id, None).await?;
        let history = db.get_chat_history(&session_id, HISTORY_LIMIT).await?;
        (settings, api_key, custom_config, history)
    };

    // 2. 持久化新 user 消息
    {
        let db = state.db.lock().await;
        db.append_chat_message(&Uuid::new_v4().to_string(), &session_id, "user", &message)
            .await?;
    }

    // 3. 拼 messages (history + 新消息)
    let mut messages: Vec<(&str, &str)> = history
        .iter()
        .map(|m| (m.role.as_str(), m.content.as_str()))
        .collect();
    messages.push(("user", message.as_str()));

    // 4. 创建 HTTP client
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败：{}", e))?;

    // 5. 选 provider
    let provider: Box<dyn AiProvider> = match &custom_config {
        Some(cfg) if !cfg.base_url.is_empty() && !cfg.model.is_empty() => {
            info!("Using custom config for chat: base_url={}, model={}", cfg.base_url, cfg.model);
            if cfg.provider_type == "anthropic" {
                Box::new(crate::services::ClaudeProvider::new())
            } else {
                Box::new(crate::services::CustomProvider::new(cfg.base_url.clone(), cfg.model.clone()))
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
        db.append_chat_message(&Uuid::new_v4().to_string(), &session_id, "assistant", &response)
            .await?;
        db.touch_chat_session(&session_id).await?;
    }

    info!("聊天响应已持久化,长度 {} 字符", response.len());
    Ok(response)
}

/// 列出最近 chat sessions (前端可选择性展示)
#[tauri::command]
pub async fn list_chat_sessions(
    state: State<'_, AppState>,
) -> Result<Vec<crate::models::ChatSession>, String> {
    let db = state.db.lock().await;
    db.list_chat_sessions().await
}
