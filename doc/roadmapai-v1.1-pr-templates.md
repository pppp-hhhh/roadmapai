# v1.1 PR 描述模板

> 配套：[roadmapai-v1.1-regression-test-plan.md](./roadmapai-v1.1-regression-test-plan.md) + 各方向 `*-impl.md`
> 用途：把代码骨架的 PR 描述直接套用本模板，方便 review 与合入。
> 用法：复制对应方向的 PR 模板 → 填实际信息 → 关联回归测试章节。

---

## 一、通用 PR 模板（适用于所有 v1.1 PR）

```markdown
## 标题
feat(<scope>): <一句话描述>

例：`feat(sidebar): 重做侧边栏为四段式可折叠结构`

## 类型
- [ ] ✨ 新功能（feature）
- [ ] 🐛 修复（fix）
- [ ] ♻️ 重构（refactor）
- [ ] 📝 文档（docs）
- [ ] 🎨 样式（style）

## 关联 Issue / 设计稿
- 设计稿：[roadmapai-v1.1-design-0X-*.md]
- 实施说明：[roadmapai-v1.1-design-0Xb-*-impl.md]
- 关联 issue：#XXX

## 改动范围
- 新增文件：
  - `path/to/file1.tsx` — 一句话说明
  - `path/to/file2.ts`
- 修改文件：
  - `path/to/existing.tsx` — 一句话说明
- 依赖：
  - npm: 无 / `<pkg>@<version>`
  - Rust: 无 / 新增命令 `xxx`

## 截图 / 录屏
（涉及 UI 的 PR 必填）

| 浅色 | 深色 |
| --- | --- |
| ![](url) | ![](url) |

## 关键设计决策
（简述 2-3 条 non-trivial 决策，链接到实施说明里的具体章节）

1. <决策 1>：原因...
2. <决策 2>：原因...

## 自测结果

### 自动化测试
- [ ] `pnpm tsc --noEmit` 通过
- [ ] `pnpm build` 通过
- [ ] `pnpm test` 通过（如有）
- [ ] 新增单测覆盖：xxx

### 手动冒烟
链接到 [roadmapai-v1.1-regression-test-plan.md] 的相关章节

- [ ] §X.X.X <场景名>
- [ ] §X.X.X <场景名>

## 回归测试
- [ ] 已跑 [roadmapai-v1.1-regression-test-plan.md] 中 §X 的全部用例
- [ ] **未发现**回归问题 / 发现 X 个回归（详见评论）

## Checklist
- [ ] 代码风格符合项目 ESLint 规则
- [ ] 已自 review 自己的 diff
- [ ] 已更新相关文档（如有）
- [ ] 已与设计稿对照（UI 改动）
- [ ] 通知了相关 reviewer

## 截图 / 录屏（可选）
（演示关键交互）
```

---

## 二、方向 1：侧边栏重做（4 个 PR）

### PR 1.1 — store + 空壳

```markdown
## 标题
feat(sidebar): 引入 useSidebarStore

## 改动范围
- 新增 `src/stores/useSidebarStore.ts`
- 新增 `src/components/sidebar/index.ts`（空目录）
- 微调 `src/stores/index.ts`

## 关键设计决策
1. **持久化最小化**：仅持久化 `isCollapsed` + `currentRoadmapId`，待办每次重算
2. **不持有原始数据**：`useSidebarStore` 只持有聚合结果，路线/闪卡从既有 store 拉

## 自测
- [ ] `pnpm tsc --noEmit` 通过
- [ ] store 单元测试：`refreshTodayTodo` 复用既有 store 工作正常
- [ ] localStorage `roadmapai-sidebar` 写入正确

## 回归测试
未触达 UI，可略。
```

### PR 1.2 — Layout 接入 + 4 个子组件

```markdown
## 标题
feat(sidebar): 重写 Layout 为四段式可折叠结构

## 改动范围
- 新增 4 个子组件（见 impl 文档清单）
- 重写 `src/components/Layout.tsx`
- 保留 `StudyTimer` 浮窗

## 关键设计决策
1. **200ms 折叠动画**：用 `transition-[width] duration-200 ease-out`
2. **Ctrl/Cmd + B 快捷键**：全局监听 keydown
3. **API 状态感知**：动态 import useSettingsStore 避免循环依赖

## 截图
| 展开（浅色） | 展开（深色） | 折叠态 |
| --- | --- | --- |
| ![](url) | ![](url) | ![](url) |

## 回归测试
按 [regression §3.2.1 - §3.2.6] 全部跑通

- [ ] §3.2.1 路由跳转（10 个场景）
- [ ] §3.2.2 折叠/展开（4 个场景）
- [ ] §3.2.3 主体内容区不受影响（4 个场景）
- [ ] §3.2.4 数字徽标（5 个场景）
- [ ] §3.2.5 当前路线卡（4 个场景）
- [ ] §3.2.6 设置入口高亮（2 个场景）

未发现回归。
```

