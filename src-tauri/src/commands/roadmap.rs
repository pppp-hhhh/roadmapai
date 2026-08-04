use crate::models::{
    Resource, ResourceResponse, Roadmap, RoadmapRequest, RoadmapResponse, Stage, Task,
};

use crate::services::parallel::{
    json_array_string, parse_string_array, StageDetail, StageOutlineOnly, TaskContent, TaskDetail,
};
use crate::services::roadmap_parser::{
    parse_outline_response, parse_stage_outline_only_response, parse_task_content_response,
};
use crate::services::tavily;
use crate::services::{
    build_outline_prompt, build_stage_outline_only_prompt, build_task_content_prompt,
};
use crate::AppState;
use chrono::Utc;
use serde::Deserialize;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::{Emitter, State};
use tracing::{error, info, warn};
use uuid::Uuid;

async fn wait_cancelled(flag: &AtomicUsize, version: usize) {
    while flag.load(Ordering::SeqCst) == version {
        tokio::time::sleep(std::time::Duration::from_millis(80)).await;
    }
}

/// 请求取消当前进行中的生成任务（幂等，可重复调用）。
#[tauri::command]
pub fn cancel_generation(state: State<'_, AppState>) -> Result<(), String> {
    state.gen_cancel.fetch_add(1, Ordering::SeqCst);
    info!("==> 收到取消生成请求");
    Ok(())
}

fn emit_roadmap_progress(
    app_handle: &tauri::AppHandle,
    event_type: &str,
    current: usize,
    total: usize,
    stage_title: Option<&str>,
    message: &str,
) {
    let payload = serde_json::json!({
        "type": event_type,
        "current": current,
        "total": total,
        "stage_title": stage_title,
        "message": message,
    });
    let _ = app_handle.emit("roadmap-progress", payload);
}

async fn call_openai_compatible(
    client: &reqwest::Client,
    base_url: &str,
    model: &str,
    api_key: &str,
    system_prompt: &str,
    user_prompt: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let prompt_chars = system_prompt.len() + user_prompt.len();
    let est_input_tokens = prompt_chars / 2; // 粗略估计：中文 ~2 chars/token

    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.4,
        "max_tokens": max_tokens,
        // DeepSeek 专用:关闭链式推理,避免 thinking 把输出 token 灌满
        "reasoning_effort": "low",
    });

    info!("  📤 发送请求 → 模型={model}, 输入~{est_input_tokens}tok, max_output={max_tokens}tok");
    let t0 = Instant::now();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("Accept-Encoding", "identity")
        .json(&body)
        .timeout(std::time::Duration::from_secs(90))
        .send()
        .await
        .map_err(|e| format!("\"{}\" 请求失败：{}", model, e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("API 错误 ({}): {}", status, err_text));
    }

    let raw = resp
        .text()
        .await
        .map_err(|e| format!("读取响应失败：{}", e))?;
    info!(
        "  📥 响应接收 ← 耗时 {:.1}s, 长度 {} 字符",
        t0.elapsed().as_secs_f64(),
        raw.len()
    );

    let chat_value: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("解析响应 JSON 失败：{}", e))?;

    let finish_reason = chat_value["choices"][0]["finish_reason"]
        .as_str()
        .unwrap_or("unknown");
    if finish_reason == "length" {
        warn!("⚠ 模型因 token 限制截断了响应 (finish_reason=length)，尝试修复截断的 JSON...");
    }

    let reasoning = chat_value["choices"][0]["message"]["reasoning_content"]
        .as_str()
        .unwrap_or("");
    if !reasoning.is_empty() {
        info!(
            "  💭 模型输出了 {} 字符推理内容（不计入最终结果）",
            reasoning.len()
        );
    }

    chat_value["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "响应中没有 choices[0].message.content".to_string())
}

async fn call_claude(
    client: &reqwest::Client,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_prompt: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let url = "https://api.anthropic.com/v1/messages";
    let prompt_chars = system_prompt.len() + user_prompt.len();
    let est_input_tokens = prompt_chars / 2;

    let body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": user_prompt}
        ],
    });

    info!("  📤 发送请求 → Claude/{model}, 输入~{est_input_tokens}tok, max_output={max_tokens}tok");
    let t0 = Instant::now();
    let resp = client
        .post(url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("Claude 请求失败：{}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("Claude API 错误 ({}): {}", status, err_text));
    }

    let raw = resp
        .text()
        .await
        .map_err(|e| format!("读取 Claude 响应失败：{}", e))?;
    info!(
        "  📥 响应接收 ← 耗时 {:.1}s, 长度 {} 字符",
        t0.elapsed().as_secs_f64(),
        raw.len()
    );

    let value: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("解析 Claude 响应 JSON 失败：{}", e))?;

    let stop_reason = value["stop_reason"].as_str().unwrap_or("unknown");
    if stop_reason == "max_tokens" {
        let err = "Claude 因 token 限制截断了响应 (stop_reason=max_tokens)，返回内容不完整";
        error!("⚠ {}", err);
        return Err(err.to_string());
    }

    value["content"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Claude 响应中没有 content[0].text".to_string())
}

async fn call_ai(
    client: &reqwest::Client,
    provider_type: &str,
    base_url: &str,
    model: &str,
    api_key: &str,
    system_prompt: &str,
    user_prompt: &str,
    max_tokens: u32,
) -> Result<String, String> {
    match provider_type.to_lowercase().as_str() {
        "anthropic" | "claude" => {
            call_claude(
                client,
                api_key,
                model,
                system_prompt,
                user_prompt,
                max_tokens,
            )
            .await
        }
        _ => {
            call_openai_compatible(
                client,
                base_url,
                model,
                api_key,
                system_prompt,
                user_prompt,
                max_tokens,
            )
            .await
        }
    }
}

const MAX_AI_RETRIES: u32 = 2;

