use crate::models::{Flashcard, Resource, Roadmap, Settings, Stage, Task};
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

            info!("数据库迁移 v2 完成：添加 metadata 列");
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

    // ============ Custom API Config DAO ============

    pub async fn save_api_config(
        &self,
        provider: &str,
        base_url: &str,
        model: &str,
        provider_type: Option<&str>,
    ) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO api_keys (provider, api_key)
            VALUES (?, ?)
            "#,
        )
        .bind(format!("{}_base_url", provider))
        .bind(base_url)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法保存 base_url: {}", e))?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO api_keys (provider, api_key)
            VALUES (?, ?)
            "#,
        )
        .bind(format!("{}_model", provider))
        .bind(model)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("无法保存模型: {}", e))?;

        if let Some(pt) = provider_type {
            sqlx::query(
                r#"
                INSERT OR REPLACE INTO api_keys (provider, api_key)
                VALUES (?, ?)
                "#,
            )
            .bind(format!("{}_provider_type", provider))
            .bind(pt)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("无法保存 provider_type: {}", e))?;
        }

        Ok(())
    }

    pub async fn get_api_config(&self, provider: &str) -> Result<(Option<String>, Option<String>, Option<String>), String> {
        let base_url = sqlx::query_as::<_, (String,)>(
            "SELECT api_key FROM api_keys WHERE provider = ?",
        )
        .bind(format!("{}_base_url", provider))
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| format!("无法获取 base_url: {}", e))?
        .map(|(key,)| key);

        let model = sqlx::query_as::<_, (String,)>(
            "SELECT api_key FROM api_keys WHERE provider = ?",
        )
        .bind(format!("{}_model", provider))
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| format!("无法获取模型: {}", e))?
        .map(|(key,)| key);

        let provider_type = sqlx::query_as::<_, (String,)>(
            "SELECT api_key FROM api_keys WHERE provider = ?",
        )
        .bind(format!("{}_provider_type", provider))
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| format!("无法获取 provider_type: {}", e))?
        .map(|(key,)| key);

        Ok((base_url, model, provider_type))
    }
}
