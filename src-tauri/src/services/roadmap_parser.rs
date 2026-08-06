use crate::services::parallel::StageOutline;
use regex_lite::Regex;
use serde::Deserialize;
use tracing::warn;

#[derive(Deserialize)]
struct AiResource {
    title: String,
    url: String,
    #[allow(dead_code)] // 保留以兼容历史 AI 输出,实际不再入库
    snippet: Option<String>,
    resource_type: String,
}

fn strip_thinking_tags(s: &str) -> String {
    // 1. 标准 XML 风格 <think>...</think> / <reasoning>...</reasoning>
    let s = remove_tagged_blocks(s, "think");
    let s = remove_tagged_blocks(&s, "thinking");
    let s = remove_tagged_blocks(&s, "reasoning");
    let s = remove_tagged_blocks(&s, "reflection");
    // 2. Markdown 风格 ### 思考 ... / **思考** ... / **Reasoning:** ...
    let s = remove_markdown_thinking_blocks(&s);
    s
}

fn remove_markdown_thinking_blocks(s: &str) -> String {
    // 匹配从 "### 思考" / "**Reasoning:**" 之类到下一个 "###" / ```  / 末尾
    let patterns = [
        // "### 思考" / "### Thought" / "### Reasoning" 到下一个 ### 或 ```
        r"(?si)#{1,6}\s*(?:思考|Thought|Reasoning|Reflection|思考过程|Internal Reasoning)\s*[:：]?[^\n]*\n.*?(?=\n#{1,6}\s|\n```|$)",
        // "**思考:**" / "**Reasoning:**" 块
        r"(?si)\*\*(?:思考|Thought|Reasoning|Reflection|思考过程)[:：]\*\*[^\n]*\n.*?(?=\n#{1,6}\s|\n```|\n\*\*[^*]|$)",
        // "Reasoning:" / "Thought:" 一直到 JSON 起始 {
        r#"(?si)(?:^|\n)(?:Reasoning|Thought|思考|思考过程|Reflection)[:：][^\n]*\n.*?(?=\{\s*"[a-z_]+"\s*:|$)"#,
    ];
    let mut result = s.to_string();
    for p in patterns {
        if let Ok(re) = Regex::new(p) {
            result = re.replace_all(&result, "").to_string();
        }
    }
    result
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
            .strip_prefix("```json")
            .or_else(|| trimmed.strip_prefix("```markdown"))
            .or_else(|| trimmed.strip_prefix("```"))
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
                result.push(c);
                result.push(next);
                i += 2;
            } else {
                result.push(next);
                i += 2;
            }
        } else {
            result.push(c);
            i += 1;
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
        if escape {
            escape = false;
            i += 1;
            continue;
        }
        match c {
            '"' => in_string = !in_string,
            '\\' if in_string => escape = true,
            _ => {}
        }
        if !in_string && c == ',' {
            let mut j = i + 1;
            while j < chars.len() && chars[j].is_whitespace() {
                j += 1;
            }
            if j < chars.len() && (chars[j] == '}' || chars[j] == ']') {
                result.pop();
                i += 1;
                while i < chars.len() && chars[i].is_whitespace() {
                    result.push(chars[i]);
                    i += 1;
                }
                continue;
            }
        }
        i += 1;
    }
    result
}