fn is_transient_ai_error(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("internal server error")
        || lower.contains("bad gateway")
        || lower.contains("service unavailable")
        || lower.contains("gateway timeout")
        || lower.contains("too many requests")
        || lower.contains("timeout")
        || lower.contains("timed out")
        || lower.contains("超时")
        || lower.contains("请求失败")
        || lower.contains("api 错误 (5")
        || lower.contains("api 错误 (429")
        || lower.contains("claude api 错误 (5")
        || lower.contains("claude api 错误 (429")
}

pub(crate) async fn call_ai_with_retry(
    client: &reqwest::Client,
    provider_type: &str,
    base_url: &str,
    model: &str,
    api_key: &str,
    system_prompt: &str,
    user_prompt: &str,
    max_tokens: u32,
) -> Result<String, String> {
    for attempt in 0..=MAX_AI_RETRIES {
        match call_ai(
            client,
            provider_type,
            base_url,
            model,
            api_key,
            system_prompt,
            user_prompt,
            max_tokens,
        )
        .await
        {
            Ok(r) => return Ok(r),
            Err(e) if attempt < MAX_AI_RETRIES && is_transient_ai_error(&e) => {
                let delay_secs = 1 + attempt as u64;
                warn!(
                    "  ⚠ AI 调用失败（{}/{}），{delay_secs}s 后重试：{e}",
                    attempt + 1,
                    MAX_AI_RETRIES + 1
                );
                tokio::time::sleep(std::time::Duration::from_secs(delay_secs)).await;
            }
            Err(e) => return Err(e),
        }
    }
    Err("AI 调用重试已耗尽".to_string())
}

