use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageOutline {
    pub order: usize,
    pub title: String,
    pub brief: String,
}

/// Layer 2 输出：阶段描述 + 任务骨架列表
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageOutlineOnly {
    pub order: usize,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub prerequisites: Vec<String>,
    pub task_outlines: Vec<TaskOutline>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskOutline {
    pub order: usize,
    pub title: String,
    pub task_type: String,
    #[serde(default)]
    pub prerequisites: Vec<String>,
}

/// Layer 3 输出：单个任务的完整内容（要点 + 资源 + 示例）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskContent {
    pub order: usize,
    pub title: String,
    pub task_type: String,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub points: Vec<String>,
    #[serde(default)]
    pub prerequisites: Vec<String>,
    pub example: Option<String>,
    pub resources: Vec<ResourceDetail>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageDetail {
    pub order: usize,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub prerequisites: Vec<String>,
    pub tasks: Vec<TaskDetail>,
    pub is_fallback: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDetail {
    pub order: usize,
    pub title: String,
    pub content: String,
    #[serde(default)]
    pub points: Vec<String>,
    #[serde(default)]
    pub prerequisites: Vec<String>,
    pub task_type: String,
    pub example: Option<String>,
    pub resources: Vec<ResourceDetail>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceDetail {
    pub title: String,
    pub url: String,
    pub snippet: Option<String>,
    pub resource_type: String,
}

impl StageDetail {
    pub fn fallback(outline: &StageOutline) -> Self {
        Self {
            order: outline.order,
            title: outline.title.clone(),
            prerequisites: vec![],
            description: format!(
                "**本阶段标题：** {}\n\n**阶段简介：** {}\n\n---\n\n⚠️ **AI 暂时无法为本阶段生成详细内容**，已使用占位内容。你可以：\n\n1. 在首页重新生成整条路线（推荐）\n2. 稍后重试此路线\n3. 手动为本阶段添加学习内容\n\n> 阶段标题和大纲（来自 AI 大纲生成阶段）已保留，可作为学习参考。",
                outline.title, outline.brief
            ),
            tasks: vec![TaskDetail {
                order: 1,
                title: format!("📖 {}：基础概念", outline.title),
                content: format!(
                    "## 阶段目标\n\n{}\n\n## 学习建议\n\n由于 AI 暂时无法生成详细内容，请参考以下方式继续学习：\n\n- **从基础开始**：先搜索「{} 入门教程」\n- **动手实践**：按该领域的常见方式完成一个小练习、作品或案例\n- **参考资源**：官方文档、专业书籍、B站/慕课类平台都有大量入门内容\n- **遇到问题**：在专业社区、知乎或官方文档中搜索解决方案\n- **自测**：搜索「{}」相关入门教程并完成第一个示例或练习\n\n> 完成本阶段后，记得回来勾选此任务以更新学习进度。",
                    outline.title, outline.title, outline.title
                ),
                points: vec![format!("了解「{}」的核心概念与整体框架", outline.title)],
                prerequisites: vec![],
                task_type: "reading".to_string(),
                example: None,
                resources: vec![],
            }],
            is_fallback: true,
        }
    }
}

pub fn parse_string_array(s: &str) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(s).unwrap_or_default()
}

pub fn json_array_string(items: &[String]) -> String {
    serde_json::to_string(items).unwrap_or_else(|_| "[]".to_string())
}
