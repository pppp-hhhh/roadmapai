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
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl AiProvider for OpenAiProvider {
    async fn chat(
        &self,
        client: &Client,
        messages: &[(&str, &str)],
        api_key: &str,
    ) -> Result<String, String> {
        let msgs: Vec<serde_json::Value> = messages
            .iter()
            .map(|(role, content)| serde_json::json!({ "role": role, "content": content }))
            .collect();

        let body = serde_json::json!({
            "model": "gpt-4o", "messages": msgs, "temperature": 0.7, "max_tokens": 2000, "stream": true
        });

        let resp = client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .header("Accept-Encoding", "identity")
            .json(&body)
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(|e| format!("请求失败：{}", e))?;

        if !resp.status().is_success() {
            return Err(format!(
                "API 错误：{}",
                resp.text().await.unwrap_or_default()
            ));
        }

        let text = resp
            .text()
            .await
            .map_err(|e| format!("读取响应失败：{}", e))?;
        let mut full = String::new();
        for line in text.lines() {
            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    break;
                }
                if let Ok(chunk) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(c) = chunk["choices"][0]["delta"]["content"].as_str() {
                        full.push_str(c);
                    }
                }
            }
        }
        Ok(full)
    }

    fn provider_type(&self) -> AiProviderType {
        AiProviderType::OpenAI
    }
}

// ── Claude Provider ──

pub struct ClaudeProvider;
impl ClaudeProvider {
    pub fn new() -> Self {
        Self
    }
}

#[derive(Debug, Deserialize)]
struct ClaudeContentBlock {
    #[serde(rename = "type")]
    block_type: String,
    #[serde(default)]
    text: Option<String>,
}
#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContentBlock>,
}

#[async_trait]
impl AiProvider for ClaudeProvider {
    async fn chat(
        &self,
        client: &Client,
        messages: &[(&str, &str)],
        api_key: &str,
    ) -> Result<String, String> {
        let msgs: Vec<serde_json::Value> = messages
            .iter()
            .map(|(role, content)| serde_json::json!({ "role": role, "content": content }))
            .collect();

        let body = serde_json::json!({
            "model": "claude-sonnet-4-20250514", "max_tokens": 2000, "messages": msgs
        });

        let resp = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .header("Accept-Encoding", "identity")
            .json(&body)
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(|e| format!("Claude 请求失败：{}", e))?;

        if !resp.status().is_success() {
            return Err(format!(
                "Claude API 错误：{}",
                resp.text().await.unwrap_or_default()
            ));
        }

        let cr: ClaudeResponse = resp
            .json()
            .await
            .map_err(|e| format!("解析响应失败：{}", e))?;
        cr.content
            .iter()
            .find(|b| b.block_type == "text" && b.text.is_some())
            .and_then(|b| b.text.clone())
            .ok_or("无文本响应内容".to_string())
    }

    fn provider_type(&self) -> AiProviderType {
        AiProviderType::Claude
    }
}

// ── Gemini Provider ──

pub struct GeminiProvider;
impl GeminiProvider {
    pub fn new() -> Self {
        Self
    }
}

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
    error: Option<GeminiError>,
}
#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: GeminiContent,
}
#[derive(Debug, Deserialize)]
struct GeminiContent {
    parts: Vec<GeminiPart>,
}
#[derive(Debug, Deserialize)]
struct GeminiPart {
    text: Option<String>,
}
#[derive(Debug, Deserialize)]
struct GeminiError {
    message: String,
    code: i32,
}

#[async_trait]
impl AiProvider for GeminiProvider {
    async fn chat(
        &self,
        client: &Client,
        messages: &[(&str, &str)],
        api_key: &str,
    ) -> Result<String, String> {
        let contents: Vec<serde_json::Value> = messages
            .iter()
            .map(|(role, content)| {
                serde_json::json!({
                    "role": if *role == "assistant" { "model" } else { "user" },
                    "parts": [{ "text": content }]
                })
            })
            .collect();

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
            return Err(format!(
                "Gemini API 错误：{}",
                resp.text().await.unwrap_or_default()
            ));
        }

        let gr: GeminiResponse = resp
            .json()
            .await
            .map_err(|e| format!("解析响应失败：{}", e))?;
        if let Some(e) = gr.error {
            return Err(format!("Gemini 错误 {}: {}", e.code, e.message));
        }
        gr.candidates
            .and_then(|c| c.into_iter().next())
            .and_then(|c| c.content.parts.into_iter().next().and_then(|p| p.text))
            .ok_or("无响应内容".to_string())
    }

    fn provider_type(&self) -> AiProviderType {
        AiProviderType::Gemini
    }
}

