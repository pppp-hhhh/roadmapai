use crate::AppState;
use crate::services::AiProvider;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::info;

#[tauri::command]
pub async fn save_api_key(
    state: State<'_, AppState>,
    provider: String,
    key: String,
) -> Result<(), String> {
    info!("正在保存 {} 的 API Key", provider);

    let db = state.db.lock().await;
    db.save_api_key(&provider, &key).await?;

    info!("{} 的 API Key 保存成功", provider);
    Ok(())
}

#[tauri::command]
pub async fn get_api_key(
    state: State<'_, AppState>,
    provider: String,
) -> Result<String, String> {
    let db = state.db.lock().await;
    db.get_api_key(&provider)
        .await?
        .ok_or_else(|| format!("{} 的 API Key 未找到", provider))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiConfig {
    pub base_url: String,
    pub model: String,
    #[serde(default)]
    pub provider_type: Option<String>,
}

#[tauri::command]
pub async fn save_api_config(
    state: State<'_, AppState>,
    provider: String,
    config: ApiConfig,
) -> Result<(), String> {
    info!("正在保存 {} 的接口配置", provider);

    let db = state.db.lock().await;
    db.save_api_config(&provider, &config.base_url, &config.model, config.provider_type.as_deref()).await?;

    info!("{} 的接口配置保存成功", provider);
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct ApiConfigResponse {
    pub base_url: String,
    pub model: String,
    pub provider_type: String,
    pub found: bool,
}

#[tauri::command]
pub async fn get_api_config(
    state: State<'_, AppState>,
    provider: String,
) -> Result<ApiConfigResponse, String> {
    let db = state.db.lock().await;
    let (base_url, model, provider_type) = db.get_api_config(&provider).await?;

    match (base_url, model) {
        (Some(base_url), Some(model)) => Ok(ApiConfigResponse { base_url, model, provider_type: provider_type.unwrap_or_default(), found: true }),
        _ => Ok(ApiConfigResponse { base_url: String::new(), model: String::new(), provider_type: String::new(), found: false }),
    }
}

#[derive(Debug, Deserialize)]
pub struct TestConfig {
    pub base_url: String,
    pub model: String,
    pub provider_type: String,
}

#[tauri::command]
pub async fn test_connection(
    state: State<'_, AppState>,
    provider: String,
    config: TestConfig,
) -> Result<bool, String> {
    info!("正在测试 {} 连接：base_url={}, model={}, type={}",
        provider, config.base_url, config.model, config.provider_type);

    // Get API key
    let api_key = {
        let db = state.db.lock().await;
        db.get_api_key(&provider)
            .await?
            .unwrap_or_default()
    };

    if api_key.is_empty() {
        return Err("API Key 为空".to_string());
    }

    // Create HTTP client
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败：{}", e))?;

    // Use config directly from frontend (not from DB)
    let ai_provider: Box<dyn AiProvider> = match config.provider_type.as_str() {
        "anthropic" => {
            Box::new(crate::services::ClaudeProvider::new())
        }
        _ => {
            Box::new(crate::services::CustomProvider::new(config.base_url.clone(), config.model.clone()))
        }
    };

    // Try a simple chat message to test the connection
    let test_result = ai_provider.chat(&client, &[("user", "Hi")], &api_key).await;

    match test_result {
        Ok(_response) => {
            info!("{} 连接测试成功", provider);
            Ok(true)
        }
        Err(e) => {
            info!("{} 连接测试失败：{}", provider, e);
            Err(e)
        }
    }
}