### PR 1.3 — 路由补全

```markdown
## 标题
feat(routes): 注册 /favorites 和 /stats 路由

## 改动范围
- 新增 `src/pages/FavoritesPage.tsx`（占位）
- 新增 `src/pages/StatsPage.tsx`（占位）
- 改 `src/App.tsx` 加 2 个 Route
- 改 `src/pages/index.ts` 导出

## 关键设计决策
1. **占位页可用最简版**：仅显示空态 + "敬请期待"，不阻塞侧边栏 PR 1.2

## 截图
（占位页空态）

## 回归测试
- [ ] 侧边栏 6 个导航都能跳转
- [ ] 收藏夹/统计页占位正常显示
```

### PR 1.4 — 视觉打磨

```markdown
## 标题
polish(sidebar): 折叠动画 + 数字徽标微交互

## 改动范围
- 微调 `Layout.tsx` 加 transition
- 微调 `MainNav.tsx` 徽标加 `transition-all`

## 关键设计决策
1. **动画时长**：200ms 是经过测试的"看起来不慢"的下限
2. **数字变化**：徽标数字用 `transition-all duration-300` 平滑过渡

## 截图 / 录屏
（动画对比录屏）

## 回归测试
- [ ] 60Hz 屏幕折叠展开不掉帧
- [ ] 数字变化平滑
```

---

## 三、方向 3：创建页向导（4 个 PR）

### PR 3.1 — store + 校验

```markdown
## 标题
feat(wizard): 引入创建路线向导 store

## 改动范围
- 新增 `src/stores/useCreateRoadmapWizardStore.ts`
- 微调 `src/stores/index.ts`

## 关键设计决策
1. **4 步字段全部持久化**：`topic`/`level`/`goal` 等都进 localStorage
2. **校验函数导出**：`validateTopic` / `canProceedFromStep` / `toRoadmapRequest` 可被外部复用
3. **`toRoadmapRequest` 零后端改动**：拼回 v1.0 的 `RoadmapRequest`

## 单测（新增）
- `validateTopic` 至少 5 个用例：空 / 过短 / 宽泛 / 合法 / 边界
- `canProceedFromStep` 4 步全测
- `toRoadmapRequest` 5 种 goal 模板 + 4 种 weeklyHours
```

### PR 3.2 — 向导组件

```markdown
## 标题
feat(wizard): 4 步向导组件

## 改动范围
- 新增 4 个组件（见 impl 文档清单）
- 新增 `src/components/wizard/index.ts`

## 关键设计决策
1. **1+2 合并、3+4 合并**：减少组件数量，结构连贯
2. **主题校验不阻止**：宽泛主题给提示但不阻塞
3. **目标"其他"必填详情**：其他 4 个模板 goalDetail 可空

## 截图
| 步骤 1 | 步骤 2 | 步骤 3 | 步骤 4 |
| --- | --- | --- | --- |
| ![](url) | ![](url) | ![](url) | ![](url) |

## 自测
- 临时在 `App.tsx` 把 `/` 指向 `<StepTopicLevel />` 验证视觉
- 临时指向 `<StepGoalPreference />` 验证视觉
```

### PR 3.3 — 替换 CreateRoadmapPage

```markdown
## 标题
feat(create): 替换为 4 步向导

## 改动范围
- 重写 `src/pages/CreateRoadmapPage.tsx`
- 接入 4 步 + 进度浮层 + 离开确认

## 关键设计决策
1. **进度浮窗内联**：本 PR 不抽离为公共组件（属于方向 5）
2. **离开确认**：仅 `topic` 非空时弹原生确认
3. **生成成功后清空 store**：`reset()` 后跳详情

## 截图 / 录屏
（完整 4 步流程录屏）

## 回归测试
按 [regression §4.2.1 - §4.2.4] 全部跑通

- [ ] §4.2.1 完整流程（3 个场景）
- [ ] §4.2.2 字段校验（7 个场景）⚠️ **必须修复"继续"按钮禁用判断**
- [ ] §4.2.3 进度浮窗（6 个场景）
- [ ] §4.2.4 路线生成结果（5 条路线对比）

## ⚠️ 已知差异
- `goal` 字段拼接方式与 v1.0 不同（"求职面试" vs "系统学习X"）
- `difficulty` 字段含"每周 X 小时"和"含项目实战"
- 已在 PR 3.3 验证：生成的路线质量无显著下降
```

