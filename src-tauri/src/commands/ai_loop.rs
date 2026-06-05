use crate::services::{build_outline_prompt, get_provider, AiProvider};
use crate::AppState;
use reqwest::Client;
use serde::Serialize;
use tauri::State;
use tracing::info;

#[derive(Debug, Serialize)]
pub struct RefinedContent {
    pub content: String,
    pub title: String,
    pub task_type: String,
    pub minutes: u32,
}

/// AI 闭环 A-5:把 AI 回答精炼为学习任务内容。
/// 接收原始回答,返回结构化 markdown 内容 + 建议标题/类型/时长。
#[tauri::command]
pub async fn refine_task_content(
    state: State<'_, AppState>,
    raw_answer: String,
    topic: Option<String>,
) -> Result<RefinedContent, String> {
    info!("精炼任务内容,raw 长度={}", raw_answer.len());

    // 单锁拿 settings + key + config
    let (settings, api_key, custom_config) = {
        let db = state.db.lock().await;
        let settings = db.get_settings().await?;
        let api_key = db.get_api_key(&settings.ai_provider)
            .await?
            .ok_or_else(|| format!("{} 的 API Key 未找到", settings.ai_provider))?;
        let cfg = db.get_api_config(&settings.ai_provider).await?;
        (settings, api_key, cfg)
    };

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    // 拼 prompt:让 AI 把原始回答改成"学习任务"风格
    let topic_ctx = topic.as_deref().unwrap_or("(通用)");
    let system = "你是学习内容精炼专家。负责把 AI 回答改写为适合学习的任务内容。 \
        严格按 JSON 返回,不要解释。";
    let user_prompt = format!(
        r#"请把以下 AI 原始回答精炼为学习任务内容。

【所属主题】{topic_ctx}

【原始回答】
{raw_answer}

【输出 JSON 格式】
{{
  "title": "≤30 字的中文任务标题",
  "task_type": "reading|exercise|project|video|quiz 之一",
  "minutes": 5~120 的整数(预估学习时长),
  "content": "完整的 markdown 任务内容,含:概述 / 关键概念(列表) / 示例 / 小练习(可选) / 小结"
}}
"#
    );

    // 选 provider
    let provider: Box<dyn AiProvider> = match &custom_config {
        Some(cfg) if !cfg.base_url.is_empty() && !cfg.model.is_empty() => {
            if cfg.provider_type == "anthropic" {
                Box::new(crate::services::ClaudeProvider::new())
            } else {
                Box::new(crate::services::CustomProvider::new(cfg.base_url.clone(), cfg.model.clone()))
            }
        }
        _ => get_provider(&settings.ai_provider),
    };

    let raw = provider
        .chat(&client, &[(system, user_prompt.as_str())], &api_key)
        .await
        .map_err(|e| format!("AI 精炼失败: {}", e))?;

    // 解析 AI 返回的 JSON (允许 ```json ... ``` 包裹)
    let json_text = strip_code_fence(&raw);
    let parsed: serde_json::Value = serde_json::from_str(json_text)
        .map_err(|e| format!("解析 AI 返回 JSON 失败: {}\n原文: {}", e, raw))?;

    Ok(RefinedContent {
        title: parsed["title"].as_str().unwrap_or("新任务").trim().to_string(),
        task_type: validate_task_type(parsed["task_type"].as_str().unwrap_or("reading")),
        minutes: parsed["minutes"].as_u64().unwrap_or(15).min(120).max(5) as u32,
        content: parsed["content"].as_str().unwrap_or(&raw_answer).to_string(),
    })
}

fn strip_code_fence(s: &str) -> &str {
    let s = s.trim();
    if let Some(rest) = s.strip_prefix("```json") {
        if let Some(end) = rest.rfind("```") {
            return rest[..end].trim();
        }
    }
    if let Some(rest) = s.strip_prefix("```") {
        if let Some(end) = rest.rfind("```") {
            return rest[..end].trim();
        }
    }
    s
}

fn validate_task_type(t: &str) -> String {
    match t {
        "reading" | "exercise" | "project" | "video" | "quiz" => t.to_string(),
        _ => "reading".to_string(),
    }
}

// 抑制 outline prompt 的 unused 警告(其他模块使用)
#[allow(dead_code)]
fn _unused() {
    let _ = build_outline_prompt("", "", "", "");
}
