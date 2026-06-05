# v1.1.0 Release — 5 Directions + 7 New Backend Commands

> Single-commit release per `doc/roadmapai-v1.1-release-plan.md` (consolidating 22 PRs into one).

## 概览

V1.1 给 RoadmapAI 带来 5 项关键升级,**不破坏 v1.0 数据 / 路由 / API 兼容**。完整工作量约 17 天,本次提交 87 文件 +10843/-461。

## 5 个主攻方向

### 1. 侧边栏重做 (S-1 ~ S-4)
- 16px 图标条 → 可折叠双层结构 (64 ↔ 288 px)
- A 段:当前路线缩略 + 进度环 + 切换下拉
- B 段:今日待办(待复习闪卡 / 今日未完成 / 路线更新)
- C 段:6 个一级入口 + 数字徽标 + `Cmd/Ctrl+B` 快捷键
- D 段:设置 + 主题 + 用户菜单 + 折叠按钮

### 2. 创建页向导 (W-1 ~ W-4)
- 4 步对话式:主题 / 水平 / 目标 / 偏好
- 主题宽泛提示(温和建议,不阻止)
- 目标必填 + 自定义兜底
- 草稿持久化 + 离开确认
- 顶部步骤条 4 步动画

### 3. AI 闭环 (A-1 ~ A-5)
- 4 条回路:AI 回答 → 闪卡 / 任务 / 收藏;任务 → AI 提问
- 收藏夹页 + 5 Tab 过滤 + 乐观删除
- 通用 `SideDrawer` 组件(右滑入 / ESC / 焦点陷阱 / 锁定 body)
- 资源编辑从内嵌表单迁移到 `SideDrawer`
- `refine_task_content` AI 精炼

### 4. 四态组件体系 (ST-1 ~ ST-5)
- `EmptyState` / `LoadingState` / `Skeleton` / `ErrorState` 4 个统一组件
- 8 套纯 SVG 插画(`currentColor` 反色,主题自适应)
- 3 个 Skeleton 预设:RoadmapCard / DetailPage / ChatMessage
- 5 个 Error level:network / api / auth / notfound / unknown
- 4 个空态预设:`EmptyRoadmaps` / `EmptyFavorites` / `EmptySearch` / `EmptyTodayTodo`

### 5. 首次启动引导 (O-1 ~ O-4)
- 5 步:欢迎 / 服务选择 / API Key / 主题 / 偏好
- 欢迎页自动预选推荐 provider(GeoIP 探测大区)
- API Key 测试连接复用 v1.0 `test_connection`
- 完成页 emoji 撒花 + 5s 倒计时(可取消)
- `OnboardingGate` 路由级拦截
- 设置页加 [重新运行新手引导] 按钮

## 后端新增 (Rust + Tauri)

### 数据库迁移 v3 ~ v5 (自动)

| 版本 | 内容 |
|---|---|
| v3 | `favorites` 表 + UNIQUE(type, ref_id) + 2 索引 |
| v4 | `api_configs` 独立表,数据迁移 SQL 清理 `api_keys` 字段污染 |
| v5 | `chat_sessions` + `chat_messages` 表,多轮对话持久化 |

升级路径:v1 → v2 → v3 → v4 → v5 全自动。

### 7 个新命令

| 命令 | 用途 | PR |
|---|---|---|
| `add_task_to_stage` | AI 回答 → 任务 | A-2 |
| `list_favorites` / `add_favorite` / `remove_favorite` | 收藏 CRUD | A-1 |
| `detect_user_region` | GeoIP 推荐 | O-3 |
| `get_user_stats` | 学习统计页 | S-3 |
| `refine_task_content` | AI 精炼原始回答 | A-5 |
| `list_chat_sessions` | 列出聊天历史 | 新增 |

### 改进

- `chat_send` 持久化最近 20 条历史,真正实现多轮对话(之前 `session_id` 被忽略)
- `learn_flashcard` 改走完整 SM-2 算法(原本写死 `repetitions=1`)
- `generate_roadmap` / `retry_stage` 锁合并:3 次 → 1 次
- `is_fallback` 改用 `serde_json` 解析(原 `s.contains` 脆弱)
- fallback 阶段 `is_locked: false`,让用户能重试

## 基础工具 (INF-1)

- `useExponentialRetry` — 指数退避重试 hook (1s → 2s → 4s,封顶 8s)
- `useNetworkStatus` — 监听 `online/offline` 事件

## Bug 修复 (本轮)

- **F-1**: 配置 API 后侧边栏仍显示"待配置" — `Layout` 改为订阅 `ai_provider` 变化 + 立即广播
- **F-1**: Onboarding step 0 跳过引导弹窗不出现 — 弹窗提到顶层 Fragment 跨 step 共享
- **F-2**: DeepSeek-V4-Flash 推理内容污染 JSON — 加 `reasoning_effort: "low"`、`max_tokens` 10000 → 5000、扩展 thinking-tag 正则识别 3 种变体

## 评审要点

### 兼容性
- ✅ v1.0 数据库自动迁移到 v5(无数据丢失)
- ✅ v1.0 路由 / API 全部保留
- ✅ 零 npm 依赖新增
- ✅ 旧 api_keys 表里 `_<provider>_base_url` 等脏数据自动迁移到 `api_configs` 并删除

### 构建验证
- ✅ `tsc --noEmit` 0 错误
- ✅ `vite build` ~5s
- ✅ `cargo check` 0 错误 0 警告
- ✅ `npm run tauri dev` 启动 Vite (5173) + Rust (1420) + 数据库,自动加载 64 张新闪卡

### 已知限制 (v1.1.x 后续)
- AI 闭环"打开"深链跳转(收藏 `original_url` 字段)
- `chat_send` 多窗口(目前用 sessionStorage 跨页传递,多 Tab 会抢消息)
- 资源编辑删除的"删除"按钮改用 `X` 字符(原 Trash2 图标在紧凑 UI 中偏大)

## 文档

- [release plan](./doc/roadmapai-v1.1-release-plan.md)
- [design overview](./doc/roadmapai-v1.1-design-overview.md)
- [regression test plan](./doc/roadmapai-v1.1-regression-test-plan.md)
- [PR templates](./doc/roadmapai-v1.1-pr-templates.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