### PR 3.4 — 打磨

```markdown
## 标题
polish(wizard): 步骤条过渡动画 + 字段恢复测试

## 改动范围
- 微调 `WizardProgress.tsx` 加 transition
- 微调 `CreateRoadmapPage.tsx` 离开确认文案

## 截图 / 录屏
（步骤条动画录屏）
```

---

## 四、方向 4：AI 闭环（5 个 PR）

### PR 4.1 — 后端 + 收藏 store + 收藏页

```markdown
## 标题
feat(ai-loop): 收藏 store + 收藏页

## 后端改动
- 新增 `favorites` 表迁移（含 UNIQUE 约束）
- 新增 4 个命令：
  - `list_favorites(filter_type)`
  - `add_favorite(input)`
  - `remove_favorite(id)`
  - `add_task_to_stage(...)`（v1.1 提前加，PR 4.2 用）

## 前端改动
- 新增 `src/stores/useFavoriteStore.ts`
- 新增 `src/pages/FavoritesPage.tsx`
- 新增 `src/components/drawer/index.ts`（空）
- 改 `src/App.tsx` 注册 `/favorites`

## 数据库迁移
```sql
CREATE TABLE favorites (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  roadmap_id TEXT,
  title TEXT NOT NULL,
  preview TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(type, ref_id)
);
CREATE INDEX idx_favorites_type ON favorites(type);
CREATE INDEX idx_favorites_roadmap ON favorites(roadmap_id);
```

## 回归测试
- [ ] 收藏能写入数据库
- [ ] 重复收藏同一资源被 UNIQUE 阻止
- [ ] 收藏页能正确列出
```

### PR 4.2 — SideDrawer + 3 个抽屉 + MessageActions

```markdown
## 标题
feat(ai-loop): 侧拉抽屉 + AI 回答操作栏

## 改动范围
- 新增 4 个组件（见 impl 文档清单）
- 改 `src/pages/AiTutorPage.tsx` 接入 `MessageActions`

## 关键设计决策
1. **`SideDrawer` 通用抽取**：未来资源编辑也复用（方向 2 重叠）
2. **`extractQuestion` 启发式**：v1.1 简单正则，v1.2 换后端
3. **sessionStorage 跨页传递**：刷新不丢，比 router state 稳定

## 截图
| 抽屉滑入 | 抽屉内容 | 操作栏 |
| --- | --- | --- |
| ![](url) | ![](url) | ![](url) |

## 回归测试
- [ ] §5.2.1 原有聊天不受影响（5 个场景）
- [ ] §5.2.2 AI 回答操作栏（7 个场景）
- [ ] §5.2.3 转闪卡抽屉（4 个场景）
- [ ] §5.2.4 转任务抽屉（4 个场景）

## ⚠️ 已知缺口
- 任务详情页"基于此任务提问"按钮本 PR 未加（PR 4.3 补）
- 转任务依赖后端 `add_task_to_stage`（PR 4.1 已加）
```

### PR 4.3 — 任务详情集成 + 闪卡重解释

```markdown
## 标题
feat(ai-loop): 任务详情提问入口 + 闪卡失败重解释

## 改动范围
- 改 `src/pages/RoadmapDetailPage.tsx` 任务卡片底部加 2 个按钮
- 新增 `src/components/ai-loop/FlashcardReexplainDialog.tsx`
- 改 `src/pages/FlashcardsPage.tsx` 评分 0-2 接入

## 关键设计决策
1. **按钮位置**：任务卡片底部操作行（设计稿 §3.2）
2. **重解释弹层不离开闪卡流程**：保持复习节奏

## 截图
| 任务底部按钮 | 重解释弹层 |
| --- | --- |
| ![](url) | ![](url) |

## 回归测试
- [ ] §5.2.6 任务 → AI 提问（控制台验证 → 实际按钮验证）
- [ ] 闪卡评分 0-2 后 300ms 弹"让 AI 解释"
- [ ] 评分 3-5 不弹
```