// ── Custom Provider ──

pub struct CustomProvider {
    pub base_url: String,
    pub model: String,
}

impl CustomProvider {
    pub fn new(base_url: String, model: String) -> Self {
        Self { base_url, model }
    }
}

#[async_trait]
impl AiProvider for CustomProvider {
    async fn chat(
        &self,
        client: &Client,
        messages: &[(&str, &str)],
        api_key: &str,
    ) -> Result<String, String> {
        let msgs: Vec<serde_json::Value> = messages
            .iter()
            .map(|(role, content)| serde_json::json!({ "role": role, "content": content }))
            .collect();

        let body = serde_json::json!({
            "model": self.model, "messages": msgs, "temperature": 0.7, "max_tokens": 2000, "stream": false
        });

        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));
        let resp = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .header("Accept-Encoding", "identity")
            .json(&body)
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(|e| format!("请求失败：{}", e))?;

        if !resp.status().is_success() {
            return Err(format!(
                "API 错误：{}",
                resp.text().await.unwrap_or_default()
            ));
        }

        let raw = resp
            .text()
            .await
            .map_err(|e| format!("读取响应失败: {}", e))?;
        let chat: OpenAIChatResponse =
            serde_json::from_str(&raw).map_err(|e| format!("解析响应失败: {}", e))?;
        chat.choices
            .first()
            .map(|c| c.message.content.clone())
            .ok_or_else(|| "没有响应选项".to_string())
    }

    fn provider_type(&self) -> AiProviderType {
        AiProviderType::Custom
    }
}

pub fn get_provider(provider_name: &str) -> Box<dyn AiProvider> {
    match provider_name.to_lowercase().as_str() {
        "claude" | "anthropic" => Box::new(ClaudeProvider::new()),
        "gemini" => Box::new(GeminiProvider::new()),
        _ => Box::new(OpenAiProvider::new()),
    }
}

pub fn get_provider_with_config(
    provider_name: &str,
    base_url: &str,
    model: &str,
) -> Box<dyn AiProvider> {
    match provider_name.to_lowercase().as_str() {
        "claude" | "anthropic" => Box::new(ClaudeProvider::new()),
        "gemini" => Box::new(GeminiProvider::new()),
        "custom" | "deepseek" | _ => {
            Box::new(CustomProvider::new(base_url.to_string(), model.to_string()))
        }
    }
}

// ══════════════════════════════════════════════════════════
//  三层并行生成 — Prompt 函数
// ══════════════════════════════════════════════════════════

pub fn build_outline_prompt(
    topic: &str,
    goal: &str,
    level: &str,
    difficulty: &str,
    profile: Option<&str>,
) -> String {
    let profile_section = profile
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .map(|p| format!("\n## 用户画像\n{}\n", p))
        .unwrap_or_default();

    format!(
        r#"你是学习路线设计师。用户当前{}水平，目标是{}，难度{}。为「{}」设计一条学习路线。
{profile_section}

## 先想清楚
1. 「{}」从{}到{}，该领域公认的大学标准课程、经典教材或权威教学大纲通常按什么章节组织？请参照该领域公认教材/课程的目录结构
2. 不要主观精简章节——领域内公认的核心知识点都应覆盖，缺一个都可能造成学习断层
3. 不要在"期末复习"场景下随意砍阶段，精简是合并相邻小节而非删除整章

## 阶段数参考（自适应，3-14 个）
- 按领域规模、知识深度和用户目标自适应：主题宽广或用户要求深入时取上限，入门/工具类取下限
- 常规领域 5-9 个，章节极丰富的领域 10-14 个，简单工具/单门课程入门 3-5 个
- 不要为了"精简"而删除独立章节，也不要为了凑数强行拆出无内容可讲的阶段

## 时间估算
- 每周小时：备考/学生 10-20h · 在职 3-8h · 慢学 2-5h
- 总周数：快节奏 2-5周 · 常规 5-10周 · 充分 10-20周

## brief 要求（最重要）
brief 唯一用途：让下一步 AI 知道这个阶段要做什么。不合格的 brief = 下游生成垃圾任务。

格式：一句话（60-120字）说明本阶段覆盖哪些核心知识点、为什么重要、学完后能做什么。必须是完整的一句话，不要分点。

不合格 ❌：
"学习该阶段的基础内容。"（无具体知识点，任何领域都可套用）

合格 ✅：
"掌握 X、Y、Z 三个核心概念/方法及其关系与常见误区，它们是该领域后续学习的基础，学完后能解释原理、完成对应的基础应用或练习，并判断下一步学习方向。"

**brief 必须出现至少 2 个该领域的核心术语（保留原文术语或公认中文专有名词），且必须体现该领域的具体内容，不能是通用套话**，否则不合格。

## 输出 JSON
{{
  "suggested_weekly_hours": 8,
  "suggested_total_weeks": 6,
  "estimated_total_hours": 48,
  "stages": [
    {{"order": 1, "title": "阶段标题", "brief": "一句话简介（60-120字，含2+领域术语）"}}
  ]
}}

返回纯JSON。#"#,
        level, goal, difficulty, topic, topic, level, goal
    )
}