fn stage_details_to_models(
    roadmap_id: String,
    details: Vec<StageDetail>,
) -> (Vec<Stage>, Vec<Task>, Vec<Resource>) {
    let mut stages = Vec::new();
    let mut tasks = Vec::new();
    let mut resources = Vec::new();

    for detail in details {
        let stage_id = Uuid::new_v4().to_string();
        let metadata = if detail.is_fallback {
            Some(r#"{"is_fallback":true}"#.to_string())
        } else {
            None
        };

        let stage_type = if detail.tasks.iter().any(|t| t.task_type == "project") {
            "project".to_string()
        } else {
            "learning".to_string()
        };

        let stage = Stage {
            id: stage_id.clone(),
            roadmap_id: roadmap_id.clone(),
            order: detail.order as i32,
            name: detail.title,
            objective: detail.description,
            estimated_hours: 4.0,
            stage_type,
            prerequisites: json_array_string(&detail.prerequisites),
            metadata,
        };
        stages.push(stage);

        for task_detail in detail.tasks {
            let task_id = Uuid::new_v4().to_string();
            let task = Task {
                id: task_id.clone(),
                stage_id: stage_id.clone(),
                order: task_detail.order as i32,
                title: task_detail.title,
                content: task_detail.content,
                points: json_array_string(&task_detail.points),
                prerequisites: json_array_string(&task_detail.prerequisites),
                task_type: task_detail.task_type,
                example: task_detail.example,
                is_completed: false,
                completed_at: None,
            };
            tasks.push(task);

            for res_detail in task_detail.resources {
                let resource = Resource {
                    id: Uuid::new_v4().to_string(),
                    task_id: task_id.clone(),
                    title: res_detail.title,
                    url: res_detail.url,
                    snippet: res_detail.snippet,
                    resource_type: res_detail.resource_type,
                };
                resources.push(resource);
            }
        }
    }

    (stages, tasks, resources)
}

fn merge_unique(mut first: Vec<String>, second: Vec<String>) -> Vec<String> {
    for item in second {
        if !first.contains(&item) {
            first.push(item);
        }
    }
    first
}

#[tauri::command]
pub async fn generate_roadmap(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    params: RoadmapRequest,
) -> Result<RoadmapResponse, String> {
    let total_t0 = Instant::now();
    let cancel_version = state.gen_cancel.load(Ordering::SeqCst);
    info!("========== 开始生成学习路线（并行模式）==========");
    info!(
        "主题：「{}」| 水平：{} | 目标：{}",
        params.topic, params.level, params.goal
    );

    // 1. Load settings + API key + custom config (single lock acquisition)
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
        let (base_url, model, provider_type) = match cfg {
            Some(c) => (Some(c.base_url), Some(c.model), Some(c.provider_type)),
            None => (None, None, None),
        };
        (settings, api_key, (base_url, model, provider_type))
    };

    // 决定 provider_type：优先用保存的，否则按 settings.ai_provider 推断
    let provider_type = provider_type_opt.clone().unwrap_or_else(|| {
        let p = settings.ai_provider.to_lowercase();
        if p == "claude" || p == "anthropic" {
            "anthropic".to_string()
        } else {
            "openai".to_string()
        }
    });

    // Claude 使用自己的官方端点和默认模型
    let (base_url, model) = if provider_type == "anthropic" {
        let m = model_opt.unwrap_or_else(|| "claude-sonnet-4-20250514".to_string());
        if base_url_opt.is_some() {
            warn!("Claude 模式下忽略自定义 base_url，固定使用 https://api.anthropic.com");
        }
        ("https://api.anthropic.com".to_string(), m)
    } else {
        (
            base_url_opt.unwrap_or_else(|| "https://api.openai.com/v1".to_string()),
            model_opt.unwrap_or_else(|| "gpt-4o".to_string()),
        )
    };
    let provider = settings.ai_provider.clone();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败：{}", e))?;

    info!(
        "模型：{} | base_url：{} | provider：{} | provider_type：{} | 并发数：6",
        model, base_url, provider, provider_type
    );

    // 2. Layer 1: Coordinator — generate outline
    info!("");
    info!("═══ Layer 1: Outline（大纲生成）═══");
    emit_roadmap_progress(
        &app_handle,
        "started",
        0,
        0,
        None,
        "正在生成学习路线大纲...",
    );

    // 3. Coordinator: generate outline
    info!("→ [大纲] 正在请求 AI 生成大纲...");
    let outline_t0 = Instant::now();
    let outline_prompt = build_outline_prompt(
        &params.topic,
        &params.goal,
        &params.level,
        &params.difficulty,
        params.profile.as_deref(),
    );
    let outline_raw = tokio::select! {
        r = call_ai_with_retry(
            &client, &provider_type, &base_url, &model, &api_key,
            "你是一位学习路线图设计专家。始终返回符合要求格式的有效 JSON。",
            &outline_prompt, 4000,
        ) => r.map_err(|e| format!("大纲生成失败：{}", e))?,
        _ = wait_cancelled(&state.gen_cancel, cancel_version) => {
            info!("==> 生成已取消（大纲阶段）");
            return Err("生成已取消".to_string());
        }
    };

    info!(
        "→ [大纲] 响应已接收，耗时 {:.1}s，开始解析...",
        outline_t0.elapsed().as_secs_f64()
    );

    let outline_result =
        parse_outline_response(&outline_raw).map_err(|e| format!("解析大纲失败：{}", e))?;

    let outlines = outline_result.stages;
    let ai_weekly_hours = outline_result.suggested_weekly_hours;
    let ai_total_weeks = outline_result.suggested_total_weeks;
    let total = outlines.len();
    info!("→ [大纲] 解析成功！共 {} 个阶段", total);
    info!(
        "→ [大纲] AI 建议：{}/周 × {}周 = {:.0}h 总学习时间",
        ai_weekly_hours, ai_total_weeks, outline_result.estimated_total_hours
    );
    for o in &outlines {
        info!("    阶段{}: {}", o.order, o.title);
    }

    // 4. Layer 2: Stage skeletons — N agents parallel
    emit_roadmap_progress(
        &app_handle,
        "outline_complete",
        0,
        total,
        None,
        &format!(
            "大纲生成完成，共 {} 个阶段，AI 建议 {}/周 × {}周",
            total, ai_weekly_hours, ai_total_weeks
        ),
    );

    info!("");
    info!("═══ Layer 2: Stage Skeletons（阶段骨架 {total} 并发）═══");

    if state.gen_cancel.load(Ordering::SeqCst) != cancel_version {
        info!("==> 生成已取消（进入阶段骨架前）");
        return Err("生成已取消".to_string());
    }

    let all_titles: Vec<String> = outlines.iter().map(|o| o.title.clone()).collect();
    let semaphore = Arc::new(tokio::sync::Semaphore::new(6));
    let layer_t0 = Instant::now();

    // ============================================================
    // LAYER 2: 阶段骨架 — N 个 Agent 并行，每个生成 task 列表
    // ============================================================
    info!(
        "→ [Layer 2] 启动 {} 个阶段骨架 Agent（并发上限 6）...",
        total
    );

    let mut stage_skeletons: Vec<StageOutlineOnly> = Vec::new();
    let mut skeleton_handles: Vec<tokio::task::JoinHandle<Result<StageOutlineOnly, String>>> =
        Vec::new();
    let skeleton_done = Arc::new(AtomicUsize::new(0));
    let total_skeletons = total;
    for outline in outlines {
        let sem = semaphore.clone();
        let client = client.clone();
        let base_url = base_url.clone();
        let model = model.clone();
        let api_key = api_key.clone();
        let provider_type_t = provider_type.clone();
        let app = app_handle.clone();
        let done_counter = skeleton_done.clone();
        let level = params.level.clone();
        let topic = params.topic.clone();
        let order = outline.order;
        let title = outline.title.clone();
        let brief = outline.brief.clone();
        let all_titles = all_titles.clone();
        let stage_prerequisites: Vec<String> = all_titles
            .iter()
            .take_while(|t| **t != title)
            .cloned()
            .collect();

        skeleton_handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.expect("信号量获取失败");
            let t0 = Instant::now();
            info!("  [L2-阶段{}] 启动", order);
            emit_roadmap_progress(
                &app,
                "stage_started",
                0,
                total_skeletons,
                Some(&title),
                &format!("正在生成第 {order}/{total_skeletons} 阶段骨架 · {title}"),
            );

            let prompt = build_stage_outline_only_prompt(
                &topic,
                &level,
                order,
                &title,
                &brief,
                &all_titles,
                &stage_prerequisites,
            );
            let raw = match call_ai_with_retry(
                &client,
                &provider_type_t,
                &base_url,
                &model,
                &api_key,
                "你是学习路线图设计专家。严格按 JSON 格式返回。",
                &prompt,
                3000,
            )
            .await
            {
                Ok(r) => Some(r),
                Err(e) => {
                    warn!("  [L2-阶段{}] ✘ AI 调用失败：{}", order, e);
                    None
                }
            };

            let result = if let Some(raw) = raw {
                match parse_stage_outline_only_response(&raw, order, &title) {
                    Ok(mut s) => {
                        s.title = title.clone();
                        info!(
                            "  [L2-阶段{}] ✔ {} 任务骨架 | {:.1}s",
                            order,
                            s.task_outlines.len(),
                            t0.elapsed().as_secs_f64()
                        );
                        Ok(s)
                    }
                    Err(e) => {
                        warn!("  [L2-阶段{}] ✘ 解析失败：{}", order, e);
                        Err(format!("解析失败：{}", e))
                    }
                }
            } else {
                Err("AI 调用失败".to_string())
            };

            let result = match result {
                Ok(s) => s,
                Err(e) => {
                    // Fallback: empty task outlines, aggregation will make it a proper fallback stage
                    warn!(
                        "  [L2-阶段{}] ⚠ AI 生成失败（{}），阶段将标记为占位",
                        order, e
                    );
                    StageOutlineOnly {
                        order,
                        title: title.clone(),
                        description: format!("本阶段目标：{}", brief),
                        prerequisites: vec![],
                        task_outlines: vec![],
                    }
                }
            };

            let done = done_counter.fetch_add(1, Ordering::Relaxed) + 1;
            emit_roadmap_progress(
                &app,
                "stage_completed",
                done,
                total_skeletons,
                Some(&title),
                &format!("阶段骨架 {done}/{total_skeletons} · {title}"),
            );
            Ok(result)
        }));
    }

    let mut skeleton_handles = skeleton_handles.into_iter();
    while let Some(h) = skeleton_handles.next() {
        tokio::select! {
            res = h => {
                if let Ok(Ok(s)) = res {
                    stage_skeletons.push(s);
                }
            }
            _ = wait_cancelled(&state.gen_cancel, cancel_version) => {
                for remaining in skeleton_handles {
                    remaining.abort();
                }
                info!("==> 生成已取消（阶段骨架）");
                return Err("生成已取消".to_string());
            }
        }
    }
    stage_skeletons.sort_by_key(|s| s.order);
    info!("→ [Layer 2] 完成：{} 阶段骨架", stage_skeletons.len());

    // ============================================================
    // LAYER 3: Task content + resources — M agents parallel
    // ============================================================
    let total_task_jobs: usize = stage_skeletons.iter().map(|s| s.task_outlines.len()).sum();
    info!("");
    info!("═══ Layer 3: Task Content（{total_task_jobs} 个任务并行，上限 6）═══");

    if state.gen_cancel.load(Ordering::SeqCst) != cancel_version {
        info!("==> 生成已取消（进入任务内容前）");
        return Err("生成已取消".to_string());
    }

    let mut task_contents: Vec<TaskContent> = Vec::new();
    let mut content_handles = Vec::new();
    let task_done = Arc::new(AtomicUsize::new(0));
    for stage in &stage_skeletons {
        for task in &stage.task_outlines {
            let sem = semaphore.clone();
            let client = client.clone();
            let base_url = base_url.clone();
            let model = model.clone();
            let api_key = api_key.clone();
            let provider_type_t = provider_type.clone();
            let app = app_handle.clone();
            let done_counter = task_done.clone();
            let topic = params.topic.clone();
            let stage_title = stage.title.clone();
            let stage_desc = stage.description.clone();
            let task_title = task.title.clone();
            let task_type = task.task_type.clone();
            let prerequisites = task.prerequisites.clone();
            let order = task.order;

            content_handles.push(tokio::spawn(async move {
                let _permit = sem.acquire().await.expect("信号量获取失败");
                let t0 = Instant::now();
                let prompt = build_task_content_prompt(
                    &topic,
                    &stage_title,
                    &stage_desc,
                    &task_title,
                    &task_type,
                    &prerequisites,
                );
                let raw = match call_ai_with_retry(
                    &client,
                    &provider_type_t,
                    &base_url,
                    &model,
                    &api_key,
                    "你是学习内容专家。严格按 JSON 格式返回。不要输出任何思考/推理,直接返回 JSON。",
                    &prompt,
                    5000,
                )
                .await
                {
                    Ok(r) => Some(r),
                    Err(e) => {
                        warn!("  [L3-任务{}] ✘ AI 调用失败：{}", order, e);
                        None
                    }
                };

                let result = match raw {
                    Some(raw) => {
                        match parse_task_content_response(&raw, order, &task_title, &task_type) {
                            Ok(c) => {
                                info!("  [L3-任务{}] ✔ {:.1}s", order, t0.elapsed().as_secs_f64());
                                Ok(c)
                            }
                            Err(e) => {
                                warn!("  [L3-任务{}] ✘ 解析失败：{}", order, e);
                                Err(format!("解析失败：{}", e))
                            }
                        }
                    }
                    None => Err("AI 调用失败".to_string()),
                };

                let done = done_counter.fetch_add(1, Ordering::Relaxed) + 1;
                emit_roadmap_progress(
                    &app,
                    "stage_completed",
                    done,
                    total_task_jobs,
                    Some(&task_title),
                    &format!("任务内容 {done}/{total_task_jobs} · {task_title}"),
                );
                result
            }));
        }
    }

    let mut content_handles = content_handles.into_iter();
    while let Some(h) = content_handles.next() {
        tokio::select! {
            res = h => {
                if let Ok(Ok(c)) = res {
                    task_contents.push(c);
                }
            }
            _ = wait_cancelled(&state.gen_cancel, cancel_version) => {
                for remaining in content_handles {
                    remaining.abort();
                }
                info!("==> 生成已取消（任务内容）");
                return Err("生成已取消".to_string());
            }
        }
    }
    task_contents.sort_by_key(|c| (c.task_type.clone(), c.order));
    info!("→ [Layer 3] 完成：{} 任务内容", task_contents.len());

    // ============================================================
    // 聚合 + DB 写入
    // ============================================================
    let mut stage_details: Vec<StageDetail> = Vec::new();
    let fallback_count = stage_skeletons
        .iter()
        .filter(|s| s.task_outlines.is_empty())
        .count();
    let total_tasks_built: usize = task_contents.len();
    let total_resources: usize = task_contents.iter().map(|c| c.resources.len()).sum();
    info!("");
    info!("══════════════════════════════════════");
    info!(
        "  📊 三层汇总：{} 阶段, {} 任务, {} 资源, {} 占位 | 总耗时 {:.1}s",
        stage_skeletons.len(),
        total_tasks_built,
        total_resources,
        fallback_count,
        layer_t0.elapsed().as_secs_f64()
    );
    info!("══════════════════════════════════════");

    for stage in &stage_skeletons {
        let mut tasks: Vec<TaskDetail> = Vec::new();
        for task_outline in &stage.task_outlines {
            if let Some(content) = task_contents.iter().find(|c| c.title == task_outline.title) {
                tasks.push(TaskDetail {
                    order: task_outline.order,
                    title: content.title.clone(),
                    content: content.content.clone(),
                    points: content.points.clone(),
                    prerequisites: merge_unique(
                        task_outline.prerequisites.clone(),
                        content.prerequisites.clone(),
                    ),
                    task_type: content.task_type.clone(),
                    example: content.example.clone(),
                    resources: content.resources.clone(),
                });
            }
        }
        if tasks.is_empty() {
            let outline = crate::services::parallel::StageOutline {
                order: stage.order,
                title: stage.title.clone(),
                brief: stage.description.clone(),
            };
            stage_details.push(StageDetail::fallback(&outline));
        } else {
            stage_details.push(StageDetail {
                order: stage.order,
                title: stage.title.clone(),
                description: stage.description.clone(),
                prerequisites: stage.prerequisites.clone(),
                tasks,
                is_fallback: false,
            });
        }
    }

    // ============================================================
    // 资源增强 — 用 Tavily 搜索真实链接替换 LLM 编造的资源
    // ============================================================
    let tavily_api_key = {
        let db = state.db.lock().await;
        db.get_api_key("tavily").await.unwrap_or(None)
    };

    if let Some(tavily_key) = &tavily_api_key {
        if !tavily_key.is_empty() {
            emit_roadmap_progress(
                &app_handle,
                "enriching",
                0,
                stage_details.len(),
                None,
                "正在搜索真实学习资源...",
            );
            info!(
                "→ [Tavily] 开始为 {} 个阶段搜索学习资源",
                stage_details.len()
            );

            let semaphore = Arc::new(tokio::sync::Semaphore::new(4));
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .map_err(|e| format!("创建 Tavily 客户端失败: {}", e))?;

            let mut enrich_handles = Vec::new();
            for stage in &stage_details {
                for task in &stage.tasks {
                    let sem = semaphore.clone();
                    let client = client.clone();
                    let key = tavily_key.clone();
                    let topic = params.topic.clone();
                    let task_title = task.title.clone();
                    let task_type = task.task_type.clone();

                    enrich_handles.push(tokio::spawn(async move {
                        let _permit = sem.acquire().await.expect("信号量");
                        let query = tavily::build_search_query(&topic, &task_title, &task_type);
                        tavily::search_resources(&client, &key, &query, 4).await
                    }));
                }
            }

            let mut enriched_results: Vec<
                Result<Vec<crate::services::parallel::ResourceDetail>, String>,
            > = vec![];
            let mut enrich_handles = enrich_handles.into_iter();
            while let Some(h) = enrich_handles.next() {
                tokio::select! {
                    res = h => match res {
                        Ok(result) => enriched_results.push(result),
                        Err(_) => enriched_results.push(Err("Join 错误".to_string())),
                    },
                    _ = wait_cancelled(&state.gen_cancel, cancel_version) => {
                        for remaining in enrich_handles {
                            remaining.abort();
                        }
                        info!("==> 生成已取消（资源搜索）");
                        return Err("生成已取消".to_string());
                    }
                }
            }

            let mut result_iter = enriched_results.into_iter();
            for stage in &mut stage_details {
                for task in &mut stage.tasks {
                    if let Some(result) = result_iter.next() {
                        match result {
                            Ok(resources) if !resources.is_empty() => {
                                info!("  [Tavily] ✔「{}」→ {} 个资源", task.title, resources.len());
                                task.resources = resources;
                            }
                            Ok(_) => {
                                info!("  [Tavily] ○「{}」→ 无结果，保留原资源", task.title);
                            }
                            Err(e) => {
                                info!("  [Tavily] ✘「{}」→ {}，保留原资源", task.title, e);
                            }
                        }
                    }
                }
            }
            info!("→ [Tavily] 资源搜索完成");

            emit_roadmap_progress(
                &app_handle,
                "enrich_done",
                stage_details.len(),
                stage_details.len(),
                None,
                "资源搜索完成，正在保存...",
            );
        }
    }

    if state.gen_cancel.load(Ordering::SeqCst) != cancel_version {
        info!("==> 生成已取消，不写入数据库");
        return Err("生成已取消".to_string());
    }

    // 7. Merge into DB models
    let roadmap_id = Uuid::new_v4().to_string();

    let estimated_hours = outline_result.estimated_total_hours;
    let roadmap_title = format!("{} 学习路线", params.topic);
    let roadmap_desc = format!(
        "AI 建议 {}/周 × {}周，共 {:.0} 小时 | {} 个阶段，{} 个任务",
        ai_weekly_hours,
        ai_total_weeks,
        estimated_hours,
        total,
        stage_details.iter().map(|d| d.tasks.len()).sum::<usize>(),
    );

    let mut roadmap_metadata = serde_json::json!({
        "topic": params.topic,
        "level": params.level,
        "goal": params.goal,
        "difficulty": params.difficulty,
    });
    if let Some(profile) = params
        .profile
        .as_deref()
        .map(str::trim)
        .filter(|p| !p.is_empty())
    {
        roadmap_metadata["profile"] = serde_json::Value::String(profile.to_string());
    }
    let roadmap_metadata = roadmap_metadata.to_string();

    let roadmap = Roadmap {
        id: roadmap_id.clone(),
        title: roadmap_title,
        description: roadmap_desc,
        estimated_total_hours: estimated_hours,
        created_at: Utc::now(),
        metadata: Some(roadmap_metadata),
    };

    let (stages, tasks, resources) = stage_details_to_models(roadmap_id.clone(), stage_details);

    // 8. Insert into DB
    info!("→ [数据库] 开始写入...");
    let db_t0 = Instant::now();
    let db = state.db.lock().await;
    db.create_roadmap(&roadmap).await?;
    info!("  ✓ roadmaps 表写入完成");

    for stage in &stages {
        db.create_stage(stage).await?;
    }
    info!("  ✓ stages 表写入完成 ({} 条)", stages.len());

    for task in &tasks {
        db.create_task(task).await?;
    }
    info!("  ✓ tasks 表写入完成 ({} 条)", tasks.len());

    for resource in &resources {
        db.create_resource(resource).await?;
    }
    info!("  ✓ resources 表写入完成 ({} 条)", resources.len());

    drop(db);
    info!(
        "→ [数据库] 写入完成，耗时 {:.1}s",
        db_t0.elapsed().as_secs_f64()
    );

    info!("→ [生成] 路线 ID：{}", roadmap.id);
    info!(
        "→ [生成] 总耗时 {:.1}s | 阶段:{}, 任务:{}, 资源:{}, 占位:{}",
        total_t0.elapsed().as_secs_f64(),
        stages.len(),
        tasks.len(),
        resources.len(),
        fallback_count
    );

    // 9. Emit completed
    emit_roadmap_progress(
        &app_handle,
        "completed",
        total,
        total,
        None,
        &format!("学习路线「{}」生成完成！", roadmap.title),
    );

    // 10. Build response
    let mut stage_responses = Vec::new();
    for stage in &stages {
        let stage_tasks: Vec<_> = tasks.iter().filter(|t| t.stage_id == stage.id).collect();

        let mut task_responses = Vec::new();
        for task in stage_tasks {
            let task_resources: Vec<ResourceResponse> = resources
                .iter()
                .filter(|r| r.task_id == task.id)
                .map(|r| ResourceResponse {
                    id: r.id.clone(),
                    title: r.title.clone(),
                    url: r.url.clone(),
                    snippet: r.snippet.clone(),
                    resource_type: r.resource_type.clone(),
                })
                .collect();

            task_responses.push(crate::models::TaskResponse {
                id: task.id.clone(),
                order: task.order,
                title: task.title.clone(),
                content: task.content.clone(),
                points: parse_string_array(&task.points),
                prerequisites: parse_string_array(&task.prerequisites),
                task_type: task.task_type.clone(),
                example: task.example.clone(),
                is_completed: task.is_completed,
                completed_at: task.completed_at,
                resources: task_resources,
            });
        }

        stage_responses.push(crate::models::StageResponse {
            id: stage.id.clone(),
            order: stage.order,
            name: stage.name.clone(),
            objective: stage.objective.clone(),
            prerequisites: parse_string_array(&stage.prerequisites),
            estimated_hours: stage.estimated_hours,
            stage_type: stage.stage_type.clone(),
            is_fallback: stage
                .metadata
                .as_deref()
                .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
                .and_then(|v| v["is_fallback"].as_bool())
                .unwrap_or(false),
            tasks: task_responses,
        });
    }

    Ok(RoadmapResponse {
        id: roadmap.id,
        title: roadmap.title,
        description: roadmap.description,
        estimated_total_hours: roadmap.estimated_total_hours,
        stages: stage_responses,
    })
}

