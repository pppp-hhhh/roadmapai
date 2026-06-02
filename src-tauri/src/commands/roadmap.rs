use crate::models::{Flashcard, Quiz, Resource, ResourceResponse, Roadmap, RoadmapRequest, RoadmapResponse, Stage, Task};

use crate::services::parallel::{
    FlashcardItem, StageDetail, StageOutlineOnly, TaskContent, TaskDetail, 
};
use crate::services::roadmap_parser::{
    parse_outline_response, parse_stage_outline_only_response,
    parse_task_content_response,
};
use crate::services::{
    build_outline_prompt, build_stage_outline_only_prompt,
    build_task_content_prompt,
};
use crate::services::tavily;
use crate::AppState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;
use tauri::{Emitter, State};
use tracing::{error, info, warn};
use uuid::Uuid;


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
        "temperature": 0.7,
        "max_tokens": max_tokens,
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
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("API 错误：{}", err_text));
    }

    let raw = resp.text().await.map_err(|e| format!("读取响应失败：{}", e))?;
    info!("  📥 响应接收 ← 耗时 {:.1}s, 长度 {} 字符", t0.elapsed().as_secs_f64(), raw.len());

    let chat_value: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| format!("解析响应 JSON 失败：{}", e))?;

    let finish_reason = chat_value["choices"][0]["finish_reason"]
        .as_str()
        .unwrap_or("unknown");
    if finish_reason == "length" {
        warn!("⚠ 模型因 token 限制截断了响应 (finish_reason=length)，返回内容可能不完整");
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
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("Claude API 错误：{}", err_text));
    }

    let raw = resp.text().await.map_err(|e| format!("读取 Claude 响应失败：{}", e))?;
    info!("  📥 响应接收 ← 耗时 {:.1}s, 长度 {} 字符", t0.elapsed().as_secs_f64(), raw.len());

    let value: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| format!("解析 Claude 响应 JSON 失败：{}", e))?;

    let stop_reason = value["stop_reason"]
        .as_str()
        .unwrap_or("unknown");
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
            call_claude(client, api_key, model, system_prompt, user_prompt, max_tokens).await
        }
        _ => {
            call_openai_compatible(client, base_url, model, api_key, system_prompt, user_prompt, max_tokens).await
        }
    }
}