fn extract_content_by_regex(raw: &str) -> Option<String> {
    // 多种匹配模式:任意空白/换行
    let patterns = [
        r#""content"\s*:\s*"((?:[^"\\]|\\.)*)""#,
        r#""content"\s*:\s*"((?:\\.|[^"\\])*)"#,
    ];
    for p in patterns {
        if let Ok(re) = Regex::new(p) {
            if let Some(caps) = re.captures(raw) {
                if let Some(m) = caps.get(1) {
                    let s = m.as_str();
                    // 反转义常见转义
                    let unescaped = s
                        .replace("\\n", "\n")
                        .replace("\\\"", "\"")
                        .replace("\\\\", "\\")
                        .replace("\\t", "\t");
                    return Some(unescaped);
                }
            }
        }
    }
    None
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
                        if depth == 0 {
                            return Some(&s[i..=j]);
                        }
                    }
                    '[' if !open_brace => depth += 1,
                    ']' if !open_brace => {
                        depth -= 1;
                        if depth == 0 {
                            return Some(&s[i..=j]);
                        }
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
        let fixed = fix_invalid_json_escapes(span);
        if let Ok(v) = serde_json::from_str::<T>(&fixed) {
            return Ok(v);
        }
        if let Ok(v) = serde_json::from_str::<T>(&clean_json(&fixed)) {
            return Ok(v);
        }
    }
    let mut v: serde_json::Value = serde_json::from_str(&cleaned)
        .or_else(|_| {
            extract_json_span(input)
                .map(|s| fix_invalid_json_escapes(s))
                .and_then(|s| serde_json::from_str(&s).ok())
                .ok_or_else(|| format!("Value 解析失败"))
        })
        .map_err(|e| format!("{}", e))?;
    fix_null_to_zero(&mut v);
    serde_json::from_value(v).map_err(|e| format!("Value 解析后类型转换失败: {}", e))
}

pub fn fix_null_to_zero(v: &mut serde_json::Value) {
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

#[derive(Clone, Copy, Debug, PartialEq)]
enum JsonContainer {
    Object,
    Array,
}

#[derive(Clone, Copy)]
struct Container {
    kind: JsonContainer,
    open_index: usize,
    has_content: bool,
}

#[derive(Clone, Copy, PartialEq)]
enum LastJsonToken {
    None,
    OpenObject,
    OpenArray,
    Colon,
    Comma,
    Key,
    Value,
}

#[derive(Clone, Copy)]
enum StringEscape {
    None,
    Backslash,
    Unicode { digits_left: u8, start: usize },
}

fn trim_trailing_separators(out: &mut Vec<char>) {
    while let Some(c) = out.last().copied() {
        if c.is_whitespace() || c == ',' {
            out.pop();
        } else {
            break;
        }
    }
}

fn complete_value_token(out: &mut Vec<char>, start: usize) {
    let token: String = out[start..].iter().collect::<String>();
    let token = token.trim();
    if token.is_empty() {
        out.push('n');
        out.push('u');
        out.push('l');
        out.push('l');
        return;
    }
    if matches!(token, "true" | "false" | "null") {
        return;
    }
    for (full, prefix) in [("true", 't'), ("false", 'f'), ("null", 'n')] {
        if token.starts_with(prefix) && full.starts_with(token) {
            out.extend(full[token.len()..].chars());
            return;
        }
    }

    let mut candidate = token.to_string();
    let mut valid_number = false;
    if candidate == "-" || candidate.ends_with('.') {
        candidate.push('0');
    } else if candidate.ends_with('e')
        || candidate.ends_with('E')
        || candidate.ends_with('+')
        || candidate.ends_with('-')
    {
        candidate.push('0');
    }
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&candidate) {
        valid_number = value.is_number();
    }
    if valid_number {
        out.truncate(start);
        out.extend(candidate.chars());
    } else {
        out.truncate(start);
        out.extend("null".chars());
    }
}

