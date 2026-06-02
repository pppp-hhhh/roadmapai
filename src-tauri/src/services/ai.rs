use crate::models::{RoadmapRequest, RoadmapResponse};
use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;
use tracing::{error, info, warn};

fn clean_json(s: &str) -> &str {
    let s = s.trim();
    let s = s.strip_prefix("```json").unwrap_or(s);
    let s = s.trim();
    let s = s.strip_prefix("```").unwrap_or(s);
    let s = s.trim();
    let s = s.strip_suffix("```").unwrap_or(s);
    s.trim()
}

fn parse_roadmap_json(content: &str) -> Result<RoadmapResponse, String> {
    let try_parse = |s: &str| -> Result<RoadmapResponse, String> {
        let cleaned = clean_json(s);
        serde_json::from_str::<RoadmapResponse>(cleaned).or_else(|direct_err| {
            let mut v: serde_json::Value = serde_json::from_str(cleaned)
                .map_err(|e| format!("直接: {}; Value解析也失败: {}", direct_err, e))?;
            fix_null_to_zero(&mut v);
            serde_json::from_value(v)
                .map_err(|value_err| format!("直接: {}; 修复后仍失败: {}", direct_err, value_err))
        })
    };

    let mut buffer = content.to_string();

    for attempt in 0..3 {
        match try_parse(&buffer) {
            Ok(r) => return Ok(r),
            Err(e) if attempt == 0 => {
                warn!("第 {} 次 JSON 解析失败：{}。尝试修复...", attempt + 1, e);
                buffer = repair_truncated_json(content);
            }
            Err(e) => {
                return Err(format!(
                    "JSON 路线图解析失败（共 {} 次尝试）：{}\n内容预览：{}...",
                    attempt + 1,
                    e,
                    &buffer.chars().take(300).collect::<String>()
                ));
            }
        }
    }

    Err("JSON 路线图解析失败，已尝试所有方式".to_string())
}

fn fix_null_to_zero(v: &mut serde_json::Value) {
    match v {
        serde_json::Value::Object(map) => {
            for val in map.values_mut() {
                fix_null_to_zero(val);
            }
        }
        serde_json::Value::Array(arr) => {
            for val in arr.iter_mut() {
                fix_null_to_zero(val);
            }
        }
        serde_json::Value::Null => {
            *v = serde_json::Value::Number(0.into());
        }
        _ => {}
    }
}

fn repair_truncated_json(s: &str) -> String {
    let s = s.trim().to_string();

    let s = s
        .strip_prefix("```json")
        .or_else(|| s.strip_prefix("```"))
        .unwrap_or(&s)
        .trim();
    let s = s
        .strip_suffix("```")
        .unwrap_or(s)
        .trim()
        .to_string();

    let mut result = s;
    let mut in_string = false;
    let mut escape_next = false;

    for ch in result.chars() {
        if escape_next {
            escape_next = false;
            continue;
        }
        if ch == '\\' {
            escape_next = true;
            continue;
        }
        if ch == '"' {
            in_string = !in_string;
        }
    }

    if in_string {
        result.push('"');
    }

    // Count unmatched brackets
    let mut brace_depth: i32 = 0;
    let mut bracket_depth: i32 = 0;
    in_string = false;
    escape_next = false;

    for ch in result.chars() {
        if escape_next {
            escape_next = false;
            continue;
        }
        if ch == '\\' {
            escape_next = true;
            continue;
        }
        if ch == '"' {
            in_string = !in_string;
            continue;
        }
        if !in_string {
            match ch {
                '{' => brace_depth += 1,
                '}' => brace_depth -= 1,
                '[' => bracket_depth += 1,
                ']' => bracket_depth -= 1,
                _ => {}
            }
        }
    }

    for _ in 0..bracket_depth.max(0) {
        result.push(']');
    }
    for _ in 0..brace_depth.max(0) {
        result.push('}');
    }

    result
}

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
    /// Generate a learning roadmap based on the request
    async fn generate_roadmap(
        &self,
        client: &Client,
        request: &RoadmapRequest,
        api_key: &str,
    ) -> Result<RoadmapResponse, String>;

    /// Send a chat message and return the response
    async fn chat(
        &self,
        client: &Client,
        messages: &[(&str, &str)],
        api_key: &str,
    ) -> Result<String, String>;

    /// Get the provider type
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

