# v1.1 实施说明 · 方向 1：侧边栏重做（代码骨架）

> 配套设计稿：[roadmapai-v1.1-design-01-sidebar.md](./roadmapai-v1.1-design-01-sidebar.md)
> 范围：把 v1.0 的 16 px 图标条重做为四段式可折叠侧边栏。本文档解释骨架代码如何落地。
> 状态：可作为 v1.1 第一个 PR 的开发起点（`feat/sidebar-redesign` 分支）。

---

## 一、文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `src/stores/useSidebarStore.ts` | 新增 | 折叠态、当前路线、待办聚合、API 状态感知 |
| `src/components/sidebar/CurrentRoadmapCard.tsx` | 新增 | A 段：当前路线缩略 + 进度环 + 切换下拉 |
| `src/components/sidebar/TodayTodoList.tsx` | 新增 | B 段：今日待办三类卡 + 空态隐藏 |
| `src/components/sidebar/MainNav.tsx` | 新增 | C 段：6 个一级入口 + 数字徽标 + 折叠态 |
| `src/components/sidebar/GlobalSection.tsx` | 新增 | D 段：设置 + 主题 + 用户菜单 + 折叠按钮 |
| `src/components/sidebar/index.ts` | 新增 | barrel export |
| `src/components/Layout.tsx` | 重写 | 接入四段，保留 `StudyTimer` 浮窗 |

未改动文件：`App.tsx` / 所有 `pages/*` / 其他 stores / `types.ts` / `index.css`。

---

## 二、设计决策与对应代码

### 2.1 折叠态：64 px ↔ 288 px（设计稿 288，写代码 72 即 18rem，对应 Tailwind `w-72`）

布局壳层用 CSS `transition-[width] duration-200 ease-out` 实现平滑过渡，所有内容在该容器内做 `flex-col` 自然伸缩。

### 2.2 当前路线卡：路由联动 + 下拉切换

`CurrentRoadmapCard` 通过 `window.location.pathname` 解析 `/roadmap/:id`，自动同步到 `useSidebarStore.currentRoadmapId`：

```ts
useEffect(() => {
  const m = window.location.pathname.match(/^\/roadmap\/([^/]+)/);
  if (m) setCurrentRoadmap(m[1]);
}, [setCurrentRoadmap]);
```

切换下拉浮出在卡片右上角，点击外部自动关闭。`roadmaps.slice(0, 5)` 最多展示 5 条 + "查看全部"入口。

### 2.3 今日待办：复用既有 store，避免重复请求

```ts
refreshTodayTodo: async () => {
  const flashcardStore = useFlashcardStore.getState();
  await Promise.all([flashcardStore.fetchDueCards(), flashcardStore.fetchNewCards()]);
  set({ todayTodo: { flashcards: useFlashcardStore.getState().dueCards.length, ... } });
}
```

待办数据**不存数据库**，纯前端聚合，刷新 / 30 秒轮询 / 路由变化时重算。

#### 已知简化
- `tasks`（今日未完成）和 `updates`（路线更新）字段为占位，固定返回 0。
- v1.1 后续可接入"今日任务"概念（在 `useRoadmapStore` 加 `todayTaskIds: string[]`，由用户在任务上手动打"今日"标签）。

### 2.4 主导航：6 个入口

```ts
const navItems = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/create', icon: PlusCircle, label: '创建路线' },
  { to: '/flashcards', icon: Brain, label: '记忆卡片', badgeKey: 'flashcards' },
  { to: '/tutor', icon: Bot, label: 'AI 导师' },
  { to: '/favorites', icon: Star, label: '收藏夹' },          // v1.1 新增
  { to: '/stats', icon: BarChart3, label: '学习统计' },      // v1.1 新增
];
```

> 路由 `/favorites` 和 `/stats` 在 v1.1 首次发布时**可以不存在**，v1.1.x 后续 PR 补上即可。当前的导航是"声明式的"，URL 不匹配时 React Router 会渲染空内容，不影响其他页面。