pub fn repair_truncated_json(s: &str) -> String {
    let s = strip_thinking_tags(s);
    let s = s.trim().to_string();
    let s = s
        .strip_prefix("```json")
        .or_else(|| s.strip_prefix("```"))
        .unwrap_or(&s)
        .trim();
    let s = s.strip_suffix("```").unwrap_or(s).trim();
    let chars: Vec<char> = s.chars().collect();

    let mut result: Vec<char> = Vec::with_capacity(chars.len() + 16);
    let mut stack: Vec<Container> = Vec::new();
    let mut key_start: Option<usize> = None;
    let mut value_start: Option<usize> = None;
    let mut last = LastJsonToken::None;
    let mut in_string = false;
    let mut string_is_key = false;
    let mut escape = StringEscape::None;
    let mut i = 0;

    while i < chars.len() {
        if in_string {
            let c = chars[i];
            match escape {
                StringEscape::Unicode { digits_left, start } => {
                    result.push(if c.is_ascii_hexdigit() { c } else { '0' });
                    escape = if digits_left == 1 {
                        StringEscape::None
                    } else {
                        StringEscape::Unicode {
                            digits_left: digits_left - 1,
                            start,
                        }
                    };
                }
                StringEscape::Backslash => match c {
                    'u' => {
                        result.push('u');
                        escape = StringEscape::Unicode {
                            digits_left: 4,
                            start: result.len() - 2,
                        };
                    }
                    '"' | '\\' | '/' | 'b' | 'f' | 'n' | 'r' | 't' => {
                        result.push(c);
                        escape = StringEscape::None;
                    }
                    '\n' | '\r' => {
                        result.push('\\');
                        result.push('n');
                        escape = StringEscape::None;
                    }
                    other => {
                        result.push(other);
                        escape = StringEscape::None;
                    }
                },
                StringEscape::None => {
                    result.push(c);
                    if c == '\\' {
                        escape = StringEscape::Backslash;
                    } else if c == '"' {
                        in_string = false;
                        if string_is_key {
                            last = LastJsonToken::Key;
                        } else {
                            last = LastJsonToken::Value;
                            value_start = None;
                        }
                        string_is_key = false;
                    }
                }
            }
            i += 1;
            continue;
        }

        let c = chars[i];
        if c == '"' {
            let is_key = matches!(stack.last(), Some(c) if c.kind == JsonContainer::Object)
                && matches!(
                    last,
                    LastJsonToken::None | LastJsonToken::OpenObject | LastJsonToken::Comma
                );
            result.push(c);
            in_string = true;
            string_is_key = is_key;
            escape = StringEscape::None;
            if is_key {
                key_start = Some(result.len());
            } else {
                value_start = None;
            }
            i += 1;
            continue;
        }

        match c {
            '{' => {
                stack.push(Container {
                    kind: JsonContainer::Object,
                    open_index: result.len(),
                    has_content: false,
                });
                result.push(c);
                last = LastJsonToken::OpenObject;
                value_start = None;
            }
            '[' => {
                stack.push(Container {
                    kind: JsonContainer::Array,
                    open_index: result.len(),
                    has_content: false,
                });
                result.push(c);
                last = LastJsonToken::OpenArray;
                value_start = None;
            }
            '}' => {
                if matches!(stack.last(), Some(c) if c.kind == JsonContainer::Object) {
                    if let Some(parent) = stack.last_mut() {
                        parent.has_content = true;
                    }
                    result.push(c);
                    stack.pop();
                    if let Some(parent) = stack.last_mut() {
                        parent.has_content = true;
                    }
                    last = LastJsonToken::Value;
                }
                value_start = None;
            }
            ']' => {
                if matches!(stack.last(), Some(c) if c.kind == JsonContainer::Array) {
                    if let Some(parent) = stack.last_mut() {
                        parent.has_content = true;
                    }
                    result.push(c);
                    stack.pop();
                    if let Some(parent) = stack.last_mut() {
                        parent.has_content = true;
                    }
                    last = LastJsonToken::Value;
                }
                value_start = None;
            }
            ':' => {
                result.push(c);
                last = LastJsonToken::Colon;
                key_start = None;
                value_start = None;
            }
            ',' => {
                result.push(c);
                last = LastJsonToken::Comma;
                value_start = None;
            }
            c if c.is_whitespace() => {
                result.push(c);
            }
            c if matches!(
                last,
                LastJsonToken::Colon | LastJsonToken::OpenArray | LastJsonToken::Comma
            ) =>
            {
                if value_start.is_none() {
                    value_start = Some(result.len());
                }
                result.push(c);
                last = LastJsonToken::Value;
            }
            c if value_start.is_some() && !matches!(c, ',' | '}' | ']') => {
                result.push(c);
            }
            _ => {}
        }
        i += 1;
    }

    if in_string {
        match escape {
            StringEscape::Backslash => {
                if result.last() == Some(&'\\') {
                    result.pop();
                }
            }
            StringEscape::Unicode { start, .. } => {
                result.truncate(start);
            }
            StringEscape::None => {}
        }
        if string_is_key {
            remove_incomplete_key(&mut result, &mut stack, &mut last, key_start);
        } else {
            result.push('"');
            last = LastJsonToken::Value;
            if let Some(parent) = stack.last_mut() {
                parent.has_content = true;
            }
        }
    }

    if last == LastJsonToken::Key {
        remove_incomplete_key(&mut result, &mut stack, &mut last, key_start);
    }

    if let Some(start) = value_start {
        complete_value_token(&mut result, start);
        if let Some(parent) = stack.last_mut() {
            parent.has_content = true;
        }
    }

    if last == LastJsonToken::Colon {
        result.extend("null".chars());
    }

    trim_trailing_separators(&mut result);
    for container in stack.iter().rev() {
        match container.kind {
            JsonContainer::Array => result.push(']'),
            JsonContainer::Object => result.push('}'),
        }
    }
    result.into_iter().collect()
}