pub(crate) async fn build_roadmap_response(
    db: &crate::Database,
    roadmap_id: &str,
) -> Result<RoadmapResponse, String> {
    let roadmap = db.get_roadmap(roadmap_id).await?.ok_or("未找到路线图")?;

    let stages = db.get_stages_by_roadmap(roadmap_id).await?;

    let mut stage_responses = Vec::new();

    for stage in stages {
        let tasks = db.get_tasks_by_stage(&stage.id).await?;
        let mut task_responses = Vec::new();

        for task in tasks {
            let resources = db.get_resources_by_task(&task.id).await?;
            let resource_responses: Vec<ResourceResponse> = resources
                .into_iter()
                .map(|r| ResourceResponse {
                    id: r.id,
                    title: r.title,
                    url: r.url,
                    snippet: r.snippet,
                    resource_type: r.resource_type,
                })
                .collect();

            task_responses.push(crate::models::TaskResponse {
                id: task.id,
                order: task.order,
                title: task.title,
                content: task.content,
                points: parse_string_array(&task.points),
                prerequisites: parse_string_array(&task.prerequisites),
                task_type: task.task_type,
                example: task.example,
                is_completed: task.is_completed,
                completed_at: task.completed_at,
                resources: resource_responses,
            });
        }

        stage_responses.push(crate::models::StageResponse {
            id: stage.id,
            order: stage.order,
            name: stage.name,
            objective: stage.objective,
            prerequisites: parse_string_array(&stage.prerequisites),
            estimated_hours: stage.estimated_hours,
            stage_type: stage.stage_type,
            is_fallback: stage
                .metadata
                .as_deref()
                .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
                .and_then(|v| v["is_fallback"].as_bool())
                .unwrap_or(false),
            tasks: task_responses,
        });
    }

    Ok(RoadmapResponse {
        id: roadmap.id,
        title: roadmap.title,
        description: roadmap.description,
        estimated_total_hours: roadmap.estimated_total_hours,
        stages: stage_responses,
    })
}