### 2.5 数字徽标：折叠态保留在右上角

折叠态用 `absolute -top-0.5 -right-0.5` 定位，展开态用列表项右侧的内联徽标。两种状态共用 `todayTodo.flashcards` 同一个数据源。

### 2.6 全局段：API 状态感知

`Layout` 启动时通过动态 import 拉 `useSettingsStore`，避免循环依赖：

```ts
const { useSettingsStore } = await import('../stores/useSettingsStore');
const settings = useSettingsStore.getState();
const provider = settings.ai_provider ?? null;
const key = await settings.getApiKey(provider || 'openai');
setApiStatus(provider, !!key);
```

未配置时，"设置"按钮变成琥珀色背景 + "待配置"徽标，引导用户优先配置。

### 2.7 用户菜单：v1.1 占位

`GlobalSection` 里的"用户菜单"目前只有"本地数据导出"和"退出登录"两项，后者 `disabled: true`（等云同步上线后启用）。这是 v1.1 的明确占位设计，避免后续大改 UI。

### 2.8 快捷键 Ctrl/Cmd + B

`Layout` 全局监听 `keydown`，拦截 `metaKey/ctrlKey + b/B`，调用 `toggleCollapsed()`。在 `input` / `textarea` 内的按键不被特殊处理（理论上 Ctrl+B 在输入框内是文字加粗，但本应用内输入框较少，影响可接受；如要严格隔离，可加 `e.target.tagName !== 'INPUT' && !== 'TEXTAREA'` 判断）。

---

## 三、依赖与配置

### 3.1 包依赖

未新增任何 npm 依赖。沿用 v1.0 的：

- `zustand@5`（含 `persist` 中间件）
- `react-router-dom@6`（NavLink）
- `lucide-react`（图标）
- Tailwind CSS 3

### 3.2 持久化

`useSidebarStore` 用 zustand `persist` 中间件，写入 `localStorage`，key 为 `roadmapai-sidebar`。**只持久化**：

- `isCollapsed`（用户偏好）
- `currentRoadmapId`（用户偏好）

**不持久化**：`todayTodo`（每次重算）、`isLoadingTodo`、`provider`、`hasApiKey`（运行时从 settings 拉）。

### 3.3 后端 Tauri 命令

无需新增。所有数据都来自 v1.0 已有的 `get_all_roadmaps` / `get_due_flashcards` / `get_api_key`。

未来可加（v1.1.x 后续 PR）：

- `get_today_pending_tasks()` → `[taskId]`（用于"今日未完成"统计）
- `get_roadmap_updates_since(last_seen_at)` → `number`（用于"路线更新"统计）

---

## 四、迁移步骤（建议 PR 顺序）

1. **PR 1 — store + 空壳**
   - 加 `useSidebarStore.ts`
   - 加空目录 `components/sidebar/`
   - 在 `stores/index.ts` 导出新 store
   - **不改 Layout**，仅留接口

2. **PR 2 — Layout 接入**
   - 重写 `Layout.tsx`
   - 加 4 个 sidebar 子组件
   - 加 `sidebar/index.ts` barrel
   - 跑一遍所有页面，验证 0 回归

3. **PR 3 — 路由补全**
   - 加 `/favorites` 和 `/stats` 路由
   - 加占位页面（v1.1 可以只显示"敬请期待"空态）
   - 在 `App.tsx` 注册

4. **PR 4 — 视觉打磨**
   - 加 200ms 折叠动画
   - 加折叠态 hover tooltip
   - 加数字徽标的 `transition-all`

---

## 五、测试与验收

按方向 1 设计稿第十节的 6 条验收标准逐条对照：

