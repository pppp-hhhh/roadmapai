pub mod commands;
pub mod db;
pub mod models;
pub mod services;

pub use db::Database;
pub use models::*;
pub use services::*;

use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Manager;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

pub struct AppState {
    pub db: Arc<Mutex<Database>>,
}

fn setup_logging() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(filter)
        .init();

    tracing::info!("AI 学习路线规划器启动中...");
}

pub fn run() {
    setup_logging();

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            tauri::async_runtime::block_on(async {
                let db = Database::new(&app_handle)
                    .await
                    .expect("数据库初始化失败");

                let state = AppState {
                    db: Arc::new(Mutex::new(db)),
                };

                app_handle.manage(state);
                tracing::info!("数据库初始化成功");
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::roadmap::generate_roadmap,
            commands::roadmap::get_roadmap,
            commands::roadmap::get_all_roadmaps,
            commands::roadmap::delete_roadmap,
            commands::roadmap::mark_task_completed,
            commands::roadmap::submit_quiz,
            commands::roadmap::add_resource,
            commands::roadmap::update_resource,
            commands::roadmap::delete_resource,
            commands::roadmap::retry_stage,
            commands::flashcard::create_flashcard,
            commands::flashcard::get_due_flashcards,
            commands::flashcard::get_new_flashcards,
            commands::flashcard::get_flashcard_detail,
            commands::flashcard::learn_flashcard,
            commands::flashcard::review_flashcard,
            commands::settings::save_api_key,
            commands::settings::get_api_key,
            commands::settings::save_api_config,
            commands::settings::get_api_config,
            commands::settings::test_connection,
            commands::settings::set_ai_provider,
            commands::chat::chat_send,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 应用运行异常");
}