fn remove_incomplete_key(
    result: &mut Vec<char>,
    stack: &mut Vec<Container>,
    last: &mut LastJsonToken,
    key_start: Option<usize>,
) {
    let Some(start) = key_start else {
        return;
    };
    let drop_object = stack.len() > 1
        && matches!(stack.last(), Some(c) if c.kind == JsonContainer::Object && !c.has_content)
        && matches!(
            stack.get(stack.len() - 2),
            Some(c) if c.kind == JsonContainer::Array
        );
    if drop_object {
        let open_index = stack.pop().map(|c| c.open_index).unwrap_or(0);
        result.truncate(open_index);
        trim_trailing_separators(result);
        *last = LastJsonToken::Comma;
    } else {
        result.truncate(start.saturating_sub(1));
        *last = LastJsonToken::OpenObject;
    }
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
        #[serde(default)]
        suggested_weekly_hours: Option<f64>,
        #[serde(default)]
        suggested_total_weeks: Option<f64>,
        #[serde(default)]
        estimated_total_hours: Option<f64>,
    }
    let mut buffer = raw.to_string();
    for attempt in 0..3 {
        match try_parse_with_extraction::<OutlineWrapper>(&buffer) {
            Ok(w) => {
                let weekly = w.suggested_weekly_hours.unwrap_or(10.0).max(1.0) as u32;
                let total_weeks = w.suggested_total_weeks.unwrap_or(8.0).max(1.0) as u32;
                let total_hours = w
                    .estimated_total_hours
                    .unwrap_or(weekly as f64 * total_weeks as f64);
                return Ok(OutlineResult {
                    stages: w.stages,
                    suggested_weekly_hours: weekly,
                    suggested_total_weeks: total_weeks,
                    estimated_total_hours: total_hours,
                });
            }
            Err(e) if attempt == 0 => {
                warn!("大纲 JSON 第 1 次解析失败：{}。尝试修复...", e);
                buffer = repair_truncated_json(raw);
            }
            Err(e) => return Err(format!("大纲 JSON 解析失败：{}", e)),
        }
    }
    Err("大纲 JSON 解析失败".to_string())
}

