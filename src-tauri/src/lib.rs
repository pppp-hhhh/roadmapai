pub mod commands;
pub mod db;
pub mod models;
pub mod services;

pub use db::Database;
pub use models::*;
pub use services::*;

use std::sync::atomic::AtomicUsize;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

pub struct AppState {
    pub db: Arc<Mutex<Database>>,
    pub gen_cancel: Arc<AtomicUsize>,
    _log_guard: tracing_appender::non_blocking::WorkerGuard,
}

fn setup_logging(app: &tauri::App) -> tracing_appender::non_blocking::WorkerGuard {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    let log_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir());
    let _ = std::fs::create_dir_all(&log_dir);
    let file = tracing_appender::rolling::daily(&log_dir, "roadmapai.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file);

    tracing_subscriber::registry()
        .with(fmt::layer().with_writer(std::io::stdout))
        .with(fmt::layer().with_writer(non_blocking).with_ansi(false))
        .with(filter)
        .init();

    tracing::info!("AI 学习路线规划器启动中，日志目录：{}", log_dir.display());
    guard
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let log_guard = setup_logging(app);
            let app_handle = app.handle().clone();

            tauri::async_runtime::block_on(async {
                let db = Database::new(&app_handle).await.expect("数据库初始化失败");

                let state = AppState {
                    db: Arc::new(Mutex::new(db)),
                    gen_cancel: Arc::new(AtomicUsize::new(0)),
                    _log_guard: log_guard,
                };

                app_handle.manage(state);
                tracing::info!("数据库初始化成功");
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::roadmap::generate_roadmap,
            commands::roadmap::cancel_generation,
            commands::roadmap::get_roadmap,
            commands::roadmap::get_all_roadmaps,
            commands::roadmap::delete_roadmap,
            commands::roadmap::mark_task_completed,
            commands::roadmap::add_resource,
            commands::roadmap::update_resource,
            commands::roadmap::delete_resource,
            commands::roadmap::retry_stage,
            commands::roadmap::add_task_to_stage,
            commands::intake::intake_ask,
            commands::intake::intake_summarize,
            commands::optimize::optimize_roadmap,
            commands::settings::save_api_key,
            commands::settings::get_api_key,
            commands::settings::save_api_config,
            commands::settings::get_api_config,
            commands::settings::test_connection,
            commands::settings::set_ai_provider,
            commands::settings::detect_user_region,
            commands::chat::chat_send,
            commands::chat::list_chat_sessions,
            commands::favorites::list_favorites,
            commands::favorites::add_favorite,
            commands::favorites::remove_favorite,
            commands::stats::get_user_stats,
            commands::ai_loop::refine_task_content,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 应用运行异常");
}