pub fn build_stage_outline_only_prompt(
    topic: &str,
    level: &str,
    current_order: usize,
    stage_title: &str,
    stage_brief: &str,
    stage_titles: &[String],
    stage_prerequisites: &[String],
) -> String {
    let title_chain = if stage_titles.is_empty() {
        "（未提供其他阶段标题）".to_string()
    } else {
        stage_titles.join(" → ")
    };
    let prerequisite_line = if stage_prerequisites.is_empty() {
        "无".to_string()
    } else {
        stage_prerequisites.join("、")
    };
    format!(
        r#"为「{topic}」的第 {current_order} 个阶段「{stage_title}」设计任务骨架（只输出标题和类型，不要内容）。

## 阶段简介
{stage_brief}

## 整条路线的阶段顺序
{title_chain}

## 本阶段应声明的阶段级前置
{prerequisite_line}

## 学习者水平
{level}

## 要求
- 不要输出推理过程，直接输出 JSON
- 所有任务围绕「{topic}」和本阶段
- 任务数量按阶段目标与资料规模自适应：普通阶段 4-10 个；若本阶段基于整本书或多章节资料，可一章节一任务，最多约 20 个；不要为了凑数强行生成
- 任务类型只允许：reading / video / project
- 只有该主题/阶段存在普遍认可的实践、作品、实验或案例形态时才使用 project，纯理论学习阶段可以不生成 project
- stage.prerequisites 只允许列出该阶段之前的阶段标题（必须来自「整条路线的阶段顺序」，没有就填空数组）
- 每个任务的 prerequisites 只允许列出本阶段内更早出现的任务标题；确有意义时才填写，否则填空数组
- 禁止在 stage_description 中用 \\$ \\# \\& 等非法转义

## 输出 JSON
{{
  "stage_description": "本阶段详细目标（80-180字）",
  "prerequisites": ["前面阶段标题"],
  "tasks": [
    {{"order": 1, "title": "任务标题", "task_type": "reading", "prerequisites": []}}
  ]
}}

返回纯JSON。#"#
    )
}

pub fn build_task_content_prompt(
    topic: &str,
    stage_title: &str,
    stage_description: &str,
    task_title: &str,
    task_type: &str,
    prerequisites: &[String],
) -> String {
    let prerequisite_line = if prerequisites.is_empty() {
        "无".to_string()
    } else {
        prerequisites.join("、")
    };
    format!(
        r#"为「{topic}」生成任务「{task_title}」的学习内容。

类型：{task_type} | 阶段：{stage_title} | 目标：{stage_description}
前置任务：{prerequisite_line}

【重要】直接返回 JSON,不要输出任何思考、推理、分析、解释、注释。
【重要】不要使用 <think>、### 思考、Reasoning: 等任何形式的思考块。
【重要】第一条字符必须是 {{,最后一条字符必须是 }}。
【重要】禁止输出 flashcards、quiz、exercise；禁止输出长篇知识段落（如整段概念解释、完整讲义）。

输出 JSON:
{{
  "title": "任务标题（与输入一致，也可做 ≤8 字的微调）",
  "points": ["要点1（≤30字）", "要点2", "要点3", "要点4"],
  "prerequisites": ["前置任务标题（来自输入的前置任务；没有则空数组）"],
  "resources": [
    {{"title": "资源标题", "url": "https://...（真实URL）", "resource_type": "article"}}
  ],
  "video": "可选：真实可访问的视频URL；不适用就省略，不要输出 null",
  "example": "可选：按主题自动选择示例形式，如代码、公式推导、案例分析、作品/曲目、句型对话、实验步骤等；如果该主题不适用示例，直接省略此字段，不要输出 null",
  "content": "可选：极简 Markdown（≤100字，只按 points 展开成短句/清单，不要长篇段落）；省略时前端会用 points 生成内容"
}}

资源：按主题领域选择合适来源，如官方文档/教科书配套网站、B站/知乎/慕课类平台或该领域专业社区。2-4个。禁个人博客。资源标题保持简短。不要输出 snippet/推荐理由/简介字段。"#
    )
}