fn build_roadmap_prompt(request: &RoadmapRequest) -> String {
    format!(
        r#"你是一位精通「过关模式」的学习路线图设计师，擅长创建深入、系统、实用的学习路线。

## 学习主题
你想学习：{}

## 学习者背景
- 当前水平：{}
- 学习目标：{}
- 每周学习时间：{}小时
- 学习周期：{}周
- 难度偏好：{}

## 过关模式设计理念
1. 结构：学习 → 测验 → 学习 → 测验 → ... → 项目
2. 学习阶段：4-6个任务，系统构建知识体系
3. 测验阶段：5-8道选择题，深度测试理解和应用
4. 项目阶段（如有）：综合应用，验证实际能力
5. 第一关自动解锁，后续关卡必须通过前置测验解锁

## 过关标准
- 及格分数：默认70%
- 题目应测试理解、应用和分析能力，而非单纯记忆
- 每道题需包含详细解析，帮助学习者深入理解

## 内容深度要求
- **任务内容**：每个任务的 content 字段必须是详细的 Markdown 格式，包含：
  - 核心概念解释（用通俗语言 + 专业术语）
  - 原理说明（为什么重要、如何工作）
  - 实际应用场景
  - 常见误区和注意事项
  - 至少 200-400 字的详细内容
- **代码示例**：code_example 字段必须提供完整、可运行的代码示例，包含注释说明
- **练习题**：exercise 字段必须设计实践性强的练习，包含具体要求
- **测验题目**：每道选择题的 explanation 必须详细解释正确答案和错误选项

## 学习资源推荐要求（非常重要）
- 每个学习任务必须包含 2-4 个高质量的推荐资源
- **URL 必须是真实有效的**，推荐以下来源：
  - 官方文档（如官网 docs、GitHub）
  - 知名教程平台（如 Coursera、Udemy、freeCodeCamp）
  - 技术博客（如 Medium、Dev.to、知乎专栏）
  - YouTube 教学视频
  - 知名书籍的在线版本
- **snippet 必须写清楚这个资源解决了什么问题、为什么推荐它**
- 资源类型标注为：documentation（文档）、video（视频）、course（课程）、article（文章）

## 输出JSON格式（严格遵循）：
{{
  "id": "uuid",
  "title": "路线图标题",
  "description": "路线图描述（50-100字，说明学习路径和预期成果）",
  "estimated_total_hours": 总小时数,
  "stages": [
    {{
      "id": "uuid",
      "order": 1,
      "name": "阶段名称",
      "objective": "阶段目标（详细说明本阶段要掌握的核心能力）",
      "estimated_hours": 小时数,
      "stage_type": "learning|quiz|project",
      "is_locked": false,
      "pass_threshold": 0.7,
      "tasks": [
        {{
          "id": "uuid",
          "title": "任务标题",
          "content": "任务的详细Markdown内容（200-400字，包含概念、原理、应用、注意事项）",
          "task_type": "reading|exercise|project|video",
          "code_example": "完整可运行的代码示例（包含注释）",
          "exercise": "实践性练习题（包含具体要求和验收标准）",
          "resources": [
            {{
              "title": "资源标题（书名/课程名/文章标题）",
              "url": "真实有效的URL地址",
              "snippet": "这个资源具体讲了什么，为什么推荐（30-80字）",
              "resource_type": "documentation|video|course|article"
            }}
          ]
        }}
      ],
      "quiz": {{
        "questions": [
          {{
            "id": "uuid",
            "question": "题目文本（清晰、具体）",
            "options": ["选项A", "选项B", "选项C", "选项D"],
            "correct_index": 0,
            "explanation": "详细解析（解释正确答案，说明错误选项为什么错）"
          }}
        ],
        "passing_score": 0.7,
        "time_limit_minutes": null
      }}
    }}
  ]
}}

## 要求
- 生成5-8个阶段，结构为"学习→测验"交替模式，最后以项目收尾
- 每个学习阶段包含4-6个任务，内容深入系统
- 每个测验阶段包含5-8道选择题，覆盖本阶段所有核心知识点
- 任务类型要多样化（阅读、练习、项目、视频）
- 包含现实的时间估算（每个任务 1-3 小时）
- 主题递进（基础概念 → 核心原理 → 实践应用 → 高级技巧 → 综合项目）
- quiz阶段不需要tasks数组，learning/project阶段不需要quiz对象
- 每个任务必须包含详细的 content、code_example 和 exercise
- 测验题目的 explanation 必须详细，帮助学习者理解

返回纯JSON，不要有其他文本。"#,
        request.topic,
        request.level,
        request.goal,
        request.weekly_hours,
        request.total_weeks,
        request.difficulty
    )
}

