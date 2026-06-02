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
    pub task_outlines: Vec<TaskOutline>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskOutline {
    pub order: usize,
    pub title: String,
    pub task_type: String,
}

/// Layer 3 输出：单个任务的完整内容（内容 + 资源 + 抽认卡）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskContent {
    pub order: usize,
    pub title: String,
    pub task_type: String,
    pub content: String,
    pub code_example: Option<String>,
    pub exercise: Option<String>,
    pub resources: Vec<ResourceDetail>,
    pub flashcards: Vec<FlashcardItem>,
}

/// Layer 4 输出：任务的资源 + 抽认卡
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskAugment {
    pub order: usize,
    pub resources: Vec<ResourceDetail>,
    pub flashcards: Vec<FlashcardItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageDetail {
    pub order: usize,
    pub title: String,
    pub description: String,
    pub tasks: Vec<TaskDetail>,
    pub flashcards: Vec<FlashcardItem>,
    pub is_fallback: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDetail {
    pub title: String,
    pub content: String,
    pub task_type: String,
    pub code_example: Option<String>,
    pub exercise: Option<String>,
    pub resources: Vec<ResourceDetail>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceDetail {
    pub title: String,
    pub url: String,
    pub snippet: Option<String>,
    pub resource_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlashcardItem {
    pub question: String,
    pub answer: String,
}

impl StageDetail {
    pub fn fallback(outline: &StageOutline) -> Self {
        Self {
            order: outline.order,
            title: outline.title.clone(),
            description: format!(
                "**本阶段标题：** {}\n\n**阶段简介：** {}\n\n---\n\n⚠️ **AI 暂时无法为本阶段生成详细内容**，已使用占位内容。你可以：\n\n1. 在首页重新生成整条路线（推荐）\n2. 稍后重试此路线\n3. 手动为本阶段添加学习内容\n\n> 阶段标题和大纲（来自 AI 大纲生成阶段）已保留，可作为学习参考。",
                outline.title, outline.brief
            ),
            tasks: vec![TaskDetail {
                title: format!("📖 {}：基础概念", outline.title),
                content: format!(
                    "## 阶段目标\n\n{}\n\n## 学习建议\n\n由于 AI 暂时无法生成详细内容，请参考以下方式继续学习：\n\n- **从基础开始**：先搜索「{} 入门教程」\n- **动手实践**：跟随官方文档或教程搭建一个简单的示例项目\n- **参考资源**：YouTube、Bilibili、慕课网等平台都有大量入门教程\n- **遇到问题**：在 GitHub、Stack Overflow、CSDN、知乎搜索解决方案\n\n> 完成本阶段后，记得回来勾选此任务以更新学习进度。",
                    outline.title, outline.brief
                ),
                task_type: "reading".to_string(),
                code_example: None,
                exercise: Some(format!("尝试搜索「{}」相关的入门教程并完成第一个示例", outline.title)),
                resources: vec![],
            }],
            flashcards: vec![],
            is_fallback: true,
        }
    }
}