### PR 4.4 — 资源编辑用 SideDrawer（与方向 2 合并）

```markdown
## 标题
refactor(detail): 资源编辑迁移到 SideDrawer

## 改动范围
- 改 `src/pages/RoadmapDetailPage.tsx` 移除内联资源编辑表单
- 改用 `SideDrawer`（复用 PR 4.2）

## 回归测试
- [ ] 资源增/改/删功能完全保留
- [ ] 抽屉可正常关闭
```

### PR 4.5 — 后端精炼 + 打磨

```markdown
## 标题
polish(ai-loop): refine_task_content + 抽屉动画

## 后端改动
- 新增 `refine_task_content(raw_answer)` 命令
- 调用 AI 把口语化回答转为结构化 markdown

## 前端改动
- `MessageToTaskDrawer.tsx` 保存前调 `refine_task_content` 优化 content
- `SideDrawer.tsx` 优化滑入动画细节

## 截图
（结构化 vs 原文对比）
```

---

## 五、方向 5：四态组件（5 个 PR）

### PR 5.1 — 4 态组件 + 插画

```markdown
## 标题
feat(states): EmptyState / LoadingState / Skeleton / ErrorState

## 改动范围
- 新增 7 个文件（见 impl 文档清单）
- **不动 v1.0 任何页面**

## 关键设计决策
1. **`StateProps` 公共接口**：4 个组件 props 形状统一
2. **8 套插画纯 SVG**：gzip 后 ~6KB
3. **5 个 ErrorLevel**：network / api / empty-result / permission / unknown

## 截图
| Empty | Loading (progress) | Skeleton | Error |
| --- | --- | --- | --- |
| ![](url) | ![](url) | ![](url) | ![](url) |

## 验证
- 临时在 Storybook / 测试页验证各状态视觉
- 浅/深主题各看一次
```

### PR 5.2 — 替换 HomePage / FlashcardsPage / FavoritesPage

```markdown
## 标题
refactor(pages): 替换 3 个页面的内联状态

## 改动范围
- 改 `src/pages/HomePage.tsx`
- 改 `src/pages/FlashcardsPage.tsx`
- 改 `src/pages/FavoritesPage.tsx`

## 关键设计决策
1. **Skeleton 与真实结构同尺寸**：防抖动
2. **空态统一用预设**（`<EmptyRoadmaps />` 等）

## 截图对比
| 页面 | v1.0 旧版 | v1.1 新版 |
| --- | --- | --- |
| HomePage 空态 | ![](url) | ![](url) |
| HomePage 加载 | ![](url) | ![](url) |
| FlashcardsPage 空态 | ![](url) | ![](url) |
| FavoritesPage 空态 | ![](url) | ![)(url) |

## 回归测试
按 [regression §6.5] 全部跑通
```

### PR 5.3 — 替换 CreateRoadmapPage 进度 + AiTutorPage 错误

```markdown
## 标题
refactor(pages): 抽离进度弹窗 + 替换错误态

## 改动范围
- 改 `src/pages/CreateRoadmapPage.tsx` 进度浮窗改用 `<LoadingState>`
- 改 `src/pages/AiTutorPage.tsx` 错误态改用 `<ErrorState>`

## 回归测试
- [ ] §6.5 浅深主题截图对比
- [ ] 进度浮窗 4 阶段文案、动画与 v1.0 一致
- [ ] AiTutorPage 错误时显示完整 `<ErrorState>`
```

### PR 5.4 — 网络状态接入 Layout

```markdown
## 标题
feat(states): Layout 接入网络状态

## 改动范围
- 改 `src/components/Layout.tsx` 用 `useNetworkStatus()`
- 网络断时整个内容区替换为 `<ErrorState level="network" />`

## 截图
（断网时整个应用的 ErrorState）

## 回归测试
- [ ] §6.5 网络断开测试
- [ ] 网络恢复后自动重试
```

### PR 5.5 — 动效 + 无障碍

```markdown
## 标题
polish(states): 动效 + 无障碍打磨

## 改动范围
- 各状态组件加 `prefers-reduced-motion` 检测
- 错误重试退避 hook

## 关键设计决策
1. **`prefers-reduced-motion`**：开启时改为淡入
2. **指数退避**：1s → 2s → 4s，最多 3 次
```

---

## 六、方向 6：Onboarding（4 个 PR）