pub struct OpenAiProvider;

impl OpenAiProvider {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl AiProvider for OpenAiProvider {
    async fn generate_roadmap(
        &self,
        client: &Client,
        request: &RoadmapRequest,
        api_key: &str,
    ) -> Result<RoadmapResponse, String> {
        let prompt = build_roadmap_prompt(request);

        let request_body = serde_json::json!({
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "system",
                    "content": "你是一位学习路线图设计专家。始终返回符合要求格式的有效 JSON。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7,
            "max_tokens": 32000
        });

        let response = client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .header("Accept-Encoding", "identity")
            .json(&request_body)
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(|e| format!("请求失败：{}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("OpenAI 接口错误：{}", error_text);
            return Err(format!("API 错误：{}", error_text));
        }

        let chat_response: OpenAIChatResponse = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败：{}", e))?;

        let content = chat_response
            .choices
            .first()
            .ok_or("无响应选项")?
            .message
            .content
            .clone();

        parse_roadmap_json(&content)
    }

    async fn chat(
        &self,
        client: &Client,
        messages: &[(&str, &str)],
        api_key: &str,
    ) -> Result<String, String> {
        let openai_messages: Vec<serde_json::Value> = messages
            .iter()
            .map(|(role, content)| {
                serde_json::json!({
                    "role": role,
                    "content": content
                })
            })
            .collect();

        let request_body = serde_json::json!({
            "model": "gpt-4o",
            "messages": openai_messages,
            "temperature": 0.7,
            "max_tokens": 2000,
            "stream": true
        });

        let response = client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .header("Accept-Encoding", "identity")
            .json(&request_body)
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(|e| format!("请求失败：{}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("API 错误：{}", error_text));
        }

        // Parse SSE stream
        let mut full_content = String::new();
        let text = response.text().await.map_err(|e| format!("读取响应失败：{}", e))?;

        for line in text.lines() {
            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    break;
                }
                if let Ok(chunk) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(delta) = chunk.get("choices").and_then(|c| c.get(0)).and_then(|c| c.get("delta")) {
                        if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                            full_content.push_str(content);
                        }
                    }
                }
            }
        }

        Ok(full_content)
    }

    fn provider_type(&self) -> AiProviderType {
        AiProviderType::OpenAI
    }
}

// Claude Provider
pub struct ClaudeProvider;

