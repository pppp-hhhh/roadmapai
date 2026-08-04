<p align="center">
  <h1 align="center">RoadmapAI</h1>
  <p align="center">AI 驱动的个性化学习路线生成器</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri&logoColor=white" alt="Tauri 2.0">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React 18">
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Rust-1.70+-dea584?logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

<p align="center">
  <img src="docs/screenshots/hero.svg" alt="RoadmapAI · 学者的手稿" width="720">
</p>

---

## 📸 预览 / Preview

| 首页 · 我的学习路线 | 访谈生成 |
|:---:|:---:|
| ![首页](docs/screenshots/home.png) | ![访谈](docs/screenshots/intake.png) |
| **路线详情 · 横向章节** | **AI 伙伴 · 浮窗陪读** |
| ![路线详情](docs/screenshots/roadmap-detail.png) | ![浮窗](docs/screenshots/ai-companion.png) |
| **AI 导师 · 全屏对话** | **收藏夹 · 直达内容** |
| ![AI 导师](docs/screenshots/ai-tutor.png) | ![收藏夹](docs/screenshots/favorites.png) |

> 📂 截图存放在 [`docs/screenshots/`](docs/screenshots/)。本地预览时相对路径即可；若推送到 GitHub 后图片未显示，请确认仓库为 **public** 或已开启 Pages 资源代理。

---

## 简介 / Introduction

一款桌面端学习路线生成器。它通过 AI 多轮访谈挖掘学习目标与现状，再生成带前置依赖的学习路线；路线详情页可调用全局 AI 伙伴浮窗，在任意阶段/任务上获得结合当前进度的解答。

A desktop learning companion. It first chats with you about what you want to learn and where you're stuck, then builds an ordered roadmap. A small window sits in the corner and keeps that context, so you can ask questions anytime and get answers tied to your current stage and task.

---

## ✨ 功能 / Features

- **AI 多轮访谈生成** — 通过对话逐步明确目标、基础、偏好与约束；对话满 10 轮后可手动生成画像摘要，也可中途补充信息
- **带前置依赖的路线** — 阶段、任务显式标注 prerequisites；阶段与任务数量由 AI 按主题广度自适应
- **全局 AI 伙伴浮窗** — 可拖动、可收起/展开；路线详情页自动绑定当前阶段/任务，回答结合路线、前置依赖、用户画像与当前进度
- **生成后局部优化** — 可选中整体/阶段/任务提交评价，AI 重绘对应部分，并保留同名任务的完成进度
- **三层并行生成** — 协调器 → 阶段 → 任务内容，后台并发执行以加速生成
- **资源自动搜索** — 集成 Tavily API，自动搜索学习资源（可选）
- **AI 导师全屏对话** — 与浮窗共用后端，支持长对话与历史查看
- **多 AI 提供商** — 支持 OpenAI、Claude、Gemini 及自定义兼容 API
- **深色/浅色主题** — 资源视图日间模式采用干净白底，深色模式保持手稿氛围
- **本地数据存储** — SQLite 本地数据库，无需联网即可使用
- **手稿视觉风格** — 全局采用「学者的手稿」设计语言（Fraunces / Newsreader / JetBrains Mono，墨黑 + 朱砂 + 米色 + 金箔，罗马章节号、印章、朱批、金箔分隔线）
- **收藏夹直达内容** — 收藏的任务/资源点击后直接展示内容与资源链接，无需再展开路线

---

## 🏗️ 技术栈 / Tech Stack

