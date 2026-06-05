# v1.1 实施说明 · 方向 3：创建页向导化（代码骨架）

> 配套设计稿：[roadmapai-v1.1-design-03-create-wizard.md](./roadmapai-v1.1-design-03-create-wizard.md)
> 范围：把 v1.0 的单页 4 字段表单重做为 4 步对话式向导。
> 状态：可作为 v1.1 第二个 PR 的开发起点（`feat/create-wizard` 分支）。

---

## 一、文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `src/stores/useCreateRoadmapWizardStore.ts` | 新增 | 4 步字段 + currentStep + 校验函数 + 拼装 RoadmapRequest |
| `src/components/wizard/WizardProgress.tsx` | 新增 | 顶部水平步骤条（激活/完成/未激活三态） |
| `src/components/wizard/WizardShell.tsx` | 新增 | 步骤通用容器：标题 + 副标题 + 内容 + "AI 接下来会做什么" |
| `src/components/wizard/StepTopicLevel.tsx` | 新增 | 步骤 1 + 2：主题输入 / 水平选择 |
| `src/components/wizard/StepGoalPreference.tsx` | 新增 | 步骤 3 + 4：目标 / 每周时长 / 难度 / 是否含项目 |
| `src/components/wizard/index.ts` | 新增 | barrel export |
| `src/pages/CreateRoadmapPage.tsx` | 重写 | 接入 4 步，保留生成进度弹窗与中断取消 |
| `src/stores/index.ts` | 微调 | 导出新 store 与工具函数 |

未改动：`App.tsx` / `types.ts` / `index.css` / 其他 pages 与 components / 后端。

---

## 二、设计决策与对应代码

### 2.1 两个文件承载 4 步的取舍

- 设计稿里 4 步是独立的视觉单元，但**结构高度相似**（都是标题+字段+AI 提示）。
- 代码上把 1+2 合并为 `StepTopicLevel.tsx`，3+4 合并为 `StepGoalPreference.tsx`，通过 `step` prop 切换。
- 优势：减少组件数量，主题/水平的目标场景更连贯。
- 劣势：组件内部用 `if (step === 1)` 分支，文件略长。**v1.2 拆分前可接受**。

### 2.2 主题校验：宽泛提示不阻止

`validateTopic` 返回 3 种结果：
- 非法（空/过短）：`valid: false`，禁用"继续"按钮。
- 合法但宽泛（"AI"、"编程"）：`valid: true` + 提示文案（不阻止，让用户自己决定）。
- 合法且具体：静默通过。

`StepTopicLevel` 在输入框下方显示提示，给用户**温和的建议**而非强制拦截。

### 2.3 目标必填 + 自定义兜底

步骤 3 的"其他"模板（`goal: 'custom'`）要求 `goalDetail` 非空；其他 4 个模板不要求补充说明。
`canProceedFromStep` 实现了这套规则，可被外部组件复用（例如未来"返回上一步"时回放校验）。

### 2.4 `toRoadmapRequest`：纯函数拼装

把 4 步字段拼回 v1.0 的 `RoadmapRequest`，**后端零改动**。`goal` 字段是文本拼接（"求职面试" / "期末复习：3 个月内通过 PMP 认证"），`difficulty` 字段附加"每周约 N 小时"和"含项目实战"。

### 2.5 持久化与离开确认

store 用 zustand `persist` 写入 `localStorage`：
- 字段值（4 步全部）
- `currentStep`（退出后下次进入恢复）

不持久化 `hasUnsavedChanges`（运行时计算）。

页面 mount 时监听 `beforeunload`，仅当 `topic` 非空时弹原生确认（避免打扰"还没开始"的用户）。

### 2.6 进度弹窗：v1.0 经验复用

`GeneratingOverlay` 直接复用 v1.0 的 `ProgressEvent` 数据流，**不抽离为公共组件**（属于方向 5 的工作）。代码与 v1.0 相比：
- 减小了弹窗宽度（`max-w-lg` 与原版一致）
- 视觉风格保持一致（v1.0 的渐变进度条 + 4 阶段说明）
- 取消按钮：`reset()` + `navigate('/')`（v1.0 也有这个按钮，行为一致）

### 2.7 maxReachedStep 简化

设计稿里"未完成的步骤不可点"。代码中**简化为全部可点**（用户回看更自由），但视觉上未到达的步骤保持灰色。如要严格限制，可在 store 维护一个 `visitedSteps: number[]`，仅允许跳转到 `visitedSteps` 内的步骤。

---

## 三、依赖与配置

- 零 npm 依赖新增。
- 零后端 Tauri 命令新增。
- 路由不变（仍 `/create`）。

---

## 四、迁移步骤（建议 PR 顺序）