impl ClaudeProvider {
    pub fn new() -> Self {
        Self
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum ClaudeContentBlock {
    Text { text: String },
}

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContentBlock>,
}

#[async_trait]
impl AiProvider for ClaudeProvider {
    async fn generate_roadmap(
        &self,
        client: &Client,
        request: &RoadmapRequest,
        api_key: &str,
    ) -> Result<RoadmapResponse, String> {
        let prompt = build_roadmap_prompt(request);

        let request_body = serde_json::json!({
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 32000,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        });

        let response = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .header("Accept-Encoding", "identity")
            .json(&request_body)
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(|e| format!("请求失败：{}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("Claude 接口错误：{}", error_text);
            return Err(format!("API 错误：{}", error_text));
        }

        let claude_response: ClaudeResponse = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败：{}", e))?;

        let content = claude_response
            .content
            .first()
            .ok_or("无响应内容")?;

        let content_str = match content {
            ClaudeContentBlock::Text { text } => text.clone(),
        };

        // Parse the JSON response
        parse_roadmap_json(&content_str)
    }

    async fn chat(
        &self,
        client: &Client,
        messages: &[(&str, &str)],
        api_key: &str,
    ) -> Result<String, String> {
        let anthropic_messages: Vec<serde_json::Value> = messages
            .iter()
            .map(|(role, content)| {
                serde_json::json!({
                    "role": role,
                    "content": content
                })
            })
            .collect();

        let request_body = serde_json::json!({
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 2000,
            "messages": anthropic_messages
        });

        let response = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .header("Accept-Encoding", "identity")
            .json(&request_body)
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(|e| format!("请求失败：{}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("API 错误：{}", error_text));
        }

        let claude_response: ClaudeResponse = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败：{}", e))?;

        let content = claude_response
            .content
            .first()
            .ok_or("无响应内容")?;

        let content_str = match content {
            ClaudeContentBlock::Text { text } => text.clone(),
        };

        Ok(content_str)
    }

    fn provider_type(&self) -> AiProviderType {
        AiProviderType::Claude
    }
}

// Gemini Provider
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
    async fn generate_roadmap(
        &self,
        client: &Client,
        request: &RoadmapRequest,
        api_key: &str,
    ) -> Result<RoadmapResponse, String> {
        let prompt = build_roadmap_prompt(request);

        let request_body = serde_json::json!({
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 32000
            }
        });

        let response = client
            .post(format!(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}",
                api_key
            ))
            .header("Content-Type", "application/json")
            .header("Accept-Encoding", "identity")
            .json(&request_body)
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(|e| format!("请求失败：{}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("Gemini 接口错误：{}", error_text);
            return Err(format!("API 错误：{}", error_text));
        }

        let gemini_response: GeminiResponse = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败：{}", e))?;

        if let Some(error) = gemini_response.error {
            return Err(format!("Gemini 错误 {}：{}", error.code, error.message));
        }

        let content = gemini_response
            .candidates
            .and_then(|c| c.into_iter().next())
            .and_then(|c| {
                c.content.parts.into_iter().next().and_then(|p| p.text)
            })
            .ok_or("无响应内容")?;

        parse_roadmap_json(&content)
    }

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
                    "parts": [{
                        "text": content
                    }]
                })
            })
            .collect();

        let request_body = serde_json::json!({
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 2000
            }
        });

        let response = client
            .post(format!(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}",
                api_key
            ))
            .header("Content-Type", "application/json")
            .header("Accept-Encoding", "identity")
            .json(&request_body)
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(|e| format!("请求失败：{}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("API 错误：{}", error_text));
        }

        let gemini_response: GeminiResponse = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败：{}", e))?;

        if let Some(error) = gemini_response.error {
            return Err(format!("Gemini 错误 {}：{}", error.code, error.message));
        }

        let content = gemini_response
            .candidates
            .and_then(|c| c.into_iter().next())
            .and_then(|c| {
                c.content.parts.into_iter().next().and_then(|p| p.text)
            })
            .ok_or("无响应内容")?;

        Ok(content)
    }

    fn provider_type(&self) -> AiProviderType {
        AiProviderType::Gemini
    }
}

// Custom Provider for user-configured API endpoints (DeepSeek, custom models, etc.)
pub struct CustomProvider {
    pub base_url: String,
    pub model: String,
}

impl CustomProvider {
    pub fn new(base_url: String, model: String) -> Self {
        Self { base_url, model }
    }