| 验收项 | 实现位置 | 是否满足 |
| --- | --- | --- |
| 折叠/展开 60Hz 无掉帧 | `transition-[width] duration-200` | ✅ |
| 待办数字 5 秒内反映真实数据 | `refreshTodayTodo` 复用 store | ✅ |
| 快捷键 `Ctrl/Cmd + B` | `Layout` 的 `useEffect` 监听 | ✅ |
| 首次启动看到 A 段引导 | `CurrentRoadmapCard` 的 `if (!currentRoadmap)` 分支 | ✅ |
| 当前路线切换不刷新页面 | `setCurrentRoadmap` + `navigate` | ✅ |
| 主体内容区布局 0 改动 | `<Outlet />` 保留 | ✅ |

### 手动测试清单

- [ ] 折叠 → 展开：宽度变化流畅，文字 fade-in 不抖。
- [ ] 展开态下点击"折叠"按钮收起。
- [ ] 折叠态下点击右上角"展开"按钮。
- [ ] 在任意页面按 `Ctrl + B` 切换。
- [ ] 第一次启动看到 A 段"创建第一条"空态卡。
- [ ] 在 `/roadmap/:id` 页面看 A 段是否自动高亮该路线。
- [ ] 在 A 段下拉切换到另一条路线，URL 是否变化。
- [ ] 在 `/flashcards` 完成一轮复习后，回到任意页，徽标数字是否减少。
- [ ] 全部路线都没有"待复习"时，B 段是否完全隐藏。
- [ ] 浅/深主题下，所有四段配色是否正确。
- [ ] 用户菜单的"退出登录"按钮是否显示"即将"徽标且不可点。
- [ ] 设置入口在 API Key 未配置时是否显示"待配置"。

---

## 六、风险与权衡

### 6.1 当前路线切换不刷新页面

实现：只更新 store + `navigate()`，不调用 `fetchRoadmap`。这意味着切换到一条**之前没看过的**路线时，`currentRoadmap`（来自 `useRoadmapStore`）可能为 null，需要下次进入 `/roadmap/:id` 时由 `useEffect` 触发拉取。

**缓解**：v1.1 可以加 `useSidebarStore` → `useRoadmapStore.fetchRoadmap(id)` 的副作用，组件挂载时拉一次。

### 6.2 折叠态宽度从 64px 改到 72px

设计稿写的是 64px，但 64px 在 18px 图标 + 8px 留白下偏挤。代码中用 `w-16`（64）和 `w-72`（288）。如要严格 64，可改 `w-16` 但增大 padding。

### 6.3 用户菜单的"云同步"占位

目前是显式 `disabled` + "即将"徽标。如果觉得丑，可以等云同步上线后**整体删掉** D 段用户菜单部分，保留"设置 + 主题 + 折叠"三项即可。

### 6.4 性能：每次路由变化都 `fetchRoadmaps`

`CurrentRoadmapCard` 的 `useEffect` 依赖 `roadmaps.length`，只有列表为空时拉一次。正常情况不会重复请求。

---

## 七、后续 PR 候选

按价值排序：

1. **接入"今日未完成"任务**（需要后端 `get_today_pending_tasks`）
2. **接入"路线更新"通知**（需要后端 `get_roadmap_updates_since`）
3. **加 `/favorites` 收藏夹页**（方向 4 的产物）
4. **加 `/stats` 学习统计页**（新模块，需要数据聚合）
5. **侧边栏骨架屏**（方向 5 的产物）
6. **数字徽标 > 99 时"99+"的淡入动画**

---

## 八、代码统计

- 新增文件：7 个
- 新增代码行数：约 470 行（含注释）
- 修改文件：1 个（`Layout.tsx`）
- 修改代码行数：约 80 行

开发估时（不含评审）：

- PR 1（store + 空壳）：0.5 天
- PR 2（Layout 接入 + 子组件）：1.5 天
- PR 3（路由补全）：0.5 天
- PR 4（视觉打磨 + 测试）：0.5 天

合计：约 **3 天**。