fn stage_details_to_models(
    roadmap_id: String,
    details: Vec<StageDetail>,
) -> (Vec<Stage>, Vec<Task>, Vec<Resource>, Vec<Flashcard>) {
    let mut stages = Vec::new();
    let mut tasks = Vec::new();
    let mut resources = Vec::new();
    let mut flashcards = Vec::new();

    for detail in details {
        let stage_id = Uuid::new_v4().to_string();
        let metadata = if detail.is_fallback {
            Some(r#"{"is_fallback":true}"#.to_string())
        } else {
            None
        };

        let stage_type = if detail.order == stages.len() + 1 && detail.order > 5 {
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
            is_locked: detail.order > 1,
            quiz_json: None,
            pass_threshold: 0.7,
            metadata,
        };
        stages.push(stage);

        for task_detail in detail.tasks {
            let task_id = Uuid::new_v4().to_string();
            let task = Task {
                id: task_id.clone(),
                stage_id: stage_id.clone(),
                title: task_detail.title,
                content: task_detail.content,
                task_type: task_detail.task_type,
                code_example: task_detail.code_example,
                exercise: task_detail.exercise,
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

        for fc_detail in detail.flashcards {
            let flashcard = Flashcard::new(roadmap_id.clone(), fc_detail.question, fc_detail.answer);
            flashcards.push(flashcard);
        }
    }

    (stages, tasks, resources, flashcards)
}

#[tauri::command]
pub async fn generate_roadmap(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    params: RoadmapRequest,
) -> Result<RoadmapResponse, String> {
    let total_t0 = Instant::now();
    info!("========== 开始生成学习路线（并行模式）==========");
    info!("主题：「{}」| 水平：{} | 目标：{}", params.topic, params.level, params.goal);

    // 1. Load settings
    let settings = {
        let db = state.db.lock().await;
        db.get_settings().await?
    };

    let api_key = {
        let db = state.db.lock().await;
        db.get_api_key(&settings.ai_provider)
            .await?
            .ok_or_else(|| format!("{} 的 API Key 未找到，请在设置中配置 API Key", settings.ai_provider))?
    };

    let (base_url_opt, model_opt, provider_type_opt) = {
        let db = state.db.lock().await;
        db.get_api_config(&settings.ai_provider).await?
    };

    // 决定 provider_type：优先用保存的，否则按 settings.ai_provider 推断
    let provider_type = provider_type_opt
        .clone()
        .unwrap_or_else(|| {
            let p = settings.ai_provider.to_lowercase();
            if p == "claude" || p == "anthropic" { "anthropic".to_string() } else { "openai".to_string() }
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

    info!("模型：{} | base_url：{} | provider：{} | provider_type：{} | 并发数：6", model, base_url, provider, provider_type);

    // 2. Layer 1: Coordinator — generate outline
    info!("");
    info!("═══ Layer 1: Outline（大纲生成）═══");
    emit_roadmap_progress(&app_handle, "started", 0, 0, None, "正在生成学习路线大纲...");

    // 3. Coordinator: generate outline
    info!("→ [大纲] 正在请求 AI 生成大纲...");
    let outline_t0 = Instant::now();
    let outline_prompt = build_outline_prompt(&params.topic, &params.goal, &params.level);
    let outline_raw = call_ai(
        &client, &provider_type, &base_url, &model, &api_key,
        "你是一位学习路线图设计专家。始终返回符合要求格式的有效 JSON。",
        &outline_prompt, 2000,
    ).await.map_err(|e| format!("大纲生成失败：{}", e))?;

    info!("→ [大纲] 响应已接收，耗时 {:.1}s，开始解析...", outline_t0.elapsed().as_secs_f64());

    let outline_result = parse_outline_response(&outline_raw)
        .map_err(|e| format!("解析大纲失败：{}", e))?;

    let outlines = outline_result.stages;
    let ai_weekly_hours = outline_result.suggested_weekly_hours;
    let ai_total_weeks = outline_result.suggested_total_weeks;
    let total = outlines.len();
    info!("→ [大纲] 解析成功！共 {} 个阶段", total);
    info!("→ [大纲] AI 建议：{}/周 × {}周 = {:.0}h 总学习时间", ai_weekly_hours, ai_total_weeks, outline_result.estimated_total_hours);
    for o in &outlines {
        info!("    阶段{}: {}", o.order, o.title);
    }

    // 4. Layer 2: Stage skeletons — N agents parallel
    emit_roadmap_progress(
        &app_handle, "outline_complete", 0, total, None,
        &format!("大纲生成完成，共 {} 个阶段，AI 建议 {}/周 × {}周", total, ai_weekly_hours, ai_total_weeks),
    );

    info!("");
    info!("═══ Layer 2: Stage Skeletons（阶段骨架 {total} 并发）═══");

    let _all_titles: Vec<String> = outlines.iter().map(|o| o.title.clone()).collect();
    let semaphore = Arc::new(tokio::sync::Semaphore::new(6));
    let layer_t0 = Instant::now();

    // ============================================================
    // LAYER 2: 阶段骨架 — N 个 Agent 并行，每个生成 task 列表
    // ============================================================
    info!("→ [Layer 2] 启动 {} 个阶段骨架 Agent（并发上限 6）...", total);

    let mut stage_skeletons: Vec<StageOutlineOnly> = Vec::new();
    let mut skeleton_handles = Vec::new();
    for outline in outlines {
        let sem = semaphore.clone();
        let client = client.clone();
        let base_url = base_url.clone();
        let model = model.clone();
        let api_key = api_key.clone();
        let provider_type_t = provider_type.clone();
        let level = params.level.clone();
        let order = outline.order;
        let title = outline.title.clone();
        let brief = outline.brief.clone();

        skeleton_handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.expect("信号量获取失败");
            let t0 = Instant::now();
            info!("  [L2-阶段{}] 启动", order);

            let prompt = build_stage_outline_only_prompt(&title, &level, order, &title, &brief);
            let raw = call_ai(
                &client, &provider_type_t, &base_url, &model, &api_key,
                "你是学习路线图设计专家。严格按 JSON 格式返回。",
                &prompt, 3000,
            ).await.ok();

            if let Some(raw) = raw {
                match parse_stage_outline_only_response(&raw, order, &title) {
                    Ok(mut s) => {
                        s.title = title.clone();
                        info!("  [L2-阶段{}] ✔ {} 任务骨架 | {:.1}s", order, s.task_outlines.len(), t0.elapsed().as_secs_f64());
                        return Ok(s);
                    }
                    Err(e) => warn!("  [L2-阶段{}] ✘ 解析失败：{}", order, e),
                }
            }
            Err::<StageOutlineOnly, String>(format!("L2 阶段{}失败", order))
        }));
    }

    for h in skeleton_handles {
        if let Ok(Ok(s)) = h.await {
            stage_skeletons.push(s);
        }
    }
    stage_skeletons.sort_by_key(|s| s.order);
    info!("→ [Layer 2] 完成：{} 阶段骨架", stage_skeletons.len());

    // ============================================================
    // LAYER 3: Task content + resources + flashcards — M agents parallel
    // ============================================================
    let total_task_jobs: usize = stage_skeletons.iter().map(|s| s.task_outlines.len()).sum();
    info!("");
    info!("═══ Layer 3: Task Content（{total_task_jobs} 个任务并行，上限 6）═══");

    let mut task_contents: Vec<TaskContent> = Vec::new();
    let mut content_handles = Vec::new();
    for stage in &stage_skeletons {
        for task in &stage.task_outlines {
            let sem = semaphore.clone();
            let client = client.clone();
            let base_url = base_url.clone();
            let model = model.clone();
            let api_key = api_key.clone();
            let provider_type_t = provider_type.clone();
            let stage_title = stage.title.clone();
            let stage_desc = stage.description.clone();
            let task_title = task.title.clone();
            let task_type = task.task_type.clone();
            let order = task.order;

            content_handles.push(tokio::spawn(async move {
                let _permit = sem.acquire().await.expect("信号量获取失败");
                let t0 = Instant::now();
                let prompt = build_task_content_prompt(&stage_title, &stage_title, &stage_desc, &task_title, &task_type);
                let raw = call_ai(
                    &client, &provider_type_t, &base_url, &model, &api_key,
                    "你是学习内容专家。严格按 JSON 格式返回。",
                    &prompt, 4000,
                ).await.ok();

                if let Some(raw) = raw {
                    if let Ok(c) = parse_task_content_response(&raw, order, &task_title, &task_type) {
                        info!("  [L3-任务{}] ✔ {:.1}s", order, t0.elapsed().as_secs_f64());
                        return Ok(c);
                    }
                }
                Err(format!("L3 任务{}失败", order))
            }));
        }
    }

    for h in content_handles {
        if let Ok(Ok(c)) = h.await {
            task_contents.push(c);
        }
    }
    task_contents.sort_by_key(|c| (c.task_type.clone(), c.order));
    info!("→ [Layer 3] 完成：{} 任务内容", task_contents.len());

    // ============================================================
    // 聚合 + DB 写入
    // ============================================================
    let mut stage_details: Vec<StageDetail> = Vec::new();
    let fallback_count = stage_skeletons.iter().filter(|s| s.task_outlines.is_empty()).count();
    let total_tasks_built: usize = task_contents.len();
    let total_resources: usize = task_contents.iter().map(|c| c.resources.len()).sum();
    let total_flashcards: usize = task_contents.iter().map(|c| c.flashcards.len()).sum();
    info!("");
    info!("══════════════════════════════════════");
    info!("  📊 三层汇总：{} 阶段, {} 任务, {} 资源, {} 记忆卡, {} 占位 | 总耗时 {:.1}s",
        stage_skeletons.len(), total_tasks_built, total_resources, total_flashcards, fallback_count, layer_t0.elapsed().as_secs_f64());
    info!("══════════════════════════════════════");

    for stage in &stage_skeletons {
        let mut tasks: Vec<TaskDetail> = Vec::new();
        let mut all_flashcards: Vec<FlashcardItem> = Vec::new();
        for task_outline in &stage.task_outlines {
            if let Some(content) = task_contents.iter().find(|c| c.title == task_outline.title) {
                all_flashcards.extend(content.flashcards.clone());
                tasks.push(TaskDetail {
                    title: content.title.clone(),
                    content: content.content.clone(),
                    task_type: content.task_type.clone(),
                    code_example: content.code_example.clone(),
                    exercise: content.exercise.clone(),
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
                tasks,
                flashcards: all_flashcards,
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
                &app_handle, "enriching", 0, stage_details.len(), None,
                "正在搜索真实学习资源...",
            );
            info!("→ [Tavily] 开始为 {} 个阶段搜索学习资源", stage_details.len());

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

            let mut enriched_results: Vec<Result<Vec<crate::services::parallel::ResourceDetail>, String>> = vec![];
            for h in enrich_handles {
                match h.await {
                    Ok(result) => enriched_results.push(result),
                    Err(_) => enriched_results.push(Err("Join 错误".to_string())),
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
                &app_handle, "enrich_done", stage_details.len(), stage_details.len(), None,
                "资源搜索完成，正在保存...",
            );
        }
    }

    // 7. Merge into DB models
    let roadmap_id = Uuid::new_v4().to_string();

    let estimated_hours = outline_result.estimated_total_hours;
    let roadmap_title = format!("{} 学习路线", params.topic);
    let roadmap_desc = format!(
        "AI 建议 {}/周 × {}周，共 {:.0} 小时 | {} 个阶段，{} 个任务",
        ai_weekly_hours, ai_total_weeks, estimated_hours,
        total, stage_details.iter().map(|d| d.tasks.len()).sum::<usize>(),
    );

    let roadmap = Roadmap {
        id: roadmap_id.clone(),
        title: roadmap_title,
        description: roadmap_desc,
        estimated_total_hours: estimated_hours,
        created_at: Utc::now(),
    };

    let (stages, tasks, resources, flashcards) = stage_details_to_models(roadmap_id.clone(), stage_details);

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

    for flashcard in &flashcards {
        db.create_flashcard(flashcard).await?;
    }
    info!("  ✓ flashcards 表写入完成 ({} 条)", flashcards.len());
    drop(db);
    info!("→ [数据库] 写入完成，耗时 {:.1}s", db_t0.elapsed().as_secs_f64());

    info!("→ [生成] 路线 ID：{}", roadmap.id);
    info!("→ [生成] 总耗时 {:.1}s | 阶段:{}, 任务:{}, 资源:{}, 记忆卡:{}, 占位:{}",
        total_t0.elapsed().as_secs_f64(), stages.len(), tasks.len(), resources.len(), flashcards.len(), fallback_count);

    // 9. Emit completed
    emit_roadmap_progress(
        &app_handle, "completed", total, total, None,
        &format!("学习路线「{}」生成完成！", roadmap.title),
    );

    // 10. Build response
    let mut stage_responses = Vec::new();
    for stage in &stages {
        let stage_tasks: Vec<_> = tasks.iter()
            .filter(|t| t.stage_id == stage.id)
            .collect();

        let mut task_responses = Vec::new();
        for task in stage_tasks {
            let task_resources: Vec<ResourceResponse> = resources.iter()
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
                title: task.title.clone(),
                content: task.content.clone(),
                task_type: task.task_type.clone(),
                code_example: task.code_example.clone(),
                exercise: task.exercise.clone(),
                resources: task_resources,
            });
        }

        stage_responses.push(crate::models::StageResponse {
            id: stage.id.clone(),
            order: stage.order,
            name: stage.name.clone(),
            objective: stage.objective.clone(),
            estimated_hours: stage.estimated_hours,
            stage_type: stage.stage_type.clone(),
            is_locked: stage.is_locked,
            is_fallback: stage.metadata.as_deref().map(|s| s.contains("\"is_fallback\":true")).unwrap_or(false),
            pass_threshold: stage.pass_threshold,
            tasks: task_responses,
            quiz: None,
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

    let roadmap = db.get_roadmap(&id).await?
        .ok_or("未找到路线图")?;

    let stages = db.get_stages_by_roadmap(&id).await?;

    let mut stage_responses = Vec::new();

    for stage in stages {
        let quiz = stage.quiz_json.as_ref().and_then(|q| {
            serde_json::from_str::<Quiz>(q).ok()
        });

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
                title: task.title,
                content: task.content,
                task_type: task.task_type,
                code_example: task.code_example,
                exercise: task.exercise,
                resources: resource_responses,
            });
        }

        stage_responses.push(crate::models::StageResponse {
            id: stage.id,
            order: stage.order,
            name: stage.name,
            objective: stage.objective,
            estimated_hours: stage.estimated_hours,
            stage_type: stage.stage_type,
            is_locked: stage.is_locked,
            is_fallback: stage.metadata.as_deref().map(|s| s.contains("\"is_fallback\":true")).unwrap_or(false),
            pass_threshold: stage.pass_threshold,
            tasks: task_responses,
            quiz,
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
pub async fn get_all_roadmaps(
    state: State<'_, AppState>,
) -> Result<Vec<Roadmap>, String> {
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

// Quiz submission request
#[derive(Debug, Deserialize)]
pub struct QuizSubmission {
    pub stage_id: String,
    pub answers: Vec<usize>,
}

// Quiz result response
#[derive(Debug, Serialize)]
pub struct QuizResult {
    pub passed: bool,
    pub score: f64,
    pub correct_count: usize,
    pub total_questions: usize,
    pub feedback: Vec<QuestionFeedback>,
}

#[derive(Debug, Serialize)]
pub struct QuestionFeedback {
    pub question_id: String,
    pub correct: bool,
    pub correct_index: usize,
    pub explanation: String,
}

#[tauri::command]
pub async fn submit_quiz(
    state: State<'_, AppState>,
    submission: QuizSubmission,
) -> Result<QuizResult, String> {
    info!("正在提交阶段测验：{}", submission.stage_id);

    let db = state.db.lock().await;

    let stage = db.get_stage_by_id(&submission.stage_id).await?
        .ok_or("未找到阶段")?;

    let quiz = stage.quiz_json.as_ref()
        .and_then(|q| serde_json::from_str::<Quiz>(q).ok())
        .ok_or("此阶段没有测验")?;

    let mut correct_count = 0;
    let mut feedback = Vec::new();

    for (i, question) in quiz.questions.iter().enumerate() {
        let user_answer = submission.answers.get(i).copied().unwrap_or(usize::MAX);
        let is_correct = user_answer == question.correct_index;
        if is_correct {
            correct_count += 1;
        }
        feedback.push(QuestionFeedback {
            question_id: question.id.clone(),
            correct: is_correct,
            correct_index: question.correct_index,
            explanation: question.explanation.clone(),
        });
    }

    let score = correct_count as f64 / quiz.questions.len() as f64;
    let passed = score >= stage.pass_threshold;

    info!("测验结果：通过={}，分数={:.2}", passed, score);

    if passed {
        db.unlock_next_stage(&submission.stage_id).await?;
        info!("已解锁下一阶段：{}", submission.stage_id);
    }

    Ok(QuizResult {
        passed,
        score,
        correct_count,
        total_questions: quiz.questions.len(),
        feedback,
    })
}

#[tauri::command]
pub async fn delete_roadmap(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
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
    db.update_resource(&request.id, &request.title, &request.url, &request.snippet, &request.resource_type).await?;
    info!("更新学习资源：{}", request.title);
    Ok(())
}

#[tauri::command]
pub async fn delete_resource(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.delete_resource(&id).await?;
    info!("删除学习资源：{}", id);
    Ok(())
}

#[tauri::command]
pub async fn search_resource(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<crate::services::parallel::ResourceDetail>, String> {
    let api_key = {
        let db = state.db.lock().await;
        db.get_api_key("tavily")
            .await?
            .ok_or_else(|| "Tavily API Key 未配置，请在设置中填写".to_string())?
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    tavily::search_resources(&client, &api_key, &query, 5).await
}