    async fn chat(&self, client: &Client, messages: &[(&str, &str)], api_key: &str) -> Result<String, String> {
        let openai_messages: Vec<serde_json::Value> = messages
            .iter()
            .map(|(role, content)| {
                serde_json::json!({
                    "role": role,
                    "content": content
                })
            })
            .collect();

        let request_body = serde_json::json!({
            "model": self.model,
            "messages": openai_messages,
            "temperature": 0.7,
            "max_tokens": 2000,
            "stream": false
        });

        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));

        let response = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .header("Accept-Encoding", "identity")
            .json(&request_body)
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(|e| format!("请求失败：{}", e))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            error!("自定义接口错误：{}", body);
            return Err(format!("API 错误：{}", body));
        }

        let raw = response.text().await.map_err(|e| {
            error!("读取响应体失败: {}", e);
            format!("读取响应失败: {}", e)
        })?;
        info!("自定义接口响应前300字符: {}", &raw[..raw.len().min(300)]);

        let chat_response: OpenAIChatResponse = serde_json::from_str(&raw)
            .map_err(|e| {
                error!("JSON解析失败: {}。原始响应: {}", e, &raw[..raw.len().min(500)]);
                format!("解析响应失败: {}", e)
            })?;

        let content = chat_response
            .choices
            .first()
            .ok_or("没有响应选项")?
            .message
            .content
            .clone();

        Ok(content)
    }
}

#[async_trait]
impl AiProvider for CustomProvider {
    async fn generate_roadmap(
        &self,
        client: &Client,
        request: &RoadmapRequest,
        api_key: &str,
    ) -> Result<RoadmapResponse, String> {
        let prompt = build_roadmap_prompt(request);

        let request_body = serde_json::json!({
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是一位学习路线图设计专家。始终返回符合要求格式的有效 JSON。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7,
            "max_tokens": 32000
        });

        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));

        let response = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .header("Accept-Encoding", "identity")
            .json(&request_body)
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(|e| format!("请求失败：{}", e))?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            error!("自定义接口错误：{}", body);
            return Err(format!("API 错误：{}", body));
        }

        let raw = response.text().await.map_err(|e| {
            error!("读取生成响应体失败: {}", e);
            format!("读取响应失败: {}", e)
        })?;
        info!("自定义接口生成响应前300字符: {}", &raw[..raw.len().min(300)]);

        let chat_response: OpenAIChatResponse = serde_json::from_str(&raw)
            .map_err(|e| {
                error!("JSON解析失败: {}。原始响应: {}", e, &raw[..raw.len().min(500)]);
                format!("解析响应失败: {}", e)
            })?;

        let content = chat_response
            .choices
            .first()
            .ok_or("无响应选项")?
            .message
            .content
            .clone();

        parse_roadmap_json(&content)
    }

    async fn chat(
        &self,
        client: &Client,
        messages: &[(&str, &str)],
        api_key: &str,
    ) -> Result<String, String> {
        self.chat(client, messages, api_key).await
    }

    fn provider_type(&self) -> AiProviderType {
        AiProviderType::Custom
    }
}

/// Get the appropriate AI provider instance
pub fn get_provider(provider_name: &str) -> Box<dyn AiProvider> {
    match provider_name.to_lowercase().as_str() {
        "claude" | "anthropic" => Box::new(ClaudeProvider::new()),
        "gemini" => Box::new(GeminiProvider::new()),
        _ => Box::new(OpenAiProvider::new()),
    }
}

