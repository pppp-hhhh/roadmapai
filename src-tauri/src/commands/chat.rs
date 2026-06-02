use crate::services::{get_provider, AiProvider};
use crate::AppState;
use reqwest::Client;
use tauri::State;
use tracing::info;

#[tauri::command]
pub async fn chat_send(
    state: State<'_, AppState>,
    session_id: String,
    message: String,
) -> Result<String, String> {
    info!("收到聊天消息，会话：{}", session_id);

    // Get settings and API config from database
    let (settings, api_key, custom_config) = {
        let db = state.db.lock().await;
        let settings = db.get_settings().await?;
        let api_key = db.get_api_key(&settings.ai_provider)
            .await?
            .ok_or_else(|| format!("{} 的 API Key 未找到，请在设置中配置 API Key", settings.ai_provider))?;
        let custom_config = db.get_api_config(&settings.ai_provider).await?;
        (settings, api_key, custom_config)
    };

    // Create HTTP client
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败：{}", e))?;

    // Get the AI provider based on settings and custom config
    let provider: Box<dyn AiProvider> = if let (Some(base_url), Some(model)) = (&custom_config.0, &custom_config.1) {
        info!("Using custom config for chat: base_url={}, model={}", base_url, model);
        match custom_config.2.as_deref() {
            Some("anthropic") => Box::new(crate::services::ClaudeProvider::new()),
            _ => Box::new(crate::services::CustomProvider::new(base_url.clone(), model.clone())),
        }
    } else {
        get_provider(&settings.ai_provider)
    };

    // Send the message and get response
    let response = provider
        .chat(&client, &[("user", &message)], &api_key)
        .await
        .map_err(|e| format!("聊天错误：{}", e))?;

    info!("聊天响应发送成功");
    Ok(response)
}
