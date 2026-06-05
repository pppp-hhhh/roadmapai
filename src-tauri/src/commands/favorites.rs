use crate::models::Favorite;
use crate::AppState;
use serde::Deserialize;
use tauri::State;
use tracing::info;

#[derive(Debug, Deserialize)]
pub struct AddFavoriteInput {
    #[serde(rename = "type")]
    pub fav_type: String,
    pub ref_id: String,
    pub roadmap_id: Option<String>,
    pub title: String,
    pub preview: Option<String>,
}

#[tauri::command]
pub async fn list_favorites(
    state: State<'_, AppState>,
    filter_type: Option<String>,
) -> Result<Vec<Favorite>, String> {
    let db = state.db.lock().await;
    db.list_favorites(filter_type.as_deref()).await
}

#[tauri::command]
pub async fn add_favorite(
    state: State<'_, AppState>,
    input: AddFavoriteInput,
) -> Result<Favorite, String> {
    info!("添加收藏: type={}, ref_id={}", input.fav_type, input.ref_id);

    // 校验 type 在白名单内,避免脏数据
    if !["task", "resource", "message", "flashcard"].contains(&input.fav_type.as_str()) {
        return Err(format!("非法的 favorite type: {}", input.fav_type));
    }

    let fav = Favorite::new(
        input.fav_type,
        input.ref_id,
        input.roadmap_id,
        input.title,
        input.preview,
    );

    let db = state.db.lock().await;
    db.add_favorite(&fav).await
}

#[tauri::command]
pub async fn remove_favorite(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    info!("删除收藏: {}", id);
    let db = state.db.lock().await;
    db.remove_favorite(&id).await
}