/// Get the appropriate AI provider instance with custom configuration
pub fn get_provider_with_config(provider_name: &str, base_url: &str, model: &str) -> Box<dyn AiProvider> {
    match provider_name.to_lowercase().as_str() {
        "claude" | "anthropic" => Box::new(ClaudeProvider::new()),
        "gemini" => Box::new(GeminiProvider::new()),
        "custom" | "deepseek" | _ => Box::new(CustomProvider::new(base_url.to_string(), model.to_string())),
    }
}
pub fn build_outline_prompt(topic: &str, goal: &str, level: &str) -> String {
    format!(
        r#"你是一位精通「过关模式」的学习路线设计师。请为以下学习主题生成一个5-8阶段的路线大纲。

## 学习主题（必须严格围绕此主题）
{}

## 你的学习目标
{}

## 当前水平
{}

## 严格要求
- 所有的阶段内容都必须围绕「{}」这个主题，绝不能偏题
- 例如主题是「Java Web」，所有阶段必须是 Java Web 相关（如 Servlet、JSP、Spring、SpringBoot、数据库连接、Web 安全等）
- 不得生成其他技术领域的内容
- 生成 5-8 个阶段，覆盖从基础到深入的完整学习路径
- 每个阶段只输出：标题 + 简短描述（50-100字）
- 不包含任务细节、不包含测验、不包含资源
- 主题递进：基础概念 → 核心原理 → 实践应用 → 高级技巧 → 综合项目
- 最后1-2个阶段应为综合项目

## 输出 JSON 格式（严格遵循）
{{
  "stages": [
    {{"order": 1, "title": "阶段标题", "brief": "该阶段简要描述（50-100字，说明学什么、为什么重要）"}},
    {{"order": 2, "title": "阶段标题", "brief": "..."}}
  ]
}}

返回纯JSON，不要其他文本。"#,
        topic, goal, level, topic
    )
}

pub fn build_stage_detail_prompt(
    topic: &str,
    goal: &str,
    level: &str,
    _total_stages: usize,
    current_order: usize,
    all_stage_titles: &[String],
    stage_title: &str,
    stage_brief: &str,
) -> String {
    let titles_list = all_stage_titles.iter()
        .enumerate()
        .map(|(i, t)| format!("  阶段{}: {}", i + 1, t))
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        r#"你是一位精通「过关模式」的学习路线图设计师。请为学习主题「{}」的第 {} 个阶段设计详细内容。

**【最重要】所有内容必须严格围绕主题「{}」**，不得偏题到任何其他技术领域（例如：主题是 Java Web 时，资源 URL 不能指向 Python、JavaScript 前端以外的内容；代码示例必须是 Java/Spring 等相关代码）。

## 整体学习主题（绝对不可偏离）
{}

## 学习者的目标
{}

## 学习者水平
{}

## 完整路线阶段总览
{}
当前阶段为：阶段{} - {}（阶段标题）

## 该阶段简要描述
{}

## 内容设计要求
- stage_description：本阶段的详细目标描述（100-200字）
- tasks：生成 4-6 个学习任务
  - 每个任务 title 清晰明确
  - content 200-400 字 Markdown，包含概念解释、原理说明、应用场景、注意事项
  - task_type 多样化：reading、exercise、project、video
  - code_example：必须提供与主题「{}」相关的可运行代码示例
  - exercise：可选的练习题
  - resources：每个任务 2-4 个推荐资源
    - URL 必须是真实可访问的（如官方文档、知名课程平台、GitHub、YouTube）
    - 资源内容必须与「{}」直接相关
    - resource_type：documentation、video、course、article
- flashcards：基于本阶段内容生成 2-3 个记忆卡片（问题+答案）

## 输出 JSON 格式（严格遵循）
{{
  "stage_description": "该阶段详细描述...",
  "tasks": [
    {{
      "title": "任务标题",
      "content": "任务详细内容（200-400字 Markdown）",
      "task_type": "reading",
      "code_example": "可选代码",
      "exercise": "可选练习",
      "resources": [
        {{"title": "资源标题", "url": "https://...", "snippet": "推荐理由", "resource_type": "article"}}
      ]
    }}
  ],
  "flashcards": [
    {{"question": "问题", "answer": "答案"}}
  ]
}}

返回纯JSON，不要其他文本。"#,
        topic, current_order, topic,
        topic, goal, level, titles_list, current_order, stage_title, stage_brief,
        topic, topic
    )
}

