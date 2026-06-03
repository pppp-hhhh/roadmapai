use crate::services::parallel::StageOutline;
use serde::Deserialize;
use tracing::warn;

#[derive(Deserialize)]
struct AiResource {
    title: String,
    url: String,
    snippet: Option<String>,
    resource_type: String,
}

fn strip_thinking_tags(s: &str) -> String {
    let s = remove_tagged_blocks(s, "think");
    let s = remove_tagged_blocks(&s, "thinking");
    let s = remove_tagged_blocks(&s, "reasoning");
    s
}

fn remove_tagged_blocks(s: &str, tag: &str) -> String {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);
    let mut result = String::with_capacity(s.len());
    let mut pos = 0;
    while let Some(start) = s[pos..].find(&open) {
        result.push_str(&s[pos..pos + start]);
        let after_open = pos + start + open.len();
        if let Some(end) = s[after_open..].find(&close) {
            pos = after_open + end + close.len();
        } else {
            pos = after_open;
        }
    }
    result.push_str(&s[pos..]);
    result
}

pub fn clean_json(s: &str) -> String {
    let mut result = strip_thinking_tags(s);
    result = result.trim().to_string();
    for _ in 0..3 {
        let trimmed = result.trim().to_string();
        let stripped = trimmed
            .strip_prefix("```json").or_else(|| trimmed.strip_prefix("```markdown")).or_else(|| trimmed.strip_prefix("```"))
            .unwrap_or(&trimmed);
        let stripped = stripped.trim();
        let stripped = stripped.strip_suffix("```").unwrap_or(stripped);
        result = stripped.trim().to_string();
    }
    result = fix_invalid_json_escapes(&result);
    result = remove_trailing_commas(&result);
    result
}

fn fix_invalid_json_escapes(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    let mut result = String::with_capacity(s.len());
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c == '\\' && i + 1 < chars.len() {
            let next = chars[i + 1];
            if matches!(next, '"' | '\\' | '/' | 'b' | 'f' | 'n' | 'r' | 't' | 'u') {
                result.push(c); result.push(next); i += 2;
            } else {
                result.push(next); i += 2;
            }
        } else {
            result.push(c); i += 1;
        }
    }
    result
}

fn remove_trailing_commas(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let chars: Vec<char> = s.chars().collect();
    let mut i = 0;
    let mut in_string = false;
    let mut escape = false;
    while i < chars.len() {
        let c = chars[i];
        result.push(c);
        if escape { escape = false; i += 1; continue; }
        match c {
            '"' => in_string = !in_string,
            '\\' if in_string => escape = true,
            _ => {}
        }
        if !in_string && c == ',' {
            let mut j = i + 1;
            while j < chars.len() && chars[j].is_whitespace() { j += 1; }
            if j < chars.len() && (chars[j] == '}' || chars[j] == ']') {
                result.pop();
                i += 1;
                while i < chars.len() && chars[i].is_whitespace() { result.push(chars[i]); i += 1; }
                continue;
            }
        }
        i += 1;
    }
    result
}