### PR 6.1 — store + 6 步骤 + OnboardingPage

```markdown
## 标题
feat(onboarding): 5 步引导 store 与组件

## 改动范围
- 新增 10 个文件（见 impl 文档清单）
- **不挂载到 App.tsx**

## 关键设计决策
1. **5 步用字面量类型**：`0 | 1 | 2 | 3 | 4`
2. **自动预选 provider**：欢迎页"开始"按钮就调 `selectProvider`
3. **复用 `validateTopic` 与 `toRoadmapRequest`**：与方向 3 一致
4. **完成页 emoji 撒花**：不引入 confetti 库

## 截图
| 步骤 0 | 步骤 1 | 步骤 2 | 步骤 3 | 步骤 4 | 完成 |
| --- | --- | --- | --- | --- | --- |
| ![](url) | ![](url) | ![](url) | ![](url) | ![](url) | ![](url) |

## 验证
- 临时把 `/` 指向 `<OnboardingPage />` 走一遍 5 步
```

### PR 6.2 — 路由挂载 + Gate

```markdown
## 标题
feat(onboarding): 路由挂载 + OnboardingGate

## 改动范围
- 改 `src/App.tsx` 加 `/onboarding` 路由 + `OnboardingGate`
- 改 `src/pages/SettingsPage.tsx` 加 [重新运行引导] 按钮

## 关键设计决策
1. **`OnboardingGate` 包裹 Layout**：未完成则强制进入引导
2. **v1.0 升级兼容**：检测到存在任意路线时自动设 `completed = true`

```ts
// App.tsx 启动时
useEffect(() => {
  const { completed } = useOnboardingStore.getState();
  if (!completed) {
    const hasRoadmaps = await invoke<boolean>('has_any_roadmap');
    if (hasRoadmaps) {
      useOnboardingStore.getState().markCompleted();
    }
  }
}, []);
```

## 回归测试
按 [regression §7.2.1 - §7.2.5] 全部跑通，重点 §7.2.6 已有用户升级
```

### PR 6.3 — 后端 GeoIP（可选）

```markdown
## 标题
feat(onboarding): GeoIP 推荐

## 后端改动
- 新增 `detect_user_region` 命令
- 失败回退到 `'other'`

## 前端改动
- 无（`detectRecommendedRegion` 已实现完整版）

## 截图
不同 region 的推荐 provider
```

### PR 6.4 — 打磨

```markdown
## 标题
polish(onboarding): 撒花动画 + 倒计时进度条

## 改动范围
- `OnboardingComplete.tsx` 撒花用 CSS 替代 emoji
- 倒计时改为进度条

## 截图 / 录屏
（撒花动画 + 倒计时进度条）
```

---

## 七、PR 描述最佳实践

### 7.1 标题

格式：`<type>(<scope>): <description>`

好的标题：
- `feat(sidebar): 重做侧边栏为四段式可折叠结构`
- `fix(wizard): 修复步骤 2"继续"按钮未禁用`
- `refactor(detail): 资源编辑迁移到 SideDrawer`

不好的标题：
- `Update files` ❌
- `WIP` ❌
- `侧边栏改动`（不英文）❌

### 7.2 改动范围

**精确到文件 + 一句话说明**，让 reviewer 一眼看到影响面。

### 7.3 截图

UI 改动**必须有截图**。无截图 = 不可 review。

### 7.4 自测结果

不写"我测过了"这种空话，**列具体跑了哪些命令/用例**。

### 7.5 回归测试

直接引用 `roadmapai-v1.1-regression-test-plan.md` 的章节号，方便 reviewer 快速核对。

---

## 八、Code Review 检查清单（reviewer 用）

每个 PR 收到后，reviewer 按此清单逐条检查：

- [ ] PR 标题符合规范
- [ ] 改动范围准确
- [ ] 截图清晰，覆盖浅/深主题
- [ ] 关键设计决策有"为什么"
- [ ] 自测命令确实跑过（`pnpm tsc --noEmit` / `pnpm build`）
- [ ] 回归测试章节引用准确
- [ ] **未发现**额外的回归（reviewer 自己也跑一遍）
- [ ] 代码风格符合 ESLint
- [ ] 无未使用 import
- [ ] 无 console.log 残留（除开发调试）
- [ ] 无 TODO 未在文档中标注
- [ ] 至少 1 名 reviewer 看过代码
- [ ] 关联的 issue / 设计稿已链接
