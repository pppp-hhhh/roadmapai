use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(300);

#[derive(Debug, Clone)]
pub enum AiProviderType {
    OpenAI,
    Claude,
    Gemini,
    Custom,
}

#[async_trait]
pub trait AiProvider: Send + Sync {
    async fn chat(
        &self,
        client: &Client,
        messages: &[(&str, &str)],
        api_key: &str,
    ) -> Result<String, String>;

    fn provider_type(&self) -> AiProviderType;
}

#[derive(Debug, Deserialize)]
struct OpenAIChatResponse {
    choices: Vec<OpenAIChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAIMessage {
    content: String,
}

// ── OpenAI Provider ──

pub struct OpenAiProvider;

impl OpenAiProvider {
    pub fn new() -> Self { Self }
}

#[async_trait]
impl AiProvider for OpenAiProvider {
    async fn chat(&self, client: &Client, messages: &[(&str, &str)], api_key: &str) -> Result<String, String> {
        let msgs: Vec<serde_json::Value> = messages.iter().map(|(role, content)| {
            serde_json::json!({ "role": role, "content": content })
        }).collect();

        let body = serde_json::json!({
            "model": "gpt-4o", "messages": msgs, "temperature": 0.7, "max_tokens": 2000, "stream": true
        });

        let resp = client.post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .header("Accept-Encoding", "identity")
            .json(&body).timeout(REQUEST_TIMEOUT).send().await
            .map_err(|e| format!("请求失败：{}", e))?;

        if !resp.status().is_success() {
            return Err(format!("API 错误：{}", resp.text().await.unwrap_or_default()));
        }

        let text = resp.text().await.map_err(|e| format!("读取响应失败：{}", e))?;
        let mut full = String::new();
        for line in text.lines() {
            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" { break; }
                if let Ok(chunk) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(c) = chunk["choices"][0]["delta"]["content"].as_str() {
                        full.push_str(c);
                    }
                }
            }
        }
        Ok(full)
    }

    fn provider_type(&self) -> AiProviderType { AiProviderType::OpenAI }
}

// ── Claude Provider ──

pub struct ClaudeProvider;
impl ClaudeProvider { pub fn new() -> Self { Self } }

#[derive(Debug, Deserialize)]
struct ClaudeContentBlock {
    #[serde(rename = "type")] block_type: String,
    #[serde(default)] text: Option<String>,
}
#[derive(Debug, Deserialize)]
struct ClaudeResponse { content: Vec<ClaudeContentBlock> }

#[async_trait]
impl AiProvider for ClaudeProvider {
    async fn chat(&self, client: &Client, messages: &[(&str, &str)], api_key: &str) -> Result<String, String> {
        let msgs: Vec<serde_json::Value> = messages.iter().map(|(role, content)| {
            serde_json::json!({ "role": role, "content": content })
        }).collect();

        let body = serde_json::json!({
            "model": "claude-sonnet-4-20250514", "max_tokens": 2000, "messages": msgs
        });

        let resp = client.post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .header("Accept-Encoding", "identity")
            .json(&body).timeout(REQUEST_TIMEOUT).send().await
            .map_err(|e| format!("Claude 请求失败：{}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Claude API 错误：{}", resp.text().await.unwrap_or_default()));
        }

        let cr: ClaudeResponse = resp.json().await.map_err(|e| format!("解析响应失败：{}", e))?;
        cr.content.iter().find(|b| b.block_type == "text" && b.text.is_some())
            .and_then(|b| b.text.clone())
            .ok_or("无文本响应内容".to_string())
    }

    fn provider_type(&self) -> AiProviderType { AiProviderType::Claude }
}

// ── Gemini Provider ──

pub struct GeminiProvider;
impl GeminiProvider { pub fn new() -> Self { Self } }

#[derive(Debug, Deserialize)]
struct GeminiResponse { candidates: Option<Vec<GeminiCandidate>>, error: Option<GeminiError> }
#[derive(Debug, Deserialize)]
struct GeminiCandidate { content: GeminiContent }
#[derive(Debug, Deserialize)]
struct GeminiContent { parts: Vec<GeminiPart> }
#[derive(Debug, Deserialize)]
struct GeminiPart { text: Option<String> }
#[derive(Debug, Deserialize)]
struct GeminiError { message: String, code: i32 }

