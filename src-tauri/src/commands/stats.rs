use crate::AppState;
use serde::Serialize;
use tauri::State;
use tracing::info;

#[derive(Debug, Serialize)]
pub struct UserStats {
    pub total_roadmaps: i32,
    pub total_tasks: i32,
    pub completed_tasks: i32,
    pub total_chat_messages: i32,
    pub total_favorites: i32,
}

#[tauri::command]
pub async fn get_user_stats(state: State<'_, AppState>) -> Result<UserStats, String> {
    info!("聚合用户统计数据...");

    let db = state.db.lock().await;

    let roadmaps = db.get_all_roadmaps().await?;
    let mut total_tasks: i32 = 0;
    let mut completed_tasks: i32 = 0;

    for r in &roadmaps {
        let (t, c) = db.get_task_count_by_roadmap(&r.id).await?;
        total_tasks += t;
        completed_tasks += c;
    }

    // 收藏
    let total_favorites = db.count_favorites().await?;

    // chat messages:暂无持久化,返回 0
    let total_chat_messages = 0;

    let stats = UserStats {
        total_roadmaps: roadmaps.len() as i32,
        total_tasks,
        completed_tasks,
        total_chat_messages,
        total_favorites,
    };

    info!(
        "统计: 路线 {}, 任务 {}/{}, 收藏 {}",
        stats.total_roadmaps, stats.completed_tasks, stats.total_tasks, stats.total_favorites
    );

    Ok(stats)
}