fn extract_content_by_regex(raw: &str) -> Option<String> {
    let re = regex_lite::Regex::new(r#""content"\s*:\s*"((?:[^"\\]|\\.)*)""#).ok()?;
    re.captures(raw).and_then(|caps| caps.get(1)).map(|m| m.as_str().to_string())
}

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
                if escape { escape = false; j += 1; continue; }
                if in_string {
                    if ch == '\\' { escape = true; } else if ch == '"' { in_string = false; }
                    j += 1; continue;
                }
                match ch {
                    '"' => in_string = true,
                    '{' if open_brace => depth += 1,
                    '}' if open_brace => { depth -= 1; if depth == 0 { return Some(&s[i..=j]); } }
                    '[' if !open_brace => depth += 1,
                    ']' if !open_brace => { depth -= 1; if depth == 0 { return Some(&s[i..=j]); } }
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
    if let Ok(v) = serde_json::from_str::<T>(&cleaned) { return Ok(v); }
    if let Some(span) = extract_json_span(input) {
        let fixed = fix_invalid_json_escapes(span);
        if let Ok(v) = serde_json::from_str::<T>(&fixed) { return Ok(v); }
        if let Ok(v) = serde_json::from_str::<T>(&clean_json(&fixed)) { return Ok(v); }
    }
    let mut v: serde_json::Value = serde_json::from_str(&cleaned)
        .or_else(|_| extract_json_span(input).map(|s| fix_invalid_json_escapes(s)).and_then(|s| serde_json::from_str(&s).ok())
            .ok_or_else(|| format!("Value 解析失败")))
        .map_err(|e| format!("{}", e))?;
    fix_null_to_zero(&mut v);
    serde_json::from_value(v).map_err(|e| format!("Value 解析后类型转换失败: {}", e))
}

pub fn fix_null_to_zero(v: &mut serde_json::Value) {
    match v {
        serde_json::Value::Object(map) => { for val in map.values_mut() { fix_null_to_zero(val); } }
        serde_json::Value::Array(arr) => { for val in arr.iter_mut() { fix_null_to_zero(val); } }
        serde_json::Value::Null => { *v = serde_json::Value::Number(0.into()); }
        _ => {}
    }
}

pub fn repair_truncated_json(s: &str) -> String {
    let s = s.trim().to_string();
    let s = s.strip_prefix("```json").or_else(|| s.strip_prefix("```")).unwrap_or(&s).trim();
    let s = s.strip_suffix("```").unwrap_or(s).trim().to_string();
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
                '{' => brace_depth += 1, '}' => brace_depth -= 1,
                '[' => bracket_depth += 1, ']' => bracket_depth -= 1,
                _ => {}
            }
        }
    }
    for _ in 0..bracket_depth.max(0) { result.push(']'); }
    for _ in 0..brace_depth.max(0) { result.push('}'); }
    result
}

pub struct OutlineResult {
    pub stages: Vec<StageOutline>,
    pub suggested_weekly_hours: u32,
    pub suggested_total_weeks: u32,
    pub estimated_total_hours: f64,
}

pub fn parse_outline_response(raw: &str) -> Result<OutlineResult, String> {
    #[derive(Deserialize)]
    struct OutlineWrapper {
        stages: Vec<StageOutline>,
        #[serde(default)] suggested_weekly_hours: Option<f64>,
        #[serde(default)] suggested_total_weeks: Option<f64>,
        #[serde(default)] estimated_total_hours: Option<f64>,
    }
    let mut buffer = raw.to_string();
    for attempt in 0..3 {
        match try_parse_with_extraction::<OutlineWrapper>(&buffer) {
            Ok(w) => {
                let weekly = w.suggested_weekly_hours.unwrap_or(10.0).max(1.0) as u32;
                let total_weeks = w.suggested_total_weeks.unwrap_or(8.0).max(1.0) as u32;
                let total_hours = w.estimated_total_hours.unwrap_or(weekly as f64 * total_weeks as f64);
                return Ok(OutlineResult { stages: w.stages, suggested_weekly_hours: weekly, suggested_total_weeks: total_weeks, estimated_total_hours: total_hours });
            }
            Err(e) if attempt == 0 => { warn!("大纲 JSON 第 1 次解析失败：{}。尝试修复...", e); buffer = repair_truncated_json(raw); }
            Err(e) => return Err(format!("大纲 JSON 解析失败：{}", e)),
        }
    }
    Err("大纲 JSON 解析失败".to_string())
}