#[async_trait]
impl AiProvider for GeminiProvider {
    async fn chat(&self, client: &Client, messages: &[(&str, &str)], api_key: &str) -> Result<String, String> {
        let contents: Vec<serde_json::Value> = messages.iter().map(|(role, content)| {
            serde_json::json!({
                "role": if *role == "assistant" { "model" } else { "user" },
                "parts": [{ "text": content }]
            })
        }).collect();

        let body = serde_json::json!({
            "contents": contents, "generationConfig": { "temperature": 0.7, "maxOutputTokens": 2000 }
        });

        let resp = client.post(format!(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}", api_key
        ))
            .header("Content-Type", "application/json")
            .header("Accept-Encoding", "identity")
            .json(&body).timeout(REQUEST_TIMEOUT).send().await
            .map_err(|e| format!("Gemini 请求失败：{}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Gemini API 错误：{}", resp.text().await.unwrap_or_default()));
        }

        let gr: GeminiResponse = resp.json().await.map_err(|e| format!("解析响应失败：{}", e))?;
        if let Some(e) = gr.error { return Err(format!("Gemini 错误 {}: {}", e.code, e.message)); }
        gr.candidates.and_then(|c| c.into_iter().next())
            .and_then(|c| c.content.parts.into_iter().next().and_then(|p| p.text))
            .ok_or("无响应内容".to_string())
    }

    fn provider_type(&self) -> AiProviderType { AiProviderType::Gemini }
}

// ── Custom Provider ──

pub struct CustomProvider { pub base_url: String, pub model: String }

impl CustomProvider {
    pub fn new(base_url: String, model: String) -> Self { Self { base_url, model } }
}

#[async_trait]
impl AiProvider for CustomProvider {
    async fn chat(&self, client: &Client, messages: &[(&str, &str)], api_key: &str) -> Result<String, String> {
        let msgs: Vec<serde_json::Value> = messages.iter().map(|(role, content)| {
            serde_json::json!({ "role": role, "content": content })
        }).collect();

        let body = serde_json::json!({
            "model": self.model, "messages": msgs, "temperature": 0.7, "max_tokens": 2000, "stream": false
        });

        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));
        let resp = client.post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .header("Accept-Encoding", "identity")
            .json(&body).timeout(REQUEST_TIMEOUT).send().await
            .map_err(|e| format!("请求失败：{}", e))?;

        if !resp.status().is_success() {
            return Err(format!("API 错误：{}", resp.text().await.unwrap_or_default()));
        }

        let raw = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
        let chat: OpenAIChatResponse = serde_json::from_str(&raw)
            .map_err(|e| format!("解析响应失败: {}", e))?;
        chat.choices.first().map(|c| c.message.content.clone()).ok_or_else(|| "没有响应选项".to_string())
    }

    fn provider_type(&self) -> AiProviderType { AiProviderType::Custom }
}

pub fn get_provider(provider_name: &str) -> Box<dyn AiProvider> {
    match provider_name.to_lowercase().as_str() {
        "claude" | "anthropic" => Box::new(ClaudeProvider::new()),
        "gemini" => Box::new(GeminiProvider::new()),
        _ => Box::new(OpenAiProvider::new()),
    }
}

pub fn get_provider_with_config(provider_name: &str, base_url: &str, model: &str) -> Box<dyn AiProvider> {
    match provider_name.to_lowercase().as_str() {
        "claude" | "anthropic" => Box::new(ClaudeProvider::new()),
        "gemini" => Box::new(GeminiProvider::new()),
        "custom" | "deepseek" | _ => Box::new(CustomProvider::new(base_url.to_string(), model.to_string())),
    }
}

// ══════════════════════════════════════════════════════════
//  三层并行生成 — Prompt 函数
// ══════════════════════════════════════════════════════════

