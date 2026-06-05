use crate::models::{ApiConfig, ChatMessageRow, ChatSession, Favorite, Flashcard, Resource, Roadmap, Settings, Stage, Task};
use chrono::{DateTime, Utc};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use tauri::{AppHandle, Manager};
use tracing::info;

pub struct Database {
    pool: SqlitePool,
}

impl Database {
    /// Create a new database connection and run migrations
    pub async fn new(app_handle: &AppHandle) -> Result<Self, String> {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("无法获取应用数据目录: {}", e))?;

        std::fs::create_dir_all(&app_dir)
            .map_err(|e| format!("无法创建应用数据目录: {}", e))?;

        let db_path = app_dir.join("app_data.db");
        let database_url = format!("sqlite:{}?mode=rwc", db_path.display());

        info!("正在初始化数据库: {}", db_path.display());

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .map_err(|e| format!("无法连接数据库: {}", e))?;

        let db = Self { pool };
        db.run_migrations().await?;

        info!("数据库初始化成功");
        Ok(db)
    }

    /// Run database migrations
    async fn run_migrations(&self) -> Result<(), String> {
        // Schema version tracking — bump this when adding new columns/tables
        sqlx::query("CREATE TABLE IF NOT EXISTS _schema_version (version INTEGER NOT NULL)")
            .execute(&self.pool)
            .await
            .map_err(|e| format!("数据库迁移失败: {}", e))?;

        let current_version: i32 = sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM _schema_version")
            .fetch_one(&self.pool)
            .await
            .unwrap_or(0);

        if current_version < 1 {
            sqlx::query(
                r#"
                CREATE TABLE IF NOT EXISTS roadmaps (
                    id TEXT PRIMARY KEY NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    estimated_total_hours REAL NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS stages (
                    id TEXT PRIMARY KEY NOT NULL,
                    roadmap_id TEXT NOT NULL,
                    order_index INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    objective TEXT NOT NULL,
                    estimated_hours REAL NOT NULL,
                    stage_type TEXT NOT NULL DEFAULT 'learning',
                    is_locked INTEGER NOT NULL DEFAULT 1,
                    quiz_json TEXT,
                    pass_threshold REAL NOT NULL DEFAULT 0.7,
                    FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY NOT NULL,
                    stage_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    task_type TEXT NOT NULL,
                    code_example TEXT,
                    exercise TEXT,
                    is_completed INTEGER NOT NULL DEFAULT 0,
                    completed_at TEXT,
                    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS resources (
                    id TEXT PRIMARY KEY NOT NULL,
                    task_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    url TEXT NOT NULL,
                    snippet TEXT,
                    resource_type TEXT NOT NULL,
                    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS flashcards (
                    id TEXT PRIMARY KEY NOT NULL,
                    roadmap_id TEXT NOT NULL,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    repetitions INTEGER NOT NULL DEFAULT 0,
                    ease_factor REAL NOT NULL DEFAULT 2.5,
                    interval INTEGER NOT NULL DEFAULT 0,
                    next_review_date TEXT NOT NULL,
                    FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS settings (
                    id TEXT PRIMARY KEY NOT NULL,
                    ai_provider TEXT NOT NULL DEFAULT 'openai',
                    theme TEXT NOT NULL DEFAULT 'dark',
                    default_weekly_hours INTEGER NOT NULL DEFAULT 10
                );

                CREATE TABLE IF NOT EXISTS api_keys (
                    provider TEXT PRIMARY KEY NOT NULL,
                    api_key TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_stages_roadmap ON stages(roadmap_id);
                CREATE INDEX IF NOT EXISTS idx_tasks_stage ON tasks(stage_id);
                CREATE INDEX IF NOT EXISTS idx_resources_task ON resources(task_id);
                CREATE INDEX IF NOT EXISTS idx_flashcards_roadmap ON flashcards(roadmap_id);
                CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON flashcards(next_review_date);
                "#,
            )
            .execute(&self.pool)
            .await
            .map_err(|e| format!("数据库迁移失败: {}", e))?;

            sqlx::query("INSERT INTO _schema_version (version) VALUES (1)")
                .execute(&self.pool)
                .await
                .map_err(|e| format!("数据库迁移失败: {}", e))?;
        }

        // v2: Add metadata column to stages for parallel generation fallback info
        if current_version < 2 {
            sqlx::query("ALTER TABLE stages ADD COLUMN metadata TEXT")
                .execute(&self.pool)
                .await
                .map_err(|e| format!("数据库迁移 v2 失败: {}", e))?;

            sqlx::query("INSERT INTO _schema_version (version) VALUES (2)")
                .execute(&self.pool)
                .await
                .map_err(|e| format!("数据库迁移失败: {}", e))?;

            info!("数据库迁移 v2 完成:添加 metadata 列");
        }

        // v3 (v1.1): favorites table for AI-loop close-the-loop
        if current_version < 3 {
            sqlx::query(
                r#"
                CREATE TABLE IF NOT EXISTS favorites (
                    id TEXT PRIMARY KEY NOT NULL,
                    type TEXT NOT NULL,           -- 'task' | 'resource' | 'message' | 'flashcard'
                    ref_id TEXT NOT NULL,
                    roadmap_id TEXT,
                    title TEXT NOT NULL,
                    preview TEXT,
                    created_at TEXT NOT NULL,
                    UNIQUE(type, ref_id)
                );
                CREATE INDEX IF NOT EXISTS idx_favorites_type ON favorites(type);
                CREATE INDEX IF NOT EXISTS idx_favorites_roadmap ON favorites(roadmap_id);
                "#,
            )
            .execute(&self.pool)
            .await
            .map_err(|e| format!("数据库迁移 v3 失败: {}", e))?;

            sqlx::query("INSERT INTO _schema_version (version) VALUES (3)")
                .execute(&self.pool)
                .await
                .map_err(|e| format!("数据库迁移 v3 记录失败: {}", e))?;

            info!("数据库迁移 v3 完成:添加 favorites 表");
        }

        // v4 (v1.1): 独立 api_configs 表,替换 api_keys 表里塞的 base_url/model/type
        if current_version < 4 {
            sqlx::query(
                r#"
                CREATE TABLE IF NOT EXISTS api_configs (
                    provider TEXT PRIMARY KEY NOT NULL,
                    base_url TEXT NOT NULL DEFAULT '',
                    model TEXT NOT NULL DEFAULT '',
                    provider_type TEXT NOT NULL DEFAULT 'openai'
                );

                -- 从旧 api_keys 表迁移数据(若有)
                INSERT OR IGNORE INTO api_configs (provider, base_url, model, provider_type)
                SELECT
                    replace(replace(provider, '_base_url', ''), '_model', '') AS provider,
                    '' AS base_url,
                    '' AS model,
                    'openai' AS provider_type
                FROM api_keys
                WHERE provider LIKE '%_base_url' OR provider LIKE '%_model' OR provider LIKE '%_provider_type'
                GROUP BY provider;

                -- 清理 api_keys 里被滥用的字段
                DELETE FROM api_keys
                WHERE provider LIKE '%_base_url'
                   OR provider LIKE '%_model'
                   OR provider LIKE '%_provider_type';
                "#,
            )
            .execute(&self.pool)
            .await
            .map_err(|e| format!("数据库迁移 v4 失败: {}", e))?;

            sqlx::query("INSERT INTO _schema_version (version) VALUES (4)")
                .execute(&self.pool)
                .await
                .map_err(|e| format!("数据库迁移 v4 记录失败: {}", e))?;

            info!("数据库迁移 v4 完成:独立 api_configs 表");
        }

        // v5 (v1.1): chat_sessions + chat_messages 实现多轮对话记忆
        if current_version < 5 {
            sqlx::query(
                r#"
                CREATE TABLE IF NOT EXISTS chat_sessions (
                    id TEXT PRIMARY KEY NOT NULL,
                    roadmap_id TEXT,
                    title TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS chat_messages (
                    id TEXT PRIMARY KEY NOT NULL,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,           -- 'user' | 'assistant' | 'system'
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_chat_messages_session
                    ON chat_messages(session_id, created_at);
                "#,
            )
            .execute(&self.pool)
            .await
            .map_err(|e| format!("数据库迁移 v5 失败: {}", e))?;

            sqlx::query("INSERT INTO _schema_version (version) VALUES (5)")
                .execute(&self.pool)
                .await
                .map_err(|e| format!("数据库迁移 v5 记录失败: {}", e))?;

            info!("数据库迁移 v5 完成:chat_sessions / chat_messages 表");
        }

        // Add future migrations here as `if current_version < N { ... }` blocks

        // Insert default settings if not exists
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO settings (id, ai_provider, theme, default_weekly_hours)
            VALUES ('default', 'openai', 'dark', 10)
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法插入默认设置: {}", e))?;

        Ok(())
    }

    // ============ Roadmap DAO ============

    pub async fn create_roadmap(&self, roadmap: &Roadmap) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO roadmaps (id, title, description, estimated_total_hours, created_at)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(&roadmap.id)
        .bind(&roadmap.title)
        .bind(&roadmap.description)
        .bind(roadmap.estimated_total_hours)
        .bind(roadmap.created_at.to_rfc3339())
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法创建路线图: {}", e))?;

        Ok(())
    }

    pub async fn get_roadmap(&self, id: &str) -> Result<Option<Roadmap>, String> {
        let roadmap = sqlx::query_as::<_, Roadmap>(
            "SELECT id, title, description, estimated_total_hours, created_at FROM roadmaps WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| format!("无法获取路线图: {}", e))?;

        Ok(roadmap)
    }

    pub async fn get_all_roadmaps(&self) -> Result<Vec<Roadmap>, String> {
        let roadmaps = sqlx::query_as::<_, Roadmap>(
            "SELECT id, title, description, estimated_total_hours, created_at FROM roadmaps ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("无法获取路线图列表: {}", e))?;

        Ok(roadmaps)
    }

    pub async fn delete_roadmap(&self, id: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM roadmaps WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("无法删除路线图: {}", e))?;

        Ok(())
    }

    // ============ Stage DAO ============

    pub async fn create_stage(&self, stage: &Stage) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO stages (id, roadmap_id, order_index, name, objective, estimated_hours, stage_type, is_locked, quiz_json, pass_threshold, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&stage.id)
        .bind(&stage.roadmap_id)
        .bind(stage.order)
        .bind(&stage.name)
        .bind(&stage.objective)
        .bind(stage.estimated_hours)
        .bind(&stage.stage_type)
        .bind(stage.is_locked as i32)
        .bind(&stage.quiz_json)
        .bind(stage.pass_threshold)
        .bind(&stage.metadata)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法创建阶段: {}", e))?;

        Ok(())
    }

    pub async fn get_stages_by_roadmap(&self, roadmap_id: &str) -> Result<Vec<Stage>, String> {
        let stages = sqlx::query_as::<_, Stage>(
            r#"
            SELECT id, roadmap_id, order_index as `order`, name, objective, estimated_hours,
                   stage_type, is_locked as `is_locked`, quiz_json, pass_threshold, metadata
            FROM stages WHERE roadmap_id = ? ORDER BY order_index
            "#,
        )
        .bind(roadmap_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("无法获取阶段列表: {}", e))?;

        Ok(stages)
    }

    pub async fn get_stage_by_id(&self, stage_id: &str) -> Result<Option<Stage>, String> {
        let stage = sqlx::query_as::<_, Stage>(
            r#"
            SELECT id, roadmap_id, order_index as `order`, name, objective, estimated_hours,
                   stage_type, is_locked as `is_locked`, quiz_json, pass_threshold, metadata
            FROM stages WHERE id = ?
            "#,
        )
        .bind(stage_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| format!("无法获取阶段: {}", e))?;

        Ok(stage)
    }

    pub async fn unlock_next_stage(&self, current_stage_id: &str) -> Result<(), String> {
        // Get current stage to find its roadmap and order
        let current = self.get_stage_by_id(current_stage_id).await?
            .ok_or("未找到阶段")?;

        // Unlock the next stage (order + 1) in the same roadmap
        sqlx::query(
            r#"
            UPDATE stages SET is_locked = 0
            WHERE roadmap_id = ? AND order_index = ? AND is_locked = 1
            "#,
        )
        .bind(&current.roadmap_id)
        .bind(current.order + 1)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法解锁下一阶段: {}", e))?;

        Ok(())
    }

    pub async fn update_stage_lock(&self, stage_id: &str, is_locked: bool) -> Result<(), String> {
        sqlx::query("UPDATE stages SET is_locked = ? WHERE id = ?")
            .bind(is_locked as i32)
            .bind(stage_id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("无法更新阶段锁定状态: {}", e))?;

        Ok(())
    }

    // ============ Task DAO ============

    pub async fn create_task(&self, task: &Task) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO tasks (id, stage_id, title, content, task_type, code_example, exercise, is_completed, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&task.id)
        .bind(&task.stage_id)
        .bind(&task.title)
        .bind(&task.content)
        .bind(&task.task_type)
        .bind(&task.code_example)
        .bind(&task.exercise)
        .bind(task.is_completed as i32)
        .bind(task.completed_at.map(|d| d.to_rfc3339()))
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法创建任务: {}", e))?;

        Ok(())
    }

    pub async fn get_tasks_by_stage(&self, stage_id: &str) -> Result<Vec<Task>, String> {
        let tasks = sqlx::query_as::<_, Task>(
            r#"
            SELECT id, stage_id, title, content, task_type, code_example, exercise,
                   is_completed as `is_completed`, completed_at
            FROM tasks WHERE stage_id = ?
            "#,
        )
        .bind(stage_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("无法获取任务列表: {}", e))?;

        Ok(tasks)
    }

    pub async fn mark_task_completed(&self, task_id: &str, completed: bool) -> Result<(), String> {
        let completed_at = if completed {
            Some(Utc::now().to_rfc3339())
        } else {
            None
        };

        sqlx::query("UPDATE tasks SET is_completed = ?, completed_at = ? WHERE id = ?")
            .bind(completed as i32)
            .bind(completed_at)
            .bind(task_id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("无法更新任务: {}", e))?;

        Ok(())
    }

    pub async fn get_task_count_by_roadmap(&self, roadmap_id: &str) -> Result<(i32, i32), String> {
        let result = sqlx::query_as::<_, (i32, i32)>(
            r#"
            SELECT COUNT(*) as total, SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END) as completed
            FROM tasks t
            INNER JOIN stages s ON t.stage_id = s.id
            WHERE s.roadmap_id = ?
            "#,
        )
        .bind(roadmap_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("无法获取任务计数: {}", e))?;

        Ok(result)
    }

    // ============ Resource DAO ============

    pub async fn create_resource(&self, resource: &Resource) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO resources (id, task_id, title, url, snippet, resource_type)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&resource.id)
        .bind(&resource.task_id)
        .bind(&resource.title)
        .bind(&resource.url)
        .bind(&resource.snippet)
        .bind(&resource.resource_type)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法创建资源: {}", e))?;

        Ok(())
    }

    pub async fn update_resource(&self, id: &str, title: &str, url: &str, snippet: &str, resource_type: &str) -> Result<(), String> {
        sqlx::query(
            r#"
            UPDATE resources SET title = ?, url = ?, snippet = ?, resource_type = ?
            WHERE id = ?
            "#,
        )
        .bind(title)
        .bind(url)
        .bind(snippet)
        .bind(resource_type)
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法更新资源: {}", e))?;

        Ok(())
    }

    pub async fn delete_resource(&self, id: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM resources WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("无法删除资源: {}", e))?;

        Ok(())
    }

    pub async fn delete_tasks_by_stage(&self, stage_id: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM resources WHERE task_id IN (SELECT id FROM tasks WHERE stage_id = ?)")
            .bind(stage_id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("无法删除资源: {}", e))?;
        sqlx::query("DELETE FROM tasks WHERE stage_id = ?")
            .bind(stage_id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("无法删除任务: {}", e))?;
        Ok(())
    }

    pub async fn clear_stage_metadata(&self, stage_id: &str) -> Result<(), String> {
        sqlx::query("UPDATE stages SET metadata = NULL WHERE id = ?")
            .bind(stage_id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("无法更新阶段: {}", e))?;
        Ok(())
    }

    pub async fn get_resources_by_task(&self, task_id: &str) -> Result<Vec<Resource>, String> {
        let resources = sqlx::query_as::<_, Resource>(
            "SELECT id, task_id, title, url, snippet, resource_type FROM resources WHERE task_id = ?",
        )
        .bind(task_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("无法获取资源列表: {}", e))?;

        Ok(resources)
    }

    // ============ Flashcard DAO ============

    pub async fn create_flashcard(&self, flashcard: &Flashcard) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO flashcards (id, roadmap_id, question, answer, repetitions, ease_factor, interval, next_review_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&flashcard.id)
        .bind(&flashcard.roadmap_id)
        .bind(&flashcard.question)
        .bind(&flashcard.answer)
        .bind(flashcard.repetitions)
        .bind(flashcard.ease_factor)
        .bind(flashcard.interval)
        .bind(flashcard.next_review_date.to_rfc3339())
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法创建记忆卡: {}", e))?;

        Ok(())
    }

    pub async fn get_due_flashcards(&self) -> Result<Vec<Flashcard>, String> {
        let now = Utc::now().to_rfc3339();

        let flashcards = sqlx::query_as::<_, Flashcard>(
            r#"
            SELECT id, roadmap_id, question, answer, repetitions, ease_factor, interval, next_review_date
            FROM flashcards
            WHERE next_review_date <= ? AND repetitions > 0
            ORDER BY next_review_date
            "#,
        )
        .bind(now)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("无法获取待复习记忆卡: {}", e))?;

        Ok(flashcards)
    }

    pub async fn get_new_flashcards(&self) -> Result<Vec<Flashcard>, String> {
        let flashcards = sqlx::query_as::<_, Flashcard>(
            r#"
            SELECT id, roadmap_id, question, answer, repetitions, ease_factor, interval, next_review_date
            FROM flashcards
            WHERE repetitions = 0
            ORDER BY next_review_date
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("无法获取新记忆卡: {}", e))?;

        Ok(flashcards)
    }

    pub async fn mark_flashcard_learned(&self, card_id: &str) -> Result<(), String> {
        let tomorrow = (Utc::now() + chrono::Duration::days(1)).to_rfc3339();

        sqlx::query(
            r#"
            UPDATE flashcards
            SET repetitions = 1, interval = 1, next_review_date = ?
            WHERE id = ?
            "#,
        )
        .bind(tomorrow)
        .bind(card_id)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法更新学习状态: {}", e))?;

        Ok(())
    }

    pub async fn get_flashcard_by_id(&self, card_id: &str) -> Result<Option<Flashcard>, String> {
        let flashcard = sqlx::query_as::<_, Flashcard>(
            r#"
            SELECT id, roadmap_id, question, answer, repetitions, ease_factor, interval, next_review_date
            FROM flashcards WHERE id = ?
            "#,
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| format!("无法获取记忆卡: {}", e))?;

        Ok(flashcard)
    }

    pub async fn update_flashcard_review(
        &self,
        card_id: &str,
        repetitions: i32,
        ease_factor: f64,
        interval: i32,
        next_review_date: DateTime<Utc>,
    ) -> Result<(), String> {
        sqlx::query(
            r#"
            UPDATE flashcards
            SET repetitions = ?, ease_factor = ?, interval = ?, next_review_date = ?
            WHERE id = ?
            "#,
        )
        .bind(repetitions)
        .bind(ease_factor)
        .bind(interval)
        .bind(next_review_date.to_rfc3339())
        .bind(card_id)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法更新记忆卡: {}", e))?;

        Ok(())
    }

    // ============ Settings DAO ============

    pub async fn get_settings(&self) -> Result<Settings, String> {
        let settings = sqlx::query_as::<_, Settings>(
            "SELECT id, ai_provider, theme, default_weekly_hours FROM settings WHERE id = 'default'",
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("无法获取设置: {}", e))?;

        Ok(settings)
    }

    pub async fn update_settings(&self, settings: &Settings) -> Result<(), String> {
        sqlx::query(
            r#"
            UPDATE settings
            SET ai_provider = ?, theme = ?, default_weekly_hours = ?
            WHERE id = 'default'
            "#,
        )
        .bind(&settings.ai_provider)
        .bind(&settings.theme)
        .bind(settings.default_weekly_hours)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法更新设置: {}", e))?;

        Ok(())
    }

    pub async fn set_ai_provider(&self, provider: &str) -> Result<(), String> {
        sqlx::query("UPDATE settings SET ai_provider = ? WHERE id = 'default'")
            .bind(provider)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("无法更新 AI 提供商: {}", e))?;
        Ok(())
    }

    // ============ Favorites DAO (v1.1) ============

    pub async fn list_favorites(&self, filter_type: Option<&str>) -> Result<Vec<Favorite>, String> {
        let favorites = if let Some(t) = filter_type {
            sqlx::query_as::<_, Favorite>(
                r#"
                SELECT id, type, ref_id, roadmap_id, title, preview, created_at
                FROM favorites
                WHERE type = ?
                ORDER BY created_at DESC
                "#,
            )
            .bind(t)
            .fetch_all(&self.pool)
            .await
        } else {
            sqlx::query_as::<_, Favorite>(
                r#"
                SELECT id, type, ref_id, roadmap_id, title, preview, created_at
                FROM favorites
                ORDER BY created_at DESC
                "#,
            )
            .fetch_all(&self.pool)
            .await
        }
        .map_err(|e| format!("无法获取收藏列表: {}", e))?;

        Ok(favorites)
    }

    pub async fn add_favorite(&self, fav: &Favorite) -> Result<Favorite, String> {
        sqlx::query(
            r#"
            INSERT INTO favorites (id, type, ref_id, roadmap_id, title, preview, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(type, ref_id) DO UPDATE SET
                title = excluded.title,
                preview = excluded.preview,
                roadmap_id = excluded.roadmap_id
            "#,
        )
        .bind(&fav.id)
        .bind(&fav.fav_type)
        .bind(&fav.ref_id)
        .bind(&fav.roadmap_id)
        .bind(&fav.title)
        .bind(&fav.preview)
        .bind(fav.created_at.to_rfc3339())
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法添加收藏: {}", e))?;

        // ON CONFLICT 后返回最新记录
        let stored = sqlx::query_as::<_, Favorite>(
            "SELECT id, type, ref_id, roadmap_id, title, preview, created_at FROM favorites WHERE type = ? AND ref_id = ?",
        )
        .bind(&fav.fav_type)
        .bind(&fav.ref_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("无法读取刚添加的收藏: {}", e))?;

        Ok(stored)
    }

    pub async fn remove_favorite(&self, id: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM favorites WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("无法删除收藏: {}", e))?;
        Ok(())
    }

    pub async fn count_favorites(&self) -> Result<i32, String> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM favorites")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| format!("无法统计收藏: {}", e))?;
        Ok(count.0 as i32)
    }

    // ============ API Key DAO ============

    pub async fn save_api_key(&self, provider: &str, api_key: &str) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO api_keys (provider, api_key)
            VALUES (?, ?)
            "#,
        )
        .bind(provider)
        .bind(api_key)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法保存 API Key: {}", e))?;

        Ok(())
    }

    pub async fn get_api_key(&self, provider: &str) -> Result<Option<String>, String> {
        let result = sqlx::query_as::<_, (String,)>(
            "SELECT api_key FROM api_keys WHERE provider = ?",
        )
        .bind(provider)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| format!("无法获取 API Key: {}", e))?;

        Ok(result.map(|(key,)| key))
    }

    // ============ API Config DAO (v1.1 重构) ============

    pub async fn save_api_config(
        &self,
        provider: &str,
        base_url: &str,
        model: &str,
        provider_type: Option<&str>,
    ) -> Result<(), String> {
        let pt = provider_type.unwrap_or("openai");
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO api_configs (provider, base_url, model, provider_type)
            VALUES (?, ?, ?, ?)
            "#,
        )
        .bind(provider)
        .bind(base_url)
        .bind(model)
        .bind(pt)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法保存 API 配置: {}", e))?;

        Ok(())
    }

    pub async fn get_api_config(
        &self,
        provider: &str,
    ) -> Result<Option<ApiConfig>, String> {
        let config = sqlx::query_as::<_, ApiConfig>(
            "SELECT provider, base_url, model, provider_type FROM api_configs WHERE provider = ?",
        )
        .bind(provider)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| format!("无法获取 API 配置: {}", e))?;
        Ok(config)
    }

    // ============ Chat Session DAO (v1.1) ============

    pub async fn ensure_chat_session(&self, id: &str, roadmap_id: Option<&str>) -> Result<(), String> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO chat_sessions (id, roadmap_id, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            "#,
        )
        .bind(id)
        .bind(roadmap_id)
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法创建 chat session: {}", e))?;
        Ok(())
    }

    pub async fn touch_chat_session(&self, id: &str) -> Result<(), String> {
        let now = Utc::now().to_rfc3339();
        sqlx::query("UPDATE chat_sessions SET updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("无法更新 chat session: {}", e))?;
        Ok(())
    }

    pub async fn append_chat_message(
        &self,
        id: &str,
        session_id: &str,
        role: &str,
        content: &str,
    ) -> Result<ChatMessageRow, String> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO chat_messages (id, session_id, role, content, created_at)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(id)
        .bind(session_id)
        .bind(role)
        .bind(content)
        .bind(&now)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法插入 chat message: {}", e))?;

        let row = sqlx::query_as::<_, ChatMessageRow>(
            "SELECT id, session_id, role, content, created_at FROM chat_messages WHERE id = ?",
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("无法读取刚插入的 chat message: {}", e))?;
        Ok(row)
    }

    /// 拉取 session 最近 N 条消息,按时间升序
    pub async fn get_chat_history(
        &self,
        session_id: &str,
        limit: i64,
    ) -> Result<Vec<ChatMessageRow>, String> {
        let rows = sqlx::query_as::<_, ChatMessageRow>(
            r#"
            SELECT id, session_id, role, content, created_at
            FROM chat_messages
            WHERE session_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            "#,
        )
        .bind(session_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("无法读取 chat 历史: {}", e))?;
        // 翻转成时间升序
        let mut rows = rows;
        rows.reverse();
        Ok(rows)
    }

    pub async fn list_chat_sessions(&self) -> Result<Vec<ChatSession>, String> {
        let rows = sqlx::query_as::<_, ChatSession>(
            "SELECT id, roadmap_id, title, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC LIMIT 50",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("无法列出 chat session: {}", e))?;
        Ok(rows)
    }
}