pub fn build_stage_outline_only_prompt(
    topic: &str,
    level: &str,
    current_order: usize,
    stage_title: &str,
    stage_brief: &str,
) -> String {
    format!(
        r#"你是一位学习路线设计师。为主题「{topic}」的第 {current_order} 个阶段「{stage_title}」设计任务骨架（不要生成详细内容，只生成标题和类型）。

## 阶段标题
{stage_title}

## 阶段简介
{stage_brief}

## 学习者水平
{level}

## 严格要求
- 所有任务必须围绕「{topic}」和本阶段主题
- 生成 4-6 个学习任务（reading/视频/练习/项目）
- 只输出任务标题和类型，不输出任何 content、code_example、exercise、resources

## 输出 JSON 格式（严格遵循）
{{
  "stage_description": "本阶段的详细目标描述（100-200字）",
  "tasks": [
    {{"order": 1, "title": "任务标题", "task_type": "reading"}},
    {{"order": 2, "title": "任务标题", "task_type": "exercise"}},
    {{"order": 3, "title": "任务标题", "task_type": "project"}}
  ]
}}

返回纯JSON，不要其他文本。"#
    )
}

pub fn build_task_content_prompt(
    topic: &str,
    stage_title: &str,
    stage_description: &str,
    task_title: &str,
    task_type: &str,
) -> String {
    format!(
        r#"你是一位学习内容专家。为主题「{topic}」中阶段「{stage_title}」的某个任务编写详细学习内容，并推荐学习资源。

## 任务信息
- 任务标题：{task_title}
- 任务类型：{task_type}
- 所属阶段：{stage_title}
- 阶段目标：{stage_description}

## 内容要求
- 所有内容必须围绕「{topic}」和当前任务主题
- code_example 必须与主题「{topic}」相关（如果是 Java Web 主题，代码必须是 Java/Spring 等）
- content 200-400 字 Markdown：概念解释、原理说明、应用场景、注意事项

## 资源推荐要求（非常重要）

**优先级：先国内再国外**
1. **首选国内平台**（必须是真实稳定的 URL）：
   - Bilibili（bilibili.com）上的优质教学视频
   - 慕课网/imooc、网易云课堂等中文课程平台
   - 掘金（juejin.cn）、思否（segmentfault.com）、CSDN、知乎专栏的中文技术文章
   - 阿里云开发者社区、腾讯云社区
   - 国内 GitHub 镜像或 Gitee 上的中文项目
2. **次选稳定平台**（避免个人博客）：
   - 官方文档（域名不含 blog/wordpress/personal）
   - GitHub 开源项目（star > 500）
   - YouTube/YouTube中文频道
   - Coursera、Udemy 等知名课程平台

**避免无法打开的链接：**
- ❌ 不要推荐个人博客（xxx.github.io/blog、xxx.wordpress.com 等），这些经常过期
- ❌ 不要推荐短链接（bit.ly、t.cn 等）
- ❌ 不要推荐需要登录才能查看的页面
- ✅ 推荐大平台的主域名（bilibili.com/video/xxx，不是 b23.tv）
- ✅ 推荐官方文档（docs.xxx.com、xxx.org/docs，不是 xxx.com/blog）
- ✅ URL 必须是完整且真实可访问的

**其他要求：**
- 每个任务推荐 2-4 个资源，**国内资源优先排在前面**
- snippet 写明该资源解决了什么问题（20-50字，中文）
- resource_type 用：documentation、video、course、article
- 生成 1-2 个记忆卡片（问题+答案），帮助记忆本任务核心概念

## 输出 JSON 格式（严格遵循）
{{
  "content": "任务详细 Markdown 内容（200-400字）",
  "code_example": "可运行的代码示例（如果适用）",
  "exercise": "实践练习题（如果适用）",
  "resources": [
    {{"title": "资源标题（中文优先）", "url": "https://...", "snippet": "推荐理由（中文，20-50字）", "resource_type": "article"}}
  ],
  "flashcards": [
    {{"question": "问题（中文）", "answer": "答案（中文）"}}
  ]
}}

返回纯JSON，不要其他文本。"#
    )
}