pub fn build_outline_prompt(topic: &str, goal: &str, level: &str, difficulty: &str) -> String {
    format!(
        r#"你是学习路线设计师。用户当前{}水平，目标是{}，难度{}。为「{}」设计一条学习路线。

## 先想清楚
1. 「{}」从{}到{}，大学标准课程/教科书通常按什么章节组织？请参照经典教材的目录结构
2. 不要主观精简章节——标准课程覆盖的知识点都是考点，缺一个就丢分
3. 不要在"期末复习"场景下随意砍阶段，精简是合并相邻小节而非删除整章

## 阶段数参考
- Git/Docker 工具入门：3-4 · Python 从语法到项目：5-6
- SpringBoot 起步到部署：5-7 · 操作系统/网络系统学习：5-7
- 参照标准教材章节数，不要为了"精简"而删除独立章节

## 时间估算
- 每周小时：备考/学生 10-20h · 在职 3-8h · 慢学 2-5h
- 总周数：快节奏 2-5周 · 常规 5-10周 · 充分 10-20周

## brief 要求（最重要）
brief 唯一用途：让下一步 AI 知道这个阶段要做什么。不合格的 brief = 下游生成垃圾任务。

格式：列举3-5个具体核心知识点 → 说明重要性 → 明确学完后能做什么。总计 100-150 字。

不合格 ❌：
"学习操作系统进程管理。"（无具体考点）

合格 ✅：
"掌握进程状态转换、PCB 结构、原语（fork/exec/waitpid）。进程是 OS 资源分配的基本单位。学完后能画进程状态图、解释进程与线程的区别。"

**brief 必须出现至少 3 个该主题的英文术语/函数名/类名**，否则不合格。

## 输出 JSON
{{
  "suggested_weekly_hours": 8,
  "suggested_total_weeks": 6,
  "estimated_total_hours": 48,
  "stages": [
    {{"order": 1, "title": "阶段标题", "brief": "3-5个知识点 + 为何重要 + 能做什么（100-150字，含3+英文术语）"}}
  ]
}}

返回纯JSON。#"#,
        level, goal, difficulty, topic,
        topic, level, goal
    )
}

pub fn build_stage_outline_only_prompt(topic: &str, level: &str, current_order: usize, stage_title: &str, stage_brief: &str) -> String {
    format!(
        r#"为「{topic}」的第 {current_order} 个阶段「{stage_title}」设计任务骨架（只输出标题和类型，不要内容）。

## 阶段简介
{stage_brief}

## 学习者水平
{level}

## 要求
- 不要输出推理过程，直接输出 JSON
- 所有任务围绕「{topic}」和本阶段
- 生成 4-6 个任务（reading/exercise/project/video）
- 禁止在 stage_description 中用 \\$ \\# \\& 等非法转义

## 输出 JSON
{{
  "stage_description": "本阶段详细目标（100-200字）",
  "tasks": [
    {{"order": 1, "title": "任务标题", "task_type": "reading"}}
  ]
}}

返回纯JSON。#"#
    )
}

pub fn build_task_content_prompt(topic: &str, stage_title: &str, stage_description: &str, task_title: &str, task_type: &str) -> String {
    format!(
        r#"为「{topic}」生成任务「{task_title}」的学习内容。

类型：{task_type} | 阶段：{stage_title} | 目标：{stage_description}

【重要】直接返回 JSON,不要输出任何思考、推理、分析、解释、注释。
【重要】不要使用 <think>、### 思考、Reasoning: 等任何形式的思考块。
【重要】第一条字符必须是 {{,最后一条字符必须是 }}。

输出 JSON:
{{
  "content": "Markdown学习内容，200-400字。包含概念、原理、应用。禁止用 \\$ \\# \\& 非法转义",
  "code_example": "代码示例（{topic}相关，如适用）",
  "exercise": "练习题（如适用）",
  "resources": [
    {{"title": "资源标题", "url": "https://...（真实URL）", "snippet": "推荐理由", "resource_type": "article"}}
  ],
  "flashcards": [
    {{"question": "记忆卡问题", "answer": "答案"}}
  ]
}}

资源：优先国内（Bilibili/掘金/慕课网/CSDN），次选官方文档/GitHub。2-4个。禁个人博客。
记忆卡：1-2张。"#
    )
}