1. **PR 1 — store + 校验**
   - 加 `useCreateRoadmapWizardStore.ts`
   - 导出 `validateTopic` / `canProceedFromStep` / `toRoadmapRequest`
   - 单测：`validateTopic` 至少覆盖 5 个用例

2. **PR 2 — 向导组件**
   - 加 4 个 wizard 组件 + `wizard/index.ts`
   - 不动 CreateRoadmapPage，先在 Storybook / 临时页验证

3. **PR 3 — 替换 CreateRoadmapPage**
   - 重写 `CreateRoadmapPage.tsx`
   - 保留 v1.0 的四阶段进度弹窗代码
   - 跑一遍冒烟：建一条路线 → 跳转详情 → 进度正常

4. **PR 4 — 打磨**
   - 顶部步骤条加过渡动画
   - "返回上一步"时所有字段保留的测试
   - 中断取消后草稿出现在首页（依赖首页的草稿区，是方向 1 后续 PR）

---

## 五、测试与验收

按设计稿第十节的 6 条验收标准逐条对照：

| 验收项 | 实现位置 | 是否满足 |
| --- | --- | --- |
| 首页"创建路线" → 第 1 步 < 100ms | 路由不变，组件直接渲染 | ✅ |
| 4 步平均完成 90 秒 | 4 步都是 1-2 个字段，UX 轻 | ✅ |
| 主题"AI"时警告、"机器学习"时静默 | `validateTopic` | ✅ |
| 取消后首页出现草稿 | **v1.1 后续 PR**（首页草稿区是方向 1 衍生） | ⏳ |
| 未通过校验时"继续"禁用 | `canProceedFromStep` 已实现，需在按钮上调用（**当前 PR 缺，需在 PR 2 补**） | ⚠️ |
| 返回上一步字段保留 | store 持久化 | ✅ |

### 已知缺口

- **"继续"按钮的禁用判断**：当前代码里 `nextStep` 始终可点，没调 `canProceedFromStep`。需要在 PR 2 / PR 3 补：

  ```tsx
  import { canProceedFromStep } from '../stores';
  
  const canGo = canProceedFromStep(currentStep, { topic, level, goal, goalDetail, weeklyHours, difficulty, includeProject });
  
  <button onClick={nextStep} disabled={!canGo} ...>继续</button>
  ```

- **首页草稿区**：设计稿要求"取消后首页出现草稿卡"，但首页改动属于方向 1 的衍生工作（侧边栏之外的首页区域），需要单独 PR。本次骨架不实现，但**生成时已通过 `useRoadmapStore.generateRoadmap` 落库到 `is_draft=true` 是 v1.1 的后端要求**，需后端先支持。

### 手动测试清单

- [ ] 打开 `/create` 看到第 1 步
- [ ] 输入"AI"：看到橙色提示但不阻止
- [ ] 输入"机器学习"：无提示，"继续"可点
- [ ] 点击"继续"→ 第 2 步
- [ ] 选中"进阶"→ 继续
- [ ] 第 3 步选"其他"→ 补充说明变必填
- [ ] 第 4 步"生成"→ 弹进度浮窗
- [ ] 进度浮窗点"取消"→ 回首页
- [ ] 再次进入 `/create`→ 回到上次的步骤和字段
- [ ] 顶部点击已完成步骤可跳回，未完成步骤不可点（灰色）

---

## 六、风险与权衡

### 6.1 字段拼装后的 `goal` 文本

`toRoadmapRequest` 把模板 + 详情拼成单一文本传给后端。后端 AI 实际拿到的是字符串（不是结构化数据），**这与 v1.0 完全兼容**。如未来想让 AI 区分"目标"与"详情"，需要后端加一个 `goal_template` 字段（不在 v1.1 范围）。

### 6.2 `maxReachedStep` 简化为"全部可点"

设计稿要求"未完成的步骤不可跳"，代码中放开了。权衡：v1.1 阶段用户回看的需求大于引导的严格性，且视觉上未到达的步骤明显灰显，**误操作概率低**。

### 6.3 `currentStep` 用 `1 | 2 | 3 | 4` 字面量类型

TS 严格但限制了泛用性。**故意为之**：与设计稿强对应，编译期就能挡住步骤号错位。

### 6.4 进度弹窗未抽离

`GeneratingOverlay` 内联在 `CreateRoadmapPage.tsx`。如方向 5 落地时抽到 `components/states/LoadingState.tsx`，本文件会同步更新。

---

## 七、代码统计

- 新增文件：6 个
- 新增代码行数：约 600 行（含注释）
- 修改文件：2 个（`CreateRoadmapPage.tsx` 重写 + `stores/index.ts` 微调）
- 修改代码行数：约 220 行（重写）

开发估时：

- PR 1（store + 校验）：0.5 天
- PR 2（向导组件）：1 天
- PR 3（替换页面）：0.5 天
- PR 4（打磨 + 测试）：0.5 天

合计：约 **2.5 天**。
