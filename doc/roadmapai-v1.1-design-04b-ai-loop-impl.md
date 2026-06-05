# v1.1 实施说明 · 方向 4：AI 闭环（代码骨架）

> 配套设计稿：[roadmapai-v1.1-design-04-ai-loop.md](./roadmapai-v1.1-design-04-ai-loop.md)
> 范围：4 条回路（AI 回答 → 闪卡 / 任务 / 收藏；任务 → AI 提问；闪卡失败 → AI 重解释）+ 收藏夹页。
> 状态：可作为 v1.1 第三个 PR 的开发起点（`feat/ai-loop` 分支）。

---

## 一、文件清单

### 新增

| 路径 | 作用 |
| --- | --- |
| `src/stores/useFavoriteStore.ts` | 收藏 CRUD + Tab 过滤 + `isFavorited` 派生 |
| `src/components/drawer/SideDrawer.tsx` | 通用侧拉抽屉：右滑入 / ESC / 焦点陷阱 / 锁定 body |
| `src/components/drawer/index.ts` | drawer barrel export |
| `src/components/ai-loop/MessageActions.tsx` | AI 回答底部的 4 个操作（复制/转闪卡/转任务/收藏） |
| `src/components/ai-loop/MessageToFlashcardDrawer.tsx` | 回路 ①：AI 回答 → 闪卡 |
| `src/components/ai-loop/MessageToTaskDrawer.tsx` | 回路 ②：AI 回答 → 任务 |
| `src/components/ai-loop/TaskToTutorDrawer.tsx` | 回路 ③：任务 → AI 提问（写 sessionStorage + 跳 `/tutor`） |
| `src/pages/FavoritesPage.tsx` | `/favorites` 收藏夹页（5 Tab + 列表 + 乐观删除） |

### 修改

| 路径 | 改动 |
| --- | --- |
| `src/App.tsx` | 注册 `/favorites` 路由 |
| `src/pages/index.ts` | 导出 `FavoritesPage` |
| `src/stores/index.ts` | 导出 `useFavoriteStore` 和 `Favorite` 类型 |
| `src/pages/AiTutorPage.tsx` | 接入 `MessageActions` + 读取 `sessionStorage` 中的待发消息（回路 ③ 接续） |

未改动：其他 4 个 pages / Layout（侧边栏会在方向 1 接入 `/favorites` 入口）/ 后端其他命令。

### 回路 ④（闪卡失败 → AI 重解释）

回路 ④ 在当前骨架**仅作占位**。`FlashcardsPage` 评分 0-2 时弹出"让 AI 解释"按钮（设计稿 6.2 节），需要新增独立组件 `FlashcardReexplainDialog.tsx`，**留到 PR 2**。

---

## 二、设计决策与对应代码

### 2.1 通用 `SideDrawer` 抽取

4 个抽屉（转闪卡、转任务、任务提问、资源编辑——后者属于方向 2）有 80% 重复：
- 右侧滑入 + 背景遮罩
- ESC 关闭 + 焦点陷阱
- 锁定 body 滚动
- 标题栏 + 底部操作栏插槽

抽取为 `<SideDrawer isOpen onClose title width footer>`，所有抽屉只关心表单内容。`width` 默认 480，任务提问用 560。

### 2.2 自动从 AI 回答提取问题（启发式）

`MessageActions.extractQuestion` 用一条简单正则：

```ts
const m = content.match(/(?:^|\n)[#*]?\s*(什么是.{2,30}[?？]|.{2,30}是什么[?？])/);
```

- 匹配"什么是 X" / "X 是什么"问句
- 兜底：取首行前 50 字

v1.1 的"启发式"故意简单，**未来可换成调用后端 `extract_qa_from_message` 命令**（设计稿十一节列出的）。前端不感知切换。

### 2.3 回路 ③ 用 `sessionStorage` 跨页传消息

`TaskToTutorDrawer` 跳到 `/tutor` 时把消息写到 `sessionStorage['roadmapai-pending-tutor-message']`，`AiTutorPage` mount 时读取并自动 send，写完即清空。

为什么不用 router state？
- React Router v6 的 `state` 在刷新后会丢失。
- `sessionStorage` 跨页面更稳定，**且刷新页面后行为更可预期**（避免消息丢失）。

### 2.4 收藏 store 的乐观更新

`removeFavorite` 先本地删除再调后端，失败时回滚：

```ts
const prev = get().favorites;
set({ favorites: prev.filter((f) => f.id !== id) });
try { await invoke('remove_favorite', { id }); }
catch (e) { set({ favorites: prev, error: String(e) }); }
```