pub fn parse_stage_outline_only_response(raw: &str, order: usize, fallback_title: &str) -> Result<crate::services::parallel::StageOutlineOnly, String> {
    use crate::services::parallel::{StageOutlineOnly, TaskOutline};
    #[derive(Deserialize)]
    struct Wrapper { stage_description: Option<String>, description: Option<String>, tasks: Option<Vec<TaskOutlineWrapper>> }
    #[derive(Deserialize)]
    struct TaskOutlineWrapper { order: Option<usize>, title: String, task_type: Option<String> }
    let mut buffer = raw.to_string();
    for attempt in 0..3 {
        let result: Result<StageOutlineOnly, String> = (|| {
            let cleaned = clean_json(&buffer);
            let mut v: serde_json::Value = serde_json::from_str(&cleaned)
                .or_else(|_| extract_json_span(&buffer).and_then(|s| serde_json::from_str(s).ok()).ok_or_else(|| format!("Value 解析失败")))?;
            fix_null_to_zero(&mut v);
            let w: Wrapper = serde_json::from_value(v).map_err(|e| format!("结构解析失败: {}", e))?;
            let desc = w.stage_description.or(w.description).unwrap_or_default();
            let tasks = w.tasks.unwrap_or_default().into_iter().enumerate().map(|(i, t)| TaskOutline {
                order: t.order.unwrap_or(i + 1), title: t.title, task_type: t.task_type.unwrap_or_else(|| "reading".to_string()),
            }).collect();
            Ok(StageOutlineOnly { order, title: fallback_title.to_string(), description: desc, task_outlines: tasks })
        })();
        match result {
            Ok(v) => return Ok(v),
            Err(e) if attempt == 0 => { warn!("阶段骨架 JSON 第 1 次解析失败：{}。尝试修复...", e); buffer = repair_truncated_json(raw); }
            Err(e) => return Err(format!("阶段骨架 JSON 解析失败：{}", e)),
        }
    }
    Err("阶段骨架 JSON 解析失败".to_string())
}

pub fn parse_task_content_response(raw: &str, order: usize, title: &str, task_type: &str) -> Result<crate::services::parallel::TaskContent, String> {
    use crate::services::parallel::{FlashcardItem, ResourceDetail, TaskContent};
    #[derive(Deserialize)]
    struct Wrapper { content: Option<String>, code_example: Option<String>, exercise: Option<String>, resources: Option<Vec<AiResource>>, flashcards: Option<Vec<FlashcardWrapper>> }
    #[derive(Deserialize)]
    struct FlashcardWrapper { question: String, answer: String }
    let mut buffer = raw.to_string();
    for attempt in 0..3 {
        let result: Result<TaskContent, String> = (|| {
            let cleaned = clean_json(&buffer);
            let mut v: serde_json::Value = serde_json::from_str(&cleaned)
                .or_else(|e| extract_json_span(&buffer).map(|s| fix_invalid_json_escapes(s)).and_then(|s| serde_json::from_str(&s).ok())
                    .ok_or_else(|| { let preview: String = buffer.chars().take(200).collect(); format!("Value 解析失败: {} | 前200字: {}", e, preview) }))?;
            fix_null_to_zero(&mut v);
            let w: Wrapper = serde_json::from_value(v).map_err(|e| format!("结构解析失败: {}", e))?;
            let resources = w.resources.unwrap_or_default().into_iter().map(|r| ResourceDetail { title: r.title, url: r.url, snippet: r.snippet, resource_type: r.resource_type }).collect();
            let flashcards = w.flashcards.unwrap_or_default().into_iter().map(|f| FlashcardItem { question: f.question, answer: f.answer }).collect();
            Ok(TaskContent { order, title: title.to_string(), task_type: task_type.to_string(), content: w.content.unwrap_or_default(), code_example: w.code_example, exercise: w.exercise, resources, flashcards })
        })();
        match result {
            Ok(v) => return Ok(v),
            Err(e) if attempt == 0 => { warn!("任务内容 JSON 第 1 次解析失败：{}。尝试修复...", e); buffer = repair_truncated_json(raw); }
            Err(e) => {
                warn!("任务内容 JSON 解析失败（共 3 次）：{}。尝试正则提取...", e);
                if let Some(extracted) = extract_content_by_regex(raw) {
                    warn!("  ✓ 正则提取 content 成功");
                    return Ok(TaskContent { order, title: title.to_string(), task_type: task_type.to_string(), content: extracted, code_example: None, exercise: None, resources: vec![], flashcards: vec![] });
                }
                return Err(format!("任务内容 JSON 解析失败：{}", e));
            }
        }
    }
    Err("任务内容 JSON 解析失败".to_string())
}
