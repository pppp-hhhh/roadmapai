use crate::commands::roadmap::call_ai_with_retry;
use crate::services::roadmap_parser::clean_json;
use crate::AppState;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::{info, warn};

const INTAKE_SUMMARY_ROUNDS: u32 = 10;

#[derive(Debug, Deserialize)]
pub struct IntakeAskRequest {
    pub topic: String,
    pub goal: String,
    #[serde(default)]
    pub conversation: Vec<String>,
    #[serde(default)]
    pub skipped: Vec<String>,
    pub round: u32,
}

#[derive(Debug, Serialize)]
pub struct IntakeAskResponse {
    pub question: String,
    pub round: u32,
}

#[derive(Debug, Deserialize)]
pub struct IntakeSummarizeRequest {
    pub topic: String,
    pub goal: String,
    #[serde(default)]
    pub conversation: Vec<String>,
    #[serde(default)]
    pub supplementary: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct IntakeSummary {
    pub topic: String,
    pub goal: String,
    pub level: String,
    pub difficulty: String,
    pub profile: String,
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

fn format_entries(lines: &[String], empty_text: &str) -> String {
    if lines.is_empty() {
        return empty_text.to_string();
    }
    lines
        .iter()
        .enumerate()
        .map(|(i, line)| format!("{}. {}", i + 1, line))
        .collect::<Vec<_>>()
        .join("\n")
}

fn format_conversation(conversation: &[String]) -> String {
    format_entries(conversation, "（暂无对话）")
}

#[tauri::command]
pub async fn intake_ask(
    state: State<'_, AppState>,
    request: IntakeAskRequest,
) -> Result<IntakeAskResponse, String> {
    info!(
        "intake_ask round={} topic={} conversation_len={} skipped_len={}",
        request.round,
        request.topic,
        request.conversation.len(),
        request.skipped.len()
    );

    let conn = resolve_ai_connection(&state).await?;
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败：{}", e))?;

    let conversation_text = format_conversation(&request.conversation);
    let skipped_text = format_entries(&request.skipped, "（无）");
    let system = "你是一位学习需求访谈助手，只负责问下一个问题。你使用简体中文，每次只问一个问题，问题要具体、简短（不超过80字），不要自问自答，不要替用户回答。";
    let user_prompt = format!(
        r#"你在为「{}」设计学习路线前做需求访谈，目标是：{}。

当前对话轮次：{}（完成 {} 轮后，用户可以随时选择结束访谈并生成总结，无轮数上限）。

【已收集的对话】
{}

【用户跳过的题目】
{}

【下一个问题要求】
1. 只输出一个简体中文追问，简洁具体，聚焦尚未澄清的关键信息。
2. 优先追问这些方面（按缺失程度选择，不要一次问多个）：目标与期望成果；当前基础/相关经验；学习偏好（资料形式/节奏/深度）；期望深度；与该主题相关的具体追问。
3. 禁止主动追问“每周几小时/学习时长”“截止时间”“约束条件”，除非用户已经在对话中主动提到了这些内容，此时可以自然追问。
4. 已经问过的、用户已回答的信息不要再问。
5. 不要用任何措辞、换说法或换角度再次追问用户跳过的题目；优先选择其他尚未澄清的方向。

【输出格式】
直接返回 JSON：{{"question": "你的追问"}}。如果无法输出 JSON，也可以只返回纯文本问题。不要输出任何其他内容。"#,
        request.topic,
        request.goal,
        request.round,
        INTAKE_SUMMARY_ROUNDS,
        conversation_text,
        skipped_text
    );

    let raw = call_ai_with_retry(
        &client,
        &conn.provider_type,
        &conn.base_url,
        &conn.model,
        &conn.api_key,
        system,
        &user_prompt,
        800,
    )
    .await
    .map_err(|e| format!("访谈提问失败：{}", e))?;

    let question = match extract_question(&raw) {
        Some(q) => q,
        None => {
            let trimmed = raw.trim().to_string();
            if trimmed.is_empty() {
                warn!("intake_ask 返回空内容，使用默认追问");
                "我们继续聊聊你的目标：你希望通过这次学习最终达到什么样的成果？".to_string()
            } else {
                trimmed
            }
        }
    };

    Ok(IntakeAskResponse {
        question,
        round: request.round,
    })
}

fn extract_question(raw: &str) -> Option<String> {
    let cleaned = clean_json(raw);
    let value: serde_json::Value = serde_json::from_str(&cleaned).ok()?;
    value
        .get("question")
        .and_then(|q| q.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

#[tauri::command]
pub async fn intake_summarize(
    state: State<'_, AppState>,
    request: IntakeSummarizeRequest,
) -> Result<IntakeSummary, String> {
    info!(
        "intake_summarize topic={} conversation_len={}",
        request.topic,
        request.conversation.len()
    );

    let conn = resolve_ai_connection(&state).await?;
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败：{}", e))?;

    let conversation_text = format_conversation(&request.conversation);
    let supplementary = request
        .supplementary
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("（无）");

    let system =
        "你是学习需求整理助手。把访谈内容浓缩成结构化画像，只输出严格 JSON，不要输出任何解释。";
    let user_prompt = format!(
        r#"根据以下访谈内容，为「{}」学习需求生成总结。

【目标】
{}

【对话记录】
{}

【补充说明】
{}

【输出 JSON（必须严格）】
{{
  "topic": "用户学习的主题（精炼，≤40字）",
  "goal": "用户的目标/期望成果（精炼，≤80字）",
  "level": "入门 | 进阶 | 高级 之一",
  "difficulty": "简单 | 适中 | 困难 之一",
  "profile": "一段紧凑的用户画像（≤150字），可包含学习偏好、已有基础、节奏与深度倾向；只有用户主动提及时才能包含时间/截止/约束信息"
}}

要求：topic/goal 不要编造；level 和 difficulty 根据对话推断；profile 不要使用列表格式。返回纯 JSON。"#,
        request.topic, request.goal, conversation_text, supplementary
    );

    let raw = call_ai_with_retry(
        &client,
        &conn.provider_type,
        &conn.base_url,
        &conn.model,
        &conn.api_key,
        system,
        &user_prompt,
        1200,
    )
    .await
    .map_err(|e| format!("访谈总结失败：{}", e))?;

    Ok(parse_summary(&raw, &request))
}

fn parse_summary(raw: &str, request: &IntakeSummarizeRequest) -> IntakeSummary {
    let cleaned = clean_json(raw);
    let parsed: Option<serde_json::Value> = serde_json::from_str(&cleaned).ok();

    let get = |key: &str| -> Option<String> {
        parsed
            .as_ref()
            .and_then(|v| v.get(key))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
    };

    let topic = get("topic")
        .filter(|s| s.len() <= 100)
        .unwrap_or_else(|| request.topic.trim().to_string());
    let goal = get("goal")
        .filter(|s| s.len() <= 200)
        .unwrap_or_else(|| request.goal.trim().to_string());
    let level = normalize_level(get("level").as_deref());
    let difficulty = normalize_difficulty(get("difficulty").as_deref());
    let profile = get("profile")
        .filter(|s| s.len() <= 300)
        .unwrap_or_else(|| {
            request
                .conversation
                .iter()
                .rev()
                .find(|s| !s.trim().is_empty())
                .cloned()
                .unwrap_or_else(|| {
                    format!(
                        "用户正在学习「{}」，目标是「{}」。",
                        request.topic, request.goal
                    )
                })
        });

    IntakeSummary {
        topic,
        goal,
        level,
        difficulty,
        profile,
    }
}

fn normalize_level(v: Option<&str>) -> String {
    match v.map(str::to_lowercase).as_deref() {
        Some(s) if matches!(s, "beginner" | "入门" | "初级" | "零基础") => {
            "入门".to_string()
        }
        Some(s) if matches!(s, "intermediate" | "中级" | "进阶" | "中阶") => {
            "进阶".to_string()
        }
        Some(s) if matches!(s, "advanced" | "高级" | "深入") => "高级".to_string(),
        _ => "进阶".to_string(),
    }
}

fn normalize_difficulty(v: Option<&str>) -> String {
    match v.map(str::to_lowercase).as_deref() {
        Some(s) if matches!(s, "easy" | "简单" | "轻松" | "入门") => "简单".to_string(),
        Some(s) if matches!(s, "medium" | "适中" | "中等") => "适中".to_string(),
        Some(s) if matches!(s, "hard" | "困难" | "难" | "深入") => "困难".to_string(),
        _ => "适中".to_string(),
    }
}