| 层级 | 技术 |
|------|------|
| 框架 | [Tauri 2](https://v2.tauri.app) |
| 前端 | React 18 + TypeScript + Vite 5 + Tailwind CSS 3 |
| 状态管理 | Zustand 5 |
| 路由 | React Router v6 |
| Markdown | react-markdown + rehype-highlight |
| 后端 | Rust + tokio (async) |
| 数据库 | SQLite (sqlx 0.8) |
| HTTP | reqwest 0.12 |
| AI | OpenAI / Anthropic / Google Gemini / Custom API |

---

## 📁 项目结构 / Project Structure

```
├── src/                        # React 前端
│   ├── components/
│   │   ├── AiCompanion.tsx     # 全局 AI 伙伴浮窗(可拖动/收起/展开)
│   │   ├── Layout.tsx          # 全局布局 + 侧边栏 + 浮窗挂载点
│   │   ├── manuscript/         # 品牌徽 / 罗马数字工具(手稿视觉原子)
│   │   ├── states/             # Loading / Empty / Error / Skeleton 公共组件
│   │   ├── wizard/             # 创建路线(访谈 IntakeFlow + 旧 wizard 兜底)
│   │   ├── ai-loop/            # 消息→任务/资源的抽屉
│   │   ├── drawer/             # 通用 SideDrawer
│   │   ├── onboarding/         # 首次引导步骤
│   │   └── sidebar/            # 侧边栏 4 个子组件
│   ├── pages/
│   │   ├── HomePage.tsx        # 首页仪表盘
│   │   ├── CreateRoadmapPage.tsx  # 创建路线(访谈流程)
│   │   ├── RoadmapDetailPage.tsx  # 路线详情 · 横向章节 + 浮窗绑定
│   │   ├── AiTutorPage.tsx     # AI 导师全屏对话
│   │   ├── FavoritesPage.tsx   # 收藏夹
│   │   ├── StatsPage.tsx       # 学习统计
│   │   ├── OnboardingPage.tsx  # 首次引导
│   │   └── SettingsPage.tsx    # 设置 (API密钥/主题)
│   ├── stores/                 # Zustand 状态管理
│   │   ├── useAiCompanionStore.ts   # 浮窗位置/展开/上下文
│   │   ├── useIntakeStore.ts        # 访谈流程状态
│   │   ├── useRoadmapStore.ts       # 路线 CRUD / 优化
│   │   ├── useChatStore.ts          # 聊天历史
│   │   └── ...
│   ├── types.ts                # TypeScript 类型定义
│   └── utils/                  # 工具函数 (markdown / 链接 / 重试)
├── src-tauri/                  # Rust 后端
│   ├── src/
│   │   ├── commands/
│   │   │   ├── roadmap.rs      # 路线生成与 CRUD
│   │   │   ├── intake.rs       # intake_ask / intake_summarize 访谈命令
│   │   │   ├── optimize.rs     # optimize_roadmap 整体/阶段/任务级优化
│   │   │   ├── chat.rs         # AI 对话(含 stage_id/task_id 位置上下文)
│   │   │   ├── ai_loop.rs      # AI 回路(消息→任务/资源)
│   │   │   ├── favorites.rs    # 收藏夹
│   │   │   ├── stats.rs        # 学习统计
│   │   │   └── settings.rs     # API 配置
│   │   ├── db/mod.rs           # SQLite 数据库层 + 迁移
│   │   ├── models/mod.rs       # 数据模型
│   │   └── services/
│   │       ├── ai.rs           # AI 提供商实现
│   │       ├── parallel.rs     # 并行生成
│   │       ├── roadmap_parser.rs  # AI 响应解析
│   │       └── tavily.rs       # Tavily 资源搜索
│   ├── icons/                  # 应用图标(多尺寸 + 源 SVG/PNG)
│   └── tauri.conf.json         # Tauri 配置
├── docs/
│   └── screenshots/            # README 预览图
└── package.json
```

---

## 🚀 快速开始 / Quick Start

### 环境要求 / Prerequisites

- **Node.js** >= 18
- **Rust** >= 1.70（需安装完整 Rust 开发环境，含 `rustc`、`cargo`。推荐使用 [rustup](https://rustup.rs) 安装）
- **macOS / Windows / Linux**（macOS 需安装 Xcode Command Line Tools；Windows 需安装 Visual Studio Build Tools 或 C++ 生成工具）

### 安装 / Installation

```bash
git clone https://github.com/pppp-hhhh/roadmapai.git
cd roadmapai
npm install
```

### 开发 / Development

```bash
npm run tauri dev
```

> ⚠️ `npm run dev` 仅启动 Vite 前端，不包含 Rust 后端和数据库，Tauri 命令将无法使用。

### 构建 / Build

```bash
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`。

#### Windows 构建 / Windows build

macOS / Linux 无法直接产出 Windows 安装包，请使用仓库内置的 GitHub Actions 工作流（`.github/workflows/windows-build.yml`）：

1. 推送代码后，打开 GitHub 仓库的 **Actions** 页面
2. 选择 **Build Windows App** → **Run workflow**
3. 构建完成后，在对应运行记录中下载 `RoadmapAI-windows` artifact，内含 NSIS / MSI 安装包

也可以推送 `v*` 标签（如 `v1.2.0`）自动触发构建。

---

## ⚙️ 配置 / Configuration

所有 API 密钥通过应用内的**设置页面**配置（不通过 `.env` 文件）。

1. 打开应用 → 点击 **设置**
2. 选择 AI 提供商并填入 API Key：
   - **OpenAI**: https://platform.openai.com
   - **Claude**: https://console.anthropic.com
   - **Gemini**: https://aistudio.google.com
   - **自定义**: 兼容 OpenAI 格式的 API（如 DeepSeek、MiniMax 等）
3. （可选）填入 **Tavily API Key** 以启用自动资源搜索：https://tavily.com

### 模型选择建议

路线生成需要**结构化 JSON 输出**，对话需要**自然语言理解**，不同任务适合不同模型：

| 模型 | 路线生成 | AI 导师对话 | 说明 |
|------|:---:|:---:|------|
| **DeepSeek-V4-Flash** | ⭐ 推荐 | ✅ 可用 | 速度快，JSON 输出稳定，不易截断 |
| **MiniMax-M2.7** | ✅ 可用 | ✅ 可用 | 成本低，速度适中 |
| **MiniMax-M3** | ❌ 不推荐 | ⭐ 推荐 | 推理模型，会花大量 token 在思考上，导致 JSON 截断 |

> 💡 **最佳实践**：路线生成用 DeepSeek-V4-Flash，AI 导师对话用 MiniMax-M3。在设置页面可以分别配置不同模型的自定义接口。

---

## 🎯 使用指南 / Usage

### 1. 访谈生成路线

1. 在首页点击 **"新建路线"**
2. 填写主题、当前水平、期望难度
3. AI 围绕目标、基础、偏好、约束、期望深度进行多轮追问（约 10 轮）
4. 任意时刻可选择 **生成画像**、**继续追问** 或 **补充信息**
5. 画像页可编辑难度、追加反馈，确认后由 AI 生成完整路线

### 2. 浏览路线

1. 详情页按章节横向排列，每章为一列
2. 点击任务标题展开 2–4 条要点与对应学习资料
3. 右上 **"全部资源"** 按章节汇总全部资料链接
4. 勾选任务标记完成，进度自动更新

### 3. AI 伙伴浮窗

1. 任意页面右下角都有一个圆形入口，点击展开聊天面板
2. 在路线详情页点阶段或任务上的 **"问 AI"**，会自动绑定当前位置
3. 其他页面下，浮窗作为通用问答窗口，沿用上次位置与展开状态
4. 浮窗可拖动到屏幕任意位置，松手即定位；下次打开仍在原位
5. 需要长对话与历史查看时，进入 **AI 导师** 全屏页，与浮窗共用同一上下文

### 4. 生成后优化

1. 选中整体、阶段或任务，点击 **评价**
2. 写下具体反馈（例如：本章节奏过快、该任务希望补充示例）
3. AI 重绘对应部分，并保留同名任务的完成进度

### 5. 收藏夹

任务和资源支持收藏；收藏页直接展示内容与链接，无需展开路线

---

## 🧠 设计要点

- **访谈优于问卷**：通过多轮对话由 AI 主动追问，能挖掘出"每周几小时""截止时间"等硬性问题无法反映的真实偏好。
- **位置上下文**：浮窗始终知道当前所在阶段、任务与已完成进度，回答结合当前路径与前置依赖。
- **结构自适应**：阶段数、任务数、要点数量均由 AI 按主题广度与期望深度决定，不设硬性上限。
- **局部优化**：评价只重绘被选中的粒度，已完成进度不会因路线微调而丢失。
- **手稿视觉**：全局使用墨黑/朱砂/米色/金箔四色系，罗马章节号、印章、金箔分隔线统一应用。

---

## 📄 许可证 / License

MIT © RoadmapAI

---

## 📝 备注 / Notes

- 应用语言界面为**中文**
- API 密钥存储在本地 SQLite 数据库中，不会上传到任何服务器
- 数据库文件位于系统应用数据目录（macOS: `~/Library/Application Support/com.roadmapai.app/`）
- ⚠️ 推理模型（如 MiniMax-M3）不适合路线生成，会产生大量推理内容导致 JSON 截断，建议用于 AI 导师对话
- ⚠️ 项目仍存在不少 bug，会逐步修复，欢迎提 issue 反馈
- 无测试、无 CI — TypeScript 严格模式在 `npm run build` 时进行类型检查；Rust 侧要求 `cargo check` 0 warnings
- 📸 README 预览图由 [`docs/screenshots/`](docs/screenshots/) 提供；准备好截图后只需将同名文件覆盖即可在 README 看到效果（推荐 16:9，深色主题）
