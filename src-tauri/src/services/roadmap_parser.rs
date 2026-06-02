use crate::services::parallel::{FlashcardItem, ResourceDetail, StageDetail, StageOutline, TaskDetail};
use serde::Deserialize;
use tracing::warn;

// AI 返回的资源没有 id 字段，用此 struct 解析
#[derive(Deserialize)]
struct AiResource {
    title: String,
    url: String,
    snippet: Option<String>,
    resource_type: String,
}

fn clean_json(s: &str) -> String {
    let mut result = s.trim().to_string();
    // Repeatedly strip markdown code fences
    for _ in 0..3 {
        let trimmed = result.trim().to_string();
        let stripped = trimmed
            .strip_prefix("```json").or_else(|| trimmed.strip_prefix("```markdown")).or_else(|| trimmed.strip_prefix("```"))
            .unwrap_or(&trimmed);
        let stripped = stripped.trim();
        let stripped = stripped
            .strip_suffix("```").unwrap_or(stripped);
        result = stripped.trim().to_string();
    }
    result
}

/// Find the first balanced JSON object/array in `s` and return its slice
fn extract_json_span(s: &str) -> Option<&str> {
    let bytes = s.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        let c = bytes[i] as char;
        if c == '{' || c == '[' {
            let open_brace = c == '{';
            let mut depth: i32 = 1;
            let mut in_string = false;
            let mut escape = false;
            let mut j = i + 1;

            while j < bytes.len() {
                let ch = bytes[j] as char;
                if escape {
                    escape = false;
                    j += 1;
                    continue;
                }
                if in_string {
                    if ch == '\\' {
                        escape = true;
                    } else if ch == '"' {
                        in_string = false;
                    }
                    j += 1;
                    continue;
                }
                match ch {
                    '"' => in_string = true,
                    '{' if open_brace => depth += 1,
                    '}' if open_brace => {
                        depth -= 1;
                        if depth == 0 { return Some(&s[i..=j]); }
                    }
                    '[' if !open_brace => depth += 1,
                    ']' if !open_brace => {
                        depth -= 1;
                        if depth == 0 { return Some(&s[i..=j]); }
                    }
                    _ => {}
                }
                j += 1;
            }
            return None;
        }
        i += 1;
    }
    None
}

fn try_parse_with_extraction<T: serde::de::DeserializeOwned>(input: &str) -> Result<T, String> {
    let cleaned = clean_json(input);

    if let Ok(v) = serde_json::from_str::<T>(&cleaned) {
        return Ok(v);
    }

    if let Some(span) = extract_json_span(input) {
        if let Ok(v) = serde_json::from_str::<T>(span) {
            return Ok(v);
        }
        if let Ok(v) = serde_json::from_str::<T>(&clean_json(span)) {
            return Ok(v);
        }
    }

    let mut v: serde_json::Value = serde_json::from_str(&cleaned)
        .or_else(|_| extract_json_span(input).and_then(|s| serde_json::from_str(s).ok()).ok_or_else(|| {
            format!("Value 解析失败（无法从响应中提取 JSON）")
        }))?;
    fix_null_to_zero(&mut v);
    serde_json::from_value(v).map_err(|e| format!("Value 解析后类型转换失败: {}", e))
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
        if escape_next { escape_next = false; continue; }
        if ch == '\\' { escape_next = true; continue; }
        if ch == '"' { in_string = !in_string; }
    }
    if in_string { result.push('"'); }

    let mut brace_depth: i32 = 0;
    let mut bracket_depth: i32 = 0;
    in_string = false;
    escape_next = false;
    for ch in result.chars() {
        if escape_next { escape_next = false; continue; }
        if ch == '\\' { escape_next = true; continue; }
        if ch == '"' { in_string = !in_string; continue; }
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
    for _ in 0..bracket_depth.max(0) { result.push(']'); }
    for _ in 0..brace_depth.max(0) { result.push('}'); }
    result
}

pub fn parse_outline_response(raw: &str) -> Result<Vec<StageOutline>, String> {
    #[derive(Deserialize)]
    struct OutlineWrapper {
        stages: Vec<StageOutline>,
    }

    let mut buffer = raw.to_string();
    for attempt in 0..3 {
        match try_parse_with_extraction::<OutlineWrapper>(&buffer) {
            Ok(w) => return Ok(w.stages),
            Err(e) if attempt == 0 => {
                warn!("大纲 JSON 第 1 次解析失败：{}。尝试修复...", e);
                buffer = repair_truncated_json(raw);
            }
            Err(e) => {
                return Err(format!("大纲 JSON 解析失败（共 3 次）：{}", e));
            }
        }
    }
    Err("大纲 JSON 解析失败，已尝试所有方式".to_string())
}