`addFavorite` 不做乐观（避免重复 id 风险），失败时仅设 `error`。

### 2.5 收藏页的 4 个 Tab + 5 种状态

设计稿 7.3 节要求 4 种类型（任务/资源/AI 回答/闪卡）。代码中用 `FILTERS` 数组配置 5 个 Tab（含"全部"），点击调用 `setFilter(key)`，store 内部 `fetchFavorites` 重拉。

### 2.6 `MessageActions` 接收上下文

`currentRoadmapId` 和 `currentStageId` 由 `AiTutorPage` 通过 `useRoadmapStore` 推算并传入：
- `currentRoadmapId` = `selectedRoadmapId`（用户选中的路线）
- `currentStageId` = `currentRoadmap.stages.find((s) => !s.isLocked)?.id`（第一个未锁定的阶段）

未解锁意味着"刚开始"或"路线刚生成"，符合 AI 闭环"基于当前阶段"的语义。

### 2.7 👍 / 👎 反馈按钮

仅占位（`onClick` 留空 + `// v1.1 占位` 注释）。v1.1 范围**不做**反馈数据采集，但 UI 已就位，后续 PR 接入即可。

---

## 三、依赖与配置

### 3.1 包依赖

未新增任何 npm 依赖。沿用 v1.0 的 `zustand` / `react-router-dom` / `lucide-react` / `react-markdown` / `rehype-*`。

### 3.2 后端 Tauri 命令（v1.1 必加）

| 命令 | 入参 | 返回 |
| --- | --- | --- |
| `list_favorites` | `filterType: string \| null` | `Favorite[]` |
| `add_favorite` | `input: Omit<Favorite, 'id' \| 'created_at'>` | `Favorite`（带 id 和 created_at） |
| `remove_favorite` | `id: string` | `void` |
| `add_task_to_stage` | `{ stageId, title, content, taskType, minutes }` | `Task` |
| `refine_task_content` | `rawAnswer: string` | `{ content: string }`（**可选**，v1.1 暂可不实现） |

数据库表设计：

```sql
CREATE TABLE favorites (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'task' | 'resource' | 'message' | 'flashcard'
  ref_id TEXT NOT NULL,
  roadmap_id TEXT,
  title TEXT NOT NULL,
  preview TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(type, ref_id)          -- 防止重复收藏
);
CREATE INDEX idx_favorites_type ON favorites(type);
CREATE INDEX idx_favorites_roadmap ON favorites(roadmap_id);
```

### 3.3 路由挂载

`App.tsx` 加一行：

```tsx
<Route path="favorites" element={<FavoritesPage />} />
```

侧边栏 `/favorites` 入口在方向 1 已加好（`MainNav.tsx`），本 PR 不再改 `Layout`。

---

## 四、迁移步骤（建议 PR 顺序）

1. **PR 1 — 后端 + 收藏 store + 收藏页**
   - Rust 端加 4 个命令 + 表迁移
   - 加 `useFavoriteStore.ts` + `FavoritesPage.tsx` + drawer barrel
   - `App.tsx` 注册 `/favorites`
   - **抽屉暂未接入**，收藏只能手动在 `/favorites` 看到

2. **PR 2 — SideDrawer + 3 个抽屉 + MessageActions**
   - 加 `SideDrawer` + 3 个 `*Drawer.tsx`
   - 加 `MessageActions.tsx`
   - 改 `AiTutorPage.tsx` 接入操作栏
   - 改 `RoadmapDetailPage.tsx`（回路 ③ 在任务底部加"基于此任务提问"按钮 → 抽屉，本骨架未实现此按钮，**留到 PR 3**）

3. **PR 3 — 任务详情集成 + 闪卡失败重解释**
   - 改 `RoadmapDetailPage`：任务卡片底部加"基于此任务提问" / "收藏" 按钮
   - 加 `FlashcardReexplainDialog.tsx`：评分 0-2 时弹出
   - 改 `FlashcardsPage.tsx` 接入

4. **PR 4 — 资源编辑用 SideDrawer（与方向 2 重叠）**
   - 把 v1.0 `RoadmapDetailPage` 里内嵌的"添加/编辑资源"表单迁移到 SideDrawer
   - **本骨架未实现此改动**，因为方向 2 才是详情页重做的主战场

5. **PR 5 — 后端精炼 + 打磨**
   - `refine_task_content` 后端命令
   - 抽屉 200ms 滑入动画细节
   - 收藏页打开深链（需要后端返回 `original_url` 字段）

---

## 五、测试与验收

按设计稿第十二节的 6 条验收标准逐条对照：