#[tauri::command]
pub async fn get_roadmap(
    state: State<'_, AppState>,
    id: String,
) -> Result<RoadmapResponse, String> {
    let db = state.db.lock().await;
    build_roadmap_response(&db, &id).await
}

#[tauri::command]
pub async fn get_all_roadmaps(state: State<'_, AppState>) -> Result<Vec<Roadmap>, String> {
    let db = state.db.lock().await;
    db.get_all_roadmaps().await
}

#[tauri::command]
pub async fn mark_task_completed(
    state: State<'_, AppState>,
    task_id: String,
    completed: bool,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.mark_task_completed(&task_id, completed).await
}

#[tauri::command]
pub async fn delete_roadmap(state: State<'_, AppState>, id: String) -> Result<(), String> {
    info!("正在删除学习路线：{}", id);
    let db = state.db.lock().await;
    db.delete_roadmap(&id).await?;
    info!("学习路线删除成功：{}", id);
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct AddResourceRequest {
    pub task_id: String,
    pub title: String,
    pub url: String,
    pub snippet: Option<String>,
    pub resource_type: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateResourceRequest {
    pub id: String,
    pub title: String,
    pub url: String,
    pub snippet: String,
    pub resource_type: String,
}

#[tauri::command]
pub async fn add_resource(
    state: State<'_, AppState>,
    request: AddResourceRequest,
) -> Result<Resource, String> {
    let resource = Resource {
        id: uuid::Uuid::new_v4().to_string(),
        task_id: request.task_id,
        title: request.title,
        url: request.url,
        snippet: request.snippet,
        resource_type: request.resource_type,
    };
    let db = state.db.lock().await;
    db.create_resource(&resource).await?;
    info!("添加学习资源：{}", resource.title);
    Ok(resource)
}

#[tauri::command]
pub async fn update_resource(
    state: State<'_, AppState>,
    request: UpdateResourceRequest,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.update_resource(
        &request.id,
        &request.title,
        &request.url,
        &request.snippet,
        &request.resource_type,
    )
    .await?;
    info!("更新学习资源：{}", request.title);
    Ok(())
}

#[tauri::command]
pub async fn add_task_to_stage(
    state: State<'_, AppState>,
    stage_id: String,
    title: String,
    content: String,
    task_type: String,
    minutes: Option<u32>,
) -> Result<crate::models::TaskResponse, String> {
    info!("AI 闭环:向阶段 {} 添加任务「{}」", stage_id, title);

    // 校验 task_type 在白名单
    let valid_types = ["reading", "video", "project"];
    if !valid_types.contains(&task_type.as_str()) {
        return Err(format!("非法的 task_type: {}", task_type));
    }

    // content 头部加一行提示用户来源(可选)
    let minutes_note = minutes
        .filter(|m| *m > 0)
        .map(|m| format!("\n\n⏱ 预计时长:{} 分钟(由 AI 导师对话生成)", m))
        .unwrap_or_default();
    let final_content = format!("{}{}", content, minutes_note);

    let task_id = Uuid::new_v4().to_string();

    // 写入
    let response = {
        let db = state.db.lock().await;
        db.get_stage_by_id(&stage_id)
            .await?
            .ok_or_else(|| "阶段不存在".to_string())?;
        let existing = db.get_tasks_by_stage(&stage_id).await?;
        let order = existing.iter().map(|t| t.order).max().unwrap_or(0) + 1;
        let task = Task {
            id: task_id.clone(),
            stage_id: stage_id.clone(),
            order,
            title: title.trim().to_string(),
            content: final_content,
            points: "[]".to_string(),
            prerequisites: "[]".to_string(),
            task_type,
            example: None,
            is_completed: false,
            completed_at: None,
        };
        db.create_task(&task).await?;
        crate::models::TaskResponse {
            id: task.id,
            order: task.order,
            title: task.title,
            content: task.content,
            points: vec![],
            prerequisites: vec![],
            task_type: task.task_type,
            example: task.example,
            is_completed: task.is_completed,
            completed_at: task.completed_at,
            resources: vec![],
        }
    };

    info!("✔ 任务创建成功: {}", task_id);

    Ok(response)
}

#[tauri::command]
pub async fn delete_resource(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().await;
    db.delete_resource(&id).await?;
    info!("删除学习资源：{}", id);
    Ok(())
}

#[tauri::command]
pub async fn retry_stage(
    state: State<'_, AppState>,
    _app_handle: tauri::AppHandle,
    stage_id: String,
) -> Result<crate::models::StageResponse, String> {
    info!("正在重新生成阶段：{}", stage_id);

    // Load settings + API key + custom config (single lock acquisition)
    let (_settings, api_key, (base_url_opt, model_opt, provider_type_opt)) = {
        let db = state.db.lock().await;
        let settings = db.get_settings().await?;
        let api_key = db
            .get_api_key(&settings.ai_provider)
            .await?
            .ok_or_else(|| format!("{} 的 API Key not found", settings.ai_provider))?;
        let cfg = db.get_api_config(&settings.ai_provider).await?;
        let (b, m, p) = match cfg {
            Some(c) => (Some(c.base_url), Some(c.model), Some(c.provider_type)),
            None => (None, None, None),
        };
        (settings, api_key, (b, m, p))
    };
    let provider_type = provider_type_opt.unwrap_or_else(|| "openai".to_string());
    let base_url = base_url_opt.unwrap_or_else(|| "https://api.openai.com/v1".to_string());
    let model = model_opt.unwrap_or_else(|| "gpt-4o".to_string());

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败：{}", e))?;

    // Get stage + roadmap context
    let (stage, roadmap, all_stages) = {
        let db = state.db.lock().await;
        let s = db.get_stage_by_id(&stage_id).await?.ok_or("未找到阶段")?;
        let r = db.get_roadmap(&s.roadmap_id).await?.ok_or("未找到路线")?;
        let stages = db.get_stages_by_roadmap(&s.roadmap_id).await?;
        (s, r, stages)
    };

    // 优先使用生成时保存的上下文;旧路线没有 metadata 时回退到标题与默认水平
    let fallback_topic = roadmap
        .title
        .trim_end_matches(" 学习路线")
        .trim_end_matches("学习路线")
        .trim()
        .to_string();
    let fallback_topic = if fallback_topic.is_empty() {
        roadmap.title.clone()
    } else {
        fallback_topic
    };
    let (topic, level) = match serde_json::from_str::<serde_json::Value>(
        roadmap.metadata.as_deref().unwrap_or("{}"),
    ) {
        Ok(v) => {
            let t = v["topic"]
                .as_str()
                .map(str::to_string)
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| fallback_topic.clone());
            let l = v["level"]
                .as_str()
                .map(str::to_string)
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| "中级".to_string());
            (t, l)
        }
        Err(_) => (fallback_topic, "中级".to_string()),
    };

    let stage_titles: Vec<String> = all_stages.iter().map(|s| s.name.clone()).collect();
    let stage_prerequisites: Vec<String> = all_stages
        .iter()
        .filter(|s| s.order < stage.order)
        .map(|s| s.name.clone())
        .collect();

    // Layer 2: generate task outlines for this stage
    info!("  [重试 L2] 生成阶段「{}」的任务骨架...", stage.name);
    let outline_prompt = build_stage_outline_only_prompt(
        &topic,
        &level,
        stage.order as usize,
        &stage.name,
        &stage.objective,
        &stage_titles,
        &stage_prerequisites,
    );
    let raw = call_ai_with_retry(
        &client,
        &provider_type,
        &base_url,
        &model,
        &api_key,
        "你是学习路线图设计专家。严格按 JSON 格式返回。",
        &outline_prompt,
        3000,
    )
    .await
    .map_err(|e| format!("L2 失败：{}", e))?;

    let stage_outline = crate::services::roadmap_parser::parse_stage_outline_only_response(
        &raw,
        stage.order as usize,
        &stage.name,
    )
    .map_err(|e| format!("解析失败：{}", e))?;

    info!(
        "  [重试 L2] ✔ {} 个任务骨架",
        stage_outline.task_outlines.len()
    );

    // Layer 3: generate content for each task
    let mut task_contents: Vec<TaskContent> = Vec::new();
    let semaphore = Arc::new(tokio::sync::Semaphore::new(3));
    let mut handles = Vec::new();

    for task in &stage_outline.task_outlines {
        let sem = semaphore.clone();
        let client = client.clone();
        let base_url = base_url.clone();
        let model = model.clone();
        let api_key = api_key.clone();
        let provider_type = provider_type.clone();
        let stage_title = stage_outline.title.clone();
        let stage_desc = stage_outline.description.clone();
        let task_title = task.title.clone();
        let task_type = task.task_type.clone();
        let task_prerequisites = task.prerequisites.clone();
        let topic = topic.clone();
        let order = task.order;

        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.map_err(|e| format!("信号量: {}", e))?;
            let prompt = build_task_content_prompt(
                &topic,
                &stage_title,
                &stage_desc,
                &task_title,
                &task_type,
                &task_prerequisites,
            );
            let raw = call_ai_with_retry(
                &client,
                &provider_type,
                &base_url,
                &model,
                &api_key,
                "你是学习内容专家。严格按 JSON 格式返回。不要输出任何思考/推理,直接返回 JSON。",
                &prompt,
                5000,
            )
            .await
            .map_err(|e| format!("L3 失败: {}", e))?;

            crate::services::roadmap_parser::parse_task_content_response(
                &raw,
                order,
                &task_title,
                &task_type,
            )
        }));
    }

    for h in handles {
        if let Ok(Ok(tc)) = h.await {
            task_contents.push(tc);
        }
    }
    info!("  [重试 L3] ✔ {} 个任务内容", task_contents.len());

    // Update DB: delete old tasks + resources, insert new ones
    let db = state.db.lock().await;

    // Delete old tasks and resources for this stage
    db.delete_tasks_by_stage(&stage_id).await?;

    // Update stage with regenerated objective/prerequisites and clear fallback flag
    let stage_type = if task_contents.iter().any(|t| t.task_type == "project") {
        "project".to_string()
    } else {
        "learning".to_string()
    };
    let mut updated_stage = stage.clone();
    updated_stage.objective = stage_outline.description.clone();
    updated_stage.prerequisites = json_array_string(&stage_outline.prerequisites);
    updated_stage.stage_type = stage_type;
    updated_stage.metadata = None;
    db.update_stage(&updated_stage).await?;

    // Insert new tasks + resources
    let mut new_tasks = Vec::new();
    for tc in &task_contents {
        let task_id = Uuid::new_v4().to_string();
        let task = Task {
            id: task_id.clone(),
            stage_id: stage_id.clone(),
            order: tc.order as i32,
            title: tc.title.clone(),
            content: tc.content.clone(),
            points: json_array_string(&tc.points),
            prerequisites: json_array_string(&tc.prerequisites),
            task_type: tc.task_type.clone(),
            example: tc.example.clone(),
            is_completed: false,
            completed_at: None,
        };
        db.create_task(&task).await?;

        for r in &tc.resources {
            let resource = Resource {
                id: Uuid::new_v4().to_string(),
                task_id: task_id.clone(),
                title: r.title.clone(),
                url: r.url.clone(),
                snippet: r.snippet.clone(),
                resource_type: r.resource_type.clone(),
            };
            db.create_resource(&resource).await?;
        }

        new_tasks.push(task_id);
    }

    info!("  [重试] ✔ 阶段重新生成完成：{} 个任务", new_tasks.len());

    // Build response
    let tasks: Vec<Task> = db.get_tasks_by_stage(&stage_id).await?;
    let mut task_responses = Vec::new();
    for task in &tasks {
        let resources = db.get_resources_by_task(&task.id).await?;
        task_responses.push(crate::models::TaskResponse {
            id: task.id.clone(),
            order: task.order,
            title: task.title.clone(),
            content: task.content.clone(),
            points: parse_string_array(&task.points),
            prerequisites: parse_string_array(&task.prerequisites),
            task_type: task.task_type.clone(),
            example: task.example.clone(),
            is_completed: task.is_completed,
            completed_at: task.completed_at,
            resources: resources
                .into_iter()
                .map(|r| crate::models::ResourceResponse {
                    id: r.id,
                    title: r.title,
                    url: r.url,
                    snippet: r.snippet,
                    resource_type: r.resource_type,
                })
                .collect(),
        });
    }

    Ok(crate::models::StageResponse {
        id: stage_id,
        order: updated_stage.order,
        name: updated_stage.name,
        objective: updated_stage.objective,
        prerequisites: parse_string_array(&updated_stage.prerequisites),
        estimated_hours: updated_stage.estimated_hours,
        stage_type: updated_stage.stage_type,
        is_fallback: false,
        tasks: task_responses,
    })
}