#[derive(Deserialize)]
struct StageDetailWrapper {
    stage_description: Option<String>,
    description: Option<String>,
    tasks: Option<Vec<TaskDetailWrapper>>,
    flashcards: Option<Vec<FlashcardWrapper>>,
}

#[derive(Deserialize)]
struct TaskDetailWrapper {
    title: String,
    content: String,
    task_type: Option<String>,
    code_example: Option<String>,
    exercise: Option<String>,
    resources: Option<Vec<AiResource>>,
}

#[derive(Deserialize)]
struct FlashcardWrapper {
    question: String,
    answer: String,
}

pub fn parse_stage_detail_response(raw: &str, order: usize) -> Result<StageDetail, String> {
    let mut buffer = raw.to_string();
    for attempt in 0..3 {
        let result: Result<StageDetail, String> = (|| {
            let cleaned = clean_json(&buffer);
            let mut v: serde_json::Value = serde_json::from_str(&cleaned)
                .or_else(|_| extract_json_span(&buffer).and_then(|s| serde_json::from_str(s).ok()).ok_or_else(|| {
                    format!("Value 解析失败: 无法从响应中提取 JSON")
                }))?;
            fix_null_to_zero(&mut v);

            let wrapper: StageDetailWrapper = serde_json::from_value(v.clone())
                .map_err(|e| format!("结构解析失败: {}", e))?;

            let desc = wrapper.stage_description
                .or(wrapper.description)
                .unwrap_or_default();

            let tasks = wrapper.tasks.unwrap_or_default().into_iter().map(|t| {
                let task_type = t.task_type.unwrap_or_else(|| "reading".to_string());
                let resources = t.resources.unwrap_or_default().into_iter().map(|r| {
                    ResourceDetail {
                        title: r.title,
                        url: r.url,
                        snippet: r.snippet,
                        resource_type: r.resource_type,
                    }
                }).collect();

                TaskDetail {
                    title: t.title,
                    content: t.content,
                    task_type,
                    code_example: t.code_example,
                    exercise: t.exercise,
                    resources,
                }
            }).collect();

            let flashcards = wrapper.flashcards.unwrap_or_default().into_iter().map(|f| {
                FlashcardItem {
                    question: f.question,
                    answer: f.answer,
                }
            }).collect();

            Ok(StageDetail {
                order,
                title: String::new(),
                description: desc,
                tasks,
                flashcards,
                is_fallback: false,
            })
        })();

        match result {
            Ok(detail) => return Ok(detail),
            Err(e) if attempt == 0 => {
                warn!("阶段详情 JSON 第 1 次解析失败：{}。尝试修复...", e);
                buffer = repair_truncated_json(raw);
            }
            Err(e) => {
                return Err(format!("阶段详情 JSON 解析失败（共 3 次）：{}", e));
            }
        }
    }
    Err("阶段详情 JSON 解析失败，已尝试所有方式".to_string())
}

pub fn parse_stage_outline_only_response(raw: &str, order: usize, fallback_title: &str) -> Result<crate::services::parallel::StageOutlineOnly, String> {
    use crate::services::parallel::{StageOutlineOnly, TaskOutline};
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct Wrapper {
        stage_description: Option<String>,
        description: Option<String>,
        tasks: Option<Vec<TaskOutlineWrapper>>,
    }
    #[derive(Deserialize)]
    struct TaskOutlineWrapper {
        order: Option<usize>,
        title: String,
        task_type: Option<String>,
    }

    let mut buffer = raw.to_string();
    for attempt in 0..3 {
        let result: Result<StageOutlineOnly, String> = (|| {
            let cleaned = clean_json(&buffer);
            let mut v: serde_json::Value = serde_json::from_str(&cleaned)
                .or_else(|_| extract_json_span(&buffer).and_then(|s| serde_json::from_str(s).ok()).ok_or_else(|| {
                    format!("Value 解析失败")
                }))?;
            fix_null_to_zero(&mut v);
            let w: Wrapper = serde_json::from_value(v)
                .map_err(|e| format!("结构解析失败: {}", e))?;
            let desc = w.stage_description.or(w.description).unwrap_or_default();
            let tasks = w.tasks.unwrap_or_default().into_iter().enumerate().map(|(i, t)| {
                TaskOutline {
                    order: t.order.unwrap_or(i + 1),
                    title: t.title,
                    task_type: t.task_type.unwrap_or_else(|| "reading".to_string()),
                }
            }).collect();
            Ok(StageOutlineOnly { order, title: fallback_title.to_string(), description: desc, task_outlines: tasks })
        })();
        match result {
            Ok(v) => return Ok(v),
            Err(e) if attempt == 0 => {
                warn!("阶段骨架 JSON 第 1 次解析失败：{}。尝试修复...", e);
                buffer = repair_truncated_json(raw);
            }
            Err(e) => return Err(format!("阶段骨架 JSON 解析失败：{}", e)),
        }
    }
    Err("阶段骨架 JSON 解析失败".to_string())
}