pub fn parse_stage_outline_only_response(
    raw: &str,
    order: usize,
    fallback_title: &str,
) -> Result<crate::services::parallel::StageOutlineOnly, String> {
    use crate::services::parallel::{StageOutlineOnly, TaskOutline};
    #[derive(Deserialize)]
    struct Wrapper {
        stage_description: Option<String>,
        description: Option<String>,
        #[serde(default)]
        prerequisites: Option<Vec<String>>,
        tasks: Option<Vec<TaskOutlineWrapper>>,
    }
    #[derive(Deserialize)]
    struct TaskOutlineWrapper {
        order: Option<usize>,
        title: String,
        task_type: Option<String>,
        #[serde(default)]
        prerequisites: Option<Vec<String>>,
    }
    let mut buffer = raw.to_string();
    for attempt in 0..3 {
        let result: Result<StageOutlineOnly, String> = (|| {
            let cleaned = clean_json(&buffer);
            let mut v: serde_json::Value = serde_json::from_str(&cleaned).or_else(|_| {
                extract_json_span(&buffer)
                    .and_then(|s| serde_json::from_str(s).ok())
                    .ok_or_else(|| format!("Value 解析失败"))
            })?;
            fix_null_to_zero(&mut v);
            let w: Wrapper =
                serde_json::from_value(v).map_err(|e| format!("结构解析失败: {}", e))?;
            let desc = w.stage_description.or(w.description).unwrap_or_default();
            let prerequisites = w.prerequisites.unwrap_or_default();
            let tasks = w
                .tasks
                .unwrap_or_default()
                .into_iter()
                .enumerate()
                .map(|(i, t)| TaskOutline {
                    order: t.order.unwrap_or(i + 1),
                    title: t.title,
                    task_type: t.task_type.unwrap_or_else(|| "reading".to_string()),
                    prerequisites: t.prerequisites.unwrap_or_default(),
                })
                .collect();
            Ok(StageOutlineOnly {
                order,
                title: fallback_title.to_string(),
                description: desc,
                prerequisites,
                task_outlines: tasks,
            })
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

pub fn parse_task_content_response(
    raw: &str,
    order: usize,
    title: &str,
    task_type: &str,
) -> Result<crate::services::parallel::TaskContent, String> {
    use crate::services::parallel::{ResourceDetail, TaskContent};
    #[derive(Deserialize)]
    struct Wrapper {
        content: Option<String>,
        #[serde(default)]
        points: Option<Vec<String>>,
        #[serde(default)]
        prerequisites: Option<Vec<String>>,
        #[serde(default)]
        video: Option<String>,
        #[serde(alias = "code_example")]
        example: Option<String>,
        resources: Option<Vec<AiResource>>,
    }
    let mut buffer = raw.to_string();
    for attempt in 0..3 {
        let result: Result<TaskContent, String> = (|| {
            let cleaned = clean_json(&buffer);
            let mut v: serde_json::Value = serde_json::from_str(&cleaned).or_else(|e| {
                extract_json_span(&buffer)
                    .map(|s| fix_invalid_json_escapes(s))
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .ok_or_else(|| {
                        let preview: String = buffer.chars().take(200).collect();
                        format!("Value 解析失败: {} | 前200字: {}", e, preview)
                    })
            })?;
            fix_null_to_zero(&mut v);
            let w: Wrapper =
                serde_json::from_value(v).map_err(|e| format!("结构解析失败: {}", e))?;
            let points = w.points.unwrap_or_default();
            let prerequisites = w.prerequisites.unwrap_or_default();
            let mut resources: Vec<ResourceDetail> = w
                .resources
                .unwrap_or_default()
                .into_iter()
                .map(|r| ResourceDetail {
                    title: r.title,
                    url: r.url,
                    snippet: None,
                    resource_type: r.resource_type,
                })
                .collect();
            if let Some(video) = w.video.filter(|s| !s.trim().is_empty()) {
                let exists = resources.iter().any(|r| r.url.trim() == video.trim());
                if !exists {
                    resources.push(ResourceDetail {
                        title: "视频讲解".to_string(),
                        url: video.trim().to_string(),
                        snippet: Some("AI 推荐的视频资源".to_string()),
                        resource_type: "video".to_string(),
                    });
                }
            }
            let mut content = w.content.unwrap_or_default();
            if content.trim().is_empty() && !points.is_empty() {
                let lines: Vec<String> = points.iter().map(|p| format!("- {}", p)).collect();
                content = format!("## 核心要点\n\n{}", lines.join("\n"));
            }
            Ok(TaskContent {
                order,
                title: title.to_string(),
                task_type: task_type.to_string(),
                content,
                points,
                prerequisites,
                example: w.example,
                resources,
            })
        })();
        match result {
            Ok(v) => return Ok(v),
            Err(e) if attempt == 0 => {
                warn!("任务内容 JSON 第 1 次解析失败：{}。尝试修复...", e);
                buffer = repair_truncated_json(raw);
            }
            Err(e) => {
                warn!("任务内容 JSON 解析失败（共 3 次）：{}。尝试正则提取...", e);
                if let Some(extracted) = extract_content_by_regex(raw) {
                    warn!("  ✓ 正则提取 content 成功");
                    return Ok(TaskContent {
                        order,
                        title: title.to_string(),
                        task_type: task_type.to_string(),
                        content: extracted,
                        points: vec![],
                        prerequisites: vec![],
                        example: None,
                        resources: vec![],
                    });
                }
                return Err(format!("任务内容 JSON 解析失败：{}", e));
            }
        }
    }
    Err("任务内容 JSON 解析失败".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repairs_nested_truncated_json_in_stack_order() {
        let raw = r#"{"stages":[{"name":"S1","tasks":[{"title":"T1","content":"hello"}]},{"name":"S2","tasks":[{"title":"T2","content":"world"}]},{"name":"S3","tasks":[{"title":"T3","content":"cut"#;
        let repaired = repair_truncated_json(raw);
        let value: serde_json::Value = serde_json::from_str(&repaired).expect("repaired json");
        let stages = value["stages"].as_array().expect("stages array");
        assert_eq!(stages.len(), 3);
        assert_eq!(stages[2]["tasks"][0]["content"], "cut");
    }

    #[test]
    fn repairs_dangling_backslash_before_string_end() {
        let raw = r#"{"content":"abc\"#;
        let repaired = repair_truncated_json(raw);
        let value: serde_json::Value = serde_json::from_str(&repaired).expect("repaired json");
        assert_eq!(value["content"], "abc");
    }

    #[test]
    fn fills_missing_array_value_after_colon() {
        let raw = "{\"content\":\"abc\",\"points\":\"";
        let repaired = repair_truncated_json(raw);
        let value: serde_json::Value = serde_json::from_str(&repaired).expect("repaired json");
        assert_eq!(value["content"], "abc");
        assert_eq!(value["points"], "");
    }

    #[test]
    fn fills_missing_value_after_colon_with_null() {
        let raw = r#"{"content":"abc","points":"#;
        let repaired = repair_truncated_json(raw);
        let value: serde_json::Value = serde_json::from_str(&repaired).expect("repaired json");
        assert!(value["points"].is_null());
    }

    #[test]
    fn removes_trailing_comma_before_closing() {
        let raw = r#"{"stages":[{"name":"a"},{"name":"b"}, "#;
        let repaired = repair_truncated_json(raw);
        let value: serde_json::Value = serde_json::from_str(&repaired).expect("repaired json");
        assert_eq!(value["stages"].as_array().expect("stages array").len(), 2);
    }

    #[test]
    fn drops_incomplete_object_from_array() {
        let raw = "{\"stages\":[{\"name\":\"a\"},{\"name\":\"b\"},{\"}";
        let repaired = repair_truncated_json(raw);
        let value: serde_json::Value = serde_json::from_str(&repaired).expect("repaired json");
        assert_eq!(value["stages"].as_array().expect("stages array").len(), 2);
    }
}
