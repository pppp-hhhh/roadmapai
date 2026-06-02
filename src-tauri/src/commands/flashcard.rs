use crate::AppState;
use crate::models::{Flashcard, FlashcardDetail};
use chrono::{Duration, Utc};
use serde::Deserialize;
use tauri::State;
use tracing::info;

#[derive(Debug, Deserialize)]
pub struct CreateFlashcardRequest {
    pub roadmap_id: String,
    pub question: String,
    pub answer: String,
}

#[tauri::command]
pub async fn get_due_flashcards(
    state: State<'_, AppState>,
) -> Result<Vec<Flashcard>, String> {
    let db = state.db.lock().await;
    let flashcards = db.get_due_flashcards().await?;
    info!("找到 {} 张待复习的记忆卡", flashcards.len());
    Ok(flashcards)
}

#[tauri::command]
pub async fn create_flashcard(
    state: State<'_, AppState>,
    request: CreateFlashcardRequest,
) -> Result<Flashcard, String> {
    let db = state.db.lock().await;

    let flashcard = Flashcard::new(request.roadmap_id, request.question, request.answer);
    db.create_flashcard(&flashcard).await?;

    info!("创建记忆卡：{} ({})", flashcard.question, flashcard.id);
    Ok(flashcard)
}

/// Quality ratings for SM-2 algorithm:
/// 0 - Complete blackout
/// 1 - Incorrect, but recognized answer
/// 2 - Incorrect, easy to recall
/// 3 - Correct with difficulty
/// 4 - Correct with hesitation
/// 5 - Perfect recall
#[tauri::command]
pub async fn review_flashcard(
    state: State<'_, AppState>,
    card_id: String,
    quality: u8,
) -> Result<(), String> {
    let db = state.db.lock().await;

    // Get the flashcard
    let flashcards = db.get_due_flashcards().await?;
    let flashcard = flashcards
        .into_iter()
        .find(|f| f.id == card_id)
        .ok_or("未找到记忆卡")?;

    // SM-2 algorithm implementation
    let (repetitions, ease_factor, interval, next_review) = calculate_sm2(
        flashcard.repetitions,
        flashcard.ease_factor,
        flashcard.interval,
        quality,
    );

    db.update_flashcard_review(
        &card_id,
        repetitions,
        ease_factor,
        interval,
        next_review,
    )
    .await?;

    info!(
        "已复习记忆卡 {}：质量={}，下次复习={}",
        card_id, quality, next_review
    );

    Ok(())
}

/// Calculate the next review using SM-2 algorithm
fn calculate_sm2(
    repetitions: i32,
    ease_factor: f64,
    interval: i32,
    quality: u8,
) -> (i32, f64, i32, chrono::DateTime<Utc>) {
    let q = quality as f64;

    // If quality < 3, start over (reset repetitions)
    if quality < 3 {
        let new_repetitions = 0;
        let new_interval = 1;
        let new_ease_factor = (ease_factor - 0.8 + 0.28 * q - 0.02 * q * q).max(1.3);
        let next_review = Utc::now() + Duration::days(new_interval as i64);
        return (new_repetitions, new_ease_factor, new_interval, next_review);
    }

    // Calculate new ease factor
    let new_ease_factor = ease_factor + (0.1 - (5.0 - q) * (0.08 + (5.0 - q) * 0.02));

    // Ensure ease factor doesn't go below 1.3
    let new_ease_factor = new_ease_factor.max(1.3);

    // Calculate new interval
    let new_repetitions = repetitions + 1;
    let new_interval = match new_repetitions {
        1 => 1,
        2 => 6,
        _ => (interval as f64 * new_ease_factor).round() as i32,
    };

    // Cap interval at 365 days
    let new_interval = new_interval.min(365);

    let next_review = Utc::now() + Duration::days(new_interval as i64);

    (
        new_repetitions,
        new_ease_factor,
        new_interval,
        next_review,
    )
}

#[tauri::command]
pub async fn get_flashcard_detail(
    state: State<'_, AppState>,
    card_id: String,
) -> Result<FlashcardDetail, String> {
    let db = state.db.lock().await;

    let flashcard = db.get_flashcard_by_id(&card_id)
        .await?
        .ok_or("未找到该记忆卡")?;

    let roadmap = db.get_roadmap(&flashcard.roadmap_id)
        .await?
        .ok_or("未找到关联的学习路线")?;

    let stages = db.get_stages_by_roadmap(&flashcard.roadmap_id).await?;

    let mut tasks = Vec::new();
    for stage in &stages {
        let stage_tasks = db.get_tasks_by_stage(&stage.id).await?;
        tasks.extend(stage_tasks);
    }

    let mut resources = Vec::new();
    for task in &tasks {
        let task_resources = db.get_resources_by_task(&task.id).await?;
        resources.extend(task_resources);
    }

    Ok(FlashcardDetail {
        flashcard,
        roadmap,
        stages,
        tasks,
        resources,
    })
}

#[tauri::command]
pub async fn get_new_flashcards(
    state: State<'_, AppState>,
) -> Result<Vec<Flashcard>, String> {
    let db = state.db.lock().await;
    let cards = db.get_new_flashcards().await?;
    info!("找到 {} 张新记忆卡待学习", cards.len());
    Ok(cards)
}

#[tauri::command]
pub async fn learn_flashcard(
    state: State<'_, AppState>,
    card_id: String,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.mark_flashcard_learned(&card_id).await?;
    info!("已学习记忆卡：{}，明天开始复习", card_id);
    Ok(())
}