pub fn parse_task_content_response(raw: &str, order: usize, title: &str, task_type: &str) -> Result<crate::services::parallel::TaskContent, String> {
    use crate::services::parallel::{FlashcardItem, ResourceDetail, TaskContent};
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct Wrapper {
        content: Option<String>,
        code_example: Option<String>,
        exercise: Option<String>,
        resources: Option<Vec<AiResource>>,
        flashcards: Option<Vec<FlashcardWrapper>>,
    }
    #[derive(Deserialize)]
    struct FlashcardWrapper {
        question: String,
        answer: String,
    }

    let mut buffer = raw.to_string();
    for attempt in 0..3 {
        let result: Result<TaskContent, String> = (|| {
            let cleaned = clean_json(&buffer);
            let mut v: serde_json::Value = serde_json::from_str(&cleaned)
                .or_else(|e| {
                    extract_json_span(&buffer).and_then(|s| serde_json::from_str(s).ok()).ok_or_else(|| {
                        let preview: String = buffer.chars().take(200).collect();
                        format!("Value 解析失败: {} | 清理后前200字: {}", e, preview)
                    })
                })?;
            fix_null_to_zero(&mut v);
            let w: Wrapper = serde_json::from_value(v)
                .map_err(|e| format!("结构解析失败: {}", e))?;

            let resources = w.resources.unwrap_or_default().into_iter().map(|r| ResourceDetail {
                title: r.title, url: r.url, snippet: r.snippet, resource_type: r.resource_type,
            }).collect();

            let flashcards = w.flashcards.unwrap_or_default().into_iter().map(|f| FlashcardItem {
                question: f.question, answer: f.answer,
            }).collect();

            Ok(TaskContent {
                order,
                title: title.to_string(),
                task_type: task_type.to_string(),
                content: w.content.unwrap_or_default(),
                code_example: w.code_example,
                exercise: w.exercise,
                resources,
                flashcards,
            })
        })();
        match result {
            Ok(v) => return Ok(v),
            Err(e) if attempt == 0 => {
                warn!("任务内容 JSON 第 1 次解析失败：{}。尝试修复...", e);
                buffer = repair_truncated_json(raw);
            }
            Err(e) => return Err(format!("任务内容 JSON 解析失败：{}", e)),
        }
    }
    Err("任务内容 JSON 解析失败".to_string())
}

pub fn parse_task_augment_response(raw: &str, order: usize) -> Result<crate::services::parallel::TaskAugment, String> {
    use crate::services::parallel::{FlashcardItem, ResourceDetail, TaskAugment};
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct Wrapper {
        resources: Option<Vec<AiResource>>,
        flashcards: Option<Vec<FlashcardWrapper>>,
    }
    #[derive(Deserialize)]
    struct FlashcardWrapper {
        question: String,
        answer: String,
    }

    let mut buffer = raw.to_string();
    for attempt in 0..3 {
        let result: Result<TaskAugment, String> = (|| {
            let cleaned = clean_json(&buffer);
            let mut v: serde_json::Value = serde_json::from_str(&cleaned)
                .or_else(|_| extract_json_span(&buffer).and_then(|s| serde_json::from_str(s).ok()).ok_or_else(|| {
                    format!("Value 解析失败")
                }))?;
            fix_null_to_zero(&mut v);
            let w: Wrapper = serde_json::from_value(v)
                .map_err(|e| format!("结构解析失败: {}", e))?;
            let resources = w.resources.unwrap_or_default().into_iter().map(|r| ResourceDetail {
                title: r.title, url: r.url, snippet: r.snippet, resource_type: r.resource_type,
            }).collect();
            let flashcards = w.flashcards.unwrap_or_default().into_iter().map(|f| FlashcardItem {
                question: f.question, answer: f.answer,
            }).collect();
            Ok(TaskAugment { order, resources, flashcards })
        })();
        match result {
            Ok(v) => return Ok(v),
            Err(e) if attempt == 0 => {
                warn!("任务资源 JSON 第 1 次解析失败：{}。尝试修复...", e);
                buffer = repair_truncated_json(raw);
            }
            Err(e) => return Err(format!("任务资源 JSON 解析失败：{}", e)),
        }
    }
    Err("任务资源 JSON 解析失败".to_string())
}