| 验收项 | 实现位置 | 是否满足 |
| --- | --- | --- |
| AI 回答操作栏 200ms 淡入 | `MessageActions` 直接渲染，未加淡入动画 | ⏳ PR 5 |
| 转闪卡抽屉 100ms 滑入 | CSS 动画 200ms（设计稿偏保守） | ✅ |
| 任务提问预填上下文跳转 | `TaskToTutorDrawer` 写 sessionStorage + AiTutorPage 读 | ✅ |
| 闪卡评分 0-2 后 300ms 弹提示 | **未实现** | ⏳ PR 3 |
| 收藏页 Tab 切换 < 100ms | store 同步切换，乐观更新 | ✅ |
| 收藏"打开"跳深链 | 占位（未接 `original_url` 字段） | ⏳ PR 5 |

### 手动测试清单

- [ ] 启动应用，进入 `/tutor`
- [ ] 发送一条 AI 回答
- [ ] 看到回答底部 4 个按钮：复制 / 转闪卡 / 转任务 / 收藏
- [ ] 点击"转闪卡"：右侧滑入抽屉
- [ ] 抽屉里选择路线、保留默认问题、点击保存
- [ ] 抽屉关闭，进入 `/flashcards` 看到新卡片
- [ ] 点击"转任务"：抽屉里选择阶段 + 任务类型 + 时长，保存
- [ ] 进入对应路线详情，验证任务出现在阶段里（依赖后端）
- [ ] 点击"收藏"：按钮变实心星
- [ ] 进入 `/favorites`：看到 4 个 Tab，"AI 回答" Tab 下能看到刚才的收藏
- [ ] 在收藏页点"取消收藏"：乐观更新，列表立即消失
- [ ] 点击"复制"：按钮变 ✓，1.5s 后恢复
- [ ] 回路 ③ 暂时需要手动测试：在某条路线详情页打开任务，**v1.1 骨架未加"基于此任务提问"按钮，需 PR 3 补**——可用 console 注入 `sessionStorage.setItem(...)` 后跳 `/tutor` 验证自动发送

---

## 六、风险与权衡

### 6.1 后端依赖

4 个新命令是**强依赖**：
- `add_task_to_stage`：没有它，回路 ② 不可用
- `list_favorites` / `add_favorite` / `remove_favorite`：没有它们，收藏页空白

**建议 PR 1 必须含后端**，否则前端跑不起来。Rust 命令的实现量不大（每条 20-30 行）。

### 6.2 sessionStorage 跨页传递

优点：刷新不丢。
缺点：多 Tab 不共享。如用户同时打开 2 个 `/tutor` 窗口，可能会"抢消息"。

v1.1 接受这个限制（桌面端多窗口场景少）。未来可改用 `BroadcastChannel`。

### 6.3 启发式提取问题

`extractQuestion` 的正则只能匹配"什么是 X"等简单句式，对话式回答"我先解释一下 X..."可能提取失败，兜底取首行。

v1.1 接受"提取失败 → 用户手填"的回退体验。后续 PR 接入 `extract_qa_from_message` 后端命令。

### 6.4 收藏的"打开"深链

当前 `FavoritesPage` 的"打开"按钮是占位（`onClick` 留空）。v1.1 不实现深链跳转，因为：
- 后端需返回 `original_url` 字段（`/roadmap/:id?task=:taskId` 等）
- 前端需解析不同类型的 URL

留到 PR 5。v1.1 阶段用户在收藏页**只能看到列表**，点击操作只有"取消收藏"。这是已知的降级。

### 6.5 回路 ④ 完整未实现

设计稿 6.2 节的"评分 0-2 弹浮层 + 调 AI 重解释"**未在本骨架实现**。`FlashcardsReexplainDialog` 是新组件，需要：
- 调 `useChatStore.sendMessage` 发请求
- 等待流式响应
- 底部加"转成新闪卡"按钮（回路 ① 的复用）

建议在 PR 3 单独做。

---

## 七、代码统计

- 新增文件：8 个
- 新增代码行数：约 850 行（含注释）
- 修改文件：4 个
- 修改代码行数：约 60 行

后端估时（Rust）：
- `favorites` 表迁移：0.5 天
- 4 个命令实现：1 天

前端估时：
- PR 1（后端 + 收藏页 + store）：1.5 天
- PR 2（drawer + 3 个抽屉 + MessageActions）：1.5 天
- PR 3（任务详情 + 闪卡重解释）：1 天
- PR 4（资源编辑抽屉，与方向 2 合并）：0.5 天
- PR 5（后端精炼 + 打磨）：0.5 天

合计：约 **5.5 天（含后端 1.5 天）**。
