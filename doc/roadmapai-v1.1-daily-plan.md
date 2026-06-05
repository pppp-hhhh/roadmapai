# v1.1 每日路线图（Day-by-Day Plan）

> 配套：[roadmapai-v1.1-release-plan.md](./roadmapai-v1.1-release-plan.md)（22 PR 排期）
> 配套：各 `roadmapai-v1.1-design-0Xb-*-impl.md` 实施说明
> 模式：**v1.1.0 全量 + 后端存根 / 22 PR 串行 / 双人协作**
> - 我（Claude）提建议 + 写代码骨架 + 解释"为什么"
> - 您（用户）实现 + 实际跑 + 反馈
> 日期：2026-06-04 起

---

## 〇、协作约定

### 0.1 节奏

每个 PR = 1 个工作日（个别 0.5 天的 PR 并入相邻日）：

- **上午**（您）：根据我提的"PR 启动单"做 4 件事
  1. 跑 `pnpm tsc --noEmit` 看骨架代码有没有 TS 错误
  2. 修 TS 错（我的骨架有错别字 / 类型不匹配 / 缺 import）
  3. 实际启动 `pnpm tauri dev` 跑一遍
  4. 截图/录屏 + 反馈问题

- **下午**（我）：根据反馈
  - 修代码 / 解释设计
  - 准备下一个 PR 的"启动单"

### 0.2 我的 PR 启动单格式

每天开始一个 PR 时，我会先发：

```
【PR S-2】feat(sidebar): 重写 Layout 为四段式
预计用时：1.5 天
配套：roadmapai-v1.1-design-01b-sidebar-impl.md
涉及文件：src/components/Layout.tsx + 4 子组件
  - 新增：src/components/sidebar/{CurrentRoadmapCard,TodayTodoList,MainNav,GlobalSection}.tsx
  - 修改：src/components/Layout.tsx（重写）
  - 微调：src/stores/index.ts

【您现在需要做的】
1. 跑 pnpm tsc --noEmit
2. 改我留下的 TS 错（我会标 ⛔）
3. pnpm tauri dev
4. 验证 [regression §3.2.1 - §3.2.6] 全部用例
5. 截图：展开态/折叠态/设置未配置高亮

【我会盯的】
- "继续"按钮禁用判断（实施说明 §4.2.2 警告点）
- 持久化：折叠后刷新是否保留
- StudyTimer 浮窗是否被破坏
```

### 0.3 反馈格式

您回我时尽量带：

- 错误信息原文
- 截图
- 行为是否符合预期（是/否 + 说明）
- 是否需要调整（"继续" / "暂停改设计" / "延后"）

---

## 一、关键里程碑（4 周 / 20 工作日）

| 里程碑 | 时间 | 验收 |
| --- | --- | --- |
| **M1** 第 1 个工作日结束 | 跑通"骨架 + 1 个 PR"流程 | INF-1 + S-1 合并 |
| **M2** 第 5 个工作日 | 侧边栏全部跑通 | S-2 / S-3 / S-4 |
| **M3** 第 10 个工作日 | 侧边栏 + 向导 全部跑通 | + W-1 / W-2 / W-3 / W-4 |
| **M4** 第 14 个工作日 | AI 闭环 + 4 态组件 | + A-1 / A-2 / A-3 / A-4 / A-5 / ST-1 / ST-2 / ST-3 |
| **M5** 第 17 个工作日 | Onboarding | + O-1 / O-2 / O-3 / O-4 |
| **M6** 第 18-20 个工作日 | 集成 / 回归 / 灰度 | ST-4 / ST-5 + 全部回归 |

---

## 二、详细日程

### 第 1 周（5 天）：基础 + 侧边栏

| 日 | 上午（您） | 下午（我） | 交付物 |
| --- | --- | --- | --- |
| **Day 1** | 跑 `pnpm tsc --noEmit` 找到所有骨架代码的 TS 错；修复；提交 1 个"feat: fix v1.1 skeleton TS errors" | 标 ⛔ 错误位置 + 解释 | ⛔ 错误清单 → 修复 commit |
| **Day 2** | **PR S-1**：合并 `useSidebarStore`；跑测试 | 准备 S-2 启动单 | PR S-1 合并 |
| **Day 3** | **PR S-2**：合并 4 个 sidebar 子组件 + 重写 Layout；跑回归 §3.2.1-3.2.6 | 修 PR review 反馈 | PR S-2 合并 |
| **Day 4** | **PR S-3**：注册 `/favorites` 和 `/stats` 占位路由 | 修反馈 | PR S-3 合并 |
| **Day 5** | **PR S-4**：侧边栏动画 + 徽标微交互打磨 | 修反馈 | PR S-4 合并 → **M2 达成** |

### 第 2 周（5 天）：向导

| 日 | 上午（您） | 下午（我） | 交付物 |
| --- | --- | --- | --- |
| **Day 6** | **PR W-1**：合并 wizard store + 校验函数；写单测 | 准备 W-2 启动单 | PR W-1 合并 |
| **Day 7** | **PR W-2**：合并 4 个 wizard 步骤组件；临时测视觉 | 准备 W-3 启动单 | PR W-2 合并 |
| **Day 8** | **PR W-3**：重写 CreateRoadmapPage；跑 5 条路线对比测试 | 修反馈 | PR W-3 合并（**关键 PR**） |
| **Day 9** | **PR W-4**：向导步骤条过渡动画打磨 | 修反馈 | PR W-4 合并 |
| **Day 10** | 回归日：跑 §4.2.1-4.2.4 全部用例；发现的问题开 issue | 修 issue | **M3 达成** |

### 第 3 周（5 天）：AI 闭环 + 4 态组件

| 日 | 上午（您） | 下午（我） | 交付物 |
| --- | --- | --- | --- |
| **Day 11** | **PR A-1**：后端 `favorites` 表 + 4 命令（Rust 写）+ 前端 useFavoriteStore + FavoritesPage | 解释后端 Rust 命令 | PR A-1 合并（**关键 PR**） |
| **Day 12** | **PR A-2**：合并 SideDrawer + 3 个抽屉 + MessageActions；接入 AiTutorPage | 修反馈 | PR A-2 合并 |
| **Day 13** | **PR A-3**：任务详情提问入口 + 闪卡重解释 | 修反馈 | PR A-3 合并 |
| **Day 14** | **PR A-4** + **PR A-5**：资源编辑 SideDrawer + refine_task_content | 修反馈 | PR A-4 / A-5 合并 |
| **Day 15** | **PR ST-1**：4 态组件 + 插画 + 4 个空态预设 | 准备 ST-2 启动单 | PR ST-1 合并 → **M4 达成** |

### 第 4 周（5 天）：4 态 + Onboarding

| 日 | 上午（您） | 下午（我） | 交付物 |
| --- | --- | --- | --- |
| **Day 16** | **PR ST-2**：替换 HomePage / FlashcardsPage / FavoritesPage 状态 | 修反馈 | PR ST-2 合并 |
| **Day 17** | **PR ST-3**：替换 CreateRoadmapPage 进度 + AiTutorPage 错误 | 修反馈 | PR ST-3 合并 |
| **Day 18** | **PR O-1**：5 步引导 store + 6 步骤 + OnboardingPage（**先不挂载到 App**） | 修反馈 | PR O-1 合并 |
| **Day 19** | **PR O-2**：路由挂载 + OnboardingGate（**含 v1.0 升级兼容**） | 修反馈 | PR O-2 合并（**高风险 PR**） |
| **Day 20** | **PR O-3** + **PR O-4**（可选 GeoIP + 打磨） + **PR ST-4** + **PR ST-5** | 修反馈 | 全部合并 → **M5 达成** |

### 第 5 周（3 天）：集成 + 灰度

| 日 | 上午（您） | 下午（我） | 交付物 |
| --- | --- | --- | --- |
| **Day 21** | 全量回归：跑 `roadmapai-v1.1-regression-test-plan.md` **全部章节** | 修 P0 / P1 | 回归报告 |
| **Day 22** | 修回归中发现的 bug；写 v1.1.0 release notes | 配合 | release notes |
| **Day 23** | 灰度发布（5% 用户）；24h 监控 | 配合 | 灰度数据 |

---

## 三、每个 PR 的"先做 vs 后做"清单

### 必须先做（阻塞后续 PR）

| PR | 阻塞谁 |
| --- | --- |
| S-1 | S-2, S-3, S-4, O-2, ST-4 |
| W-1 | W-2, W-3, W-4, O-1 |
| A-1 | A-2, A-3, A-4, A-5, ST-2 |
| ST-1 | ST-2, ST-3, ST-4, ST-5 |
| O-1 | O-2, O-3, O-4 |

### 可延后（最后一个周末处理）

- ST-5 动效 + 无障碍打磨
- O-3 GeoIP（可选）
- O-4 撒花动画

---

## 四、Day 1 的具体任务（启动）

### Day 1 上午（您）

1. **打开终端**：`cd E:\roadmapai && pnpm tsc --noEmit`
2. **记录所有错误**（我会根据您贴的错误定位）
3. **不需要立刻修**，先汇总发我

我会立刻：
- 标出哪些是骨架代码的错（我留下的）
- 哪些是 v1.0 已有的错
- 哪些是依赖未装（`pnpm install`）

### Day 1 下午（我）

- 修复骨架代码的 TS 错（输出"修复 commit"补丁）
- 解释每个错的根因（您以后写代码也避坑）
- 准备 Day 2 的 PR S-1 启动单

### Day 1 结束

✅ 您能跑 `pnpm tsc --noEmit` 0 错
✅ `pnpm tauri dev` 启动应用，至少能在首页看到方向 1 改完的侧边栏（虽然后端 store 还没数据，会显示空态）

---

## 五、风险预案

### 5.1 节奏风险

| 风险 | 预案 |
| --- | --- |
| 某个 PR 卡 2 天 | 跳过该 PR 的打磨步骤，先合并"能跑"版本，打磨放到 v1.1.1 |
| 后端 Rust 编译卡住 | 提前 0.5 天切到 A-1 之前，先打通 Rust 编译 |
| TS 错误过多 | 把"修 TS 错"专门拆为 PR 0（不计入 22 PR） |

### 5.2 设计风险

| 风险 | 预案 |
| --- | --- |
| 实施过程中发现设计稿有漏洞 | 当天调整设计 + 改动代码 + 在 doc/ 留 changelog |
| `toRoadmapRequest` 拼接后 AI 生成质量下降 | W-3 必跑 5 条对比，提前发现问题 |
| OnboardingGate 升级兼容出问题 | O-2 加 `has_any_roadmap` 检测；老用户走 fallback |

### 5.3 沟通风险

| 风险 | 预案 |
| --- | --- |
| 每天的 PR 启动单太长 | 拆为"核心交付" + "可选打磨"两段 |
| 反馈不及时 | 超过 1 天没反馈，我假设"按推荐继续" |

---

## 六、可以加速的"并行任务"

下列工作**不阻塞主线**，可以异步做：

- 写 v1.1.0 release notes（任何一天都可以开始）
- 准备 v1.1 灰度方案（Day 18 开始）
- 准备 v1.1.1 hotfix 流程（Day 19 开始）
- 给团队/老板做 v1.1 演示 PPT（Day 20 开始）

---

## 七、给您的 3 个建议

### 7.1 建议每天固定 2 个时段

- **上午 1 小时**（您）：跑构建 + 截图 + 反馈
- **下午 1 小时**（您）：merge 改代码 + 提交

剩下的时间用来做您自己的事或者节奏调整。

### 7.2 建议先建立"基线"

Day 1 早上第一件事：把 v1.0 当前状态**完整截图**一遍，作为回归基线。后续每个 PR 完成后截图对比。

### 7.3 建议先告诉我"哪些骨架代码不确定要合入"

- 某些组件是 v1.1 候选（如方向 5 的 8 套插画）— 您可能想**先不合并**，等主线稳了再加
- 某些 store 是 v1.1 才有用的（如 `useOnboardingStore`）— 您可以**只合入 store 不挂载**

我会在 PR 启动单里标"必须合入 / 推荐合入 / 可选合入"三档。

---

## 八、启动口令

如果以上节奏您都 OK，请回我：

```
【确认】开始 Day 1
```

我会立即发 **Day 1 启动单**（跑 `pnpm tsc --noEmit` 看错误），不需要再讨论其他。

如果某个环节想调整，比如：

- "Day 1 上午我只有 30 分钟"
- "我希望先做 A-1 后端"
- "我想跳过 ST-5 打磨"

直接告诉我，我调整这张表。

---

## 九、相关文件索引

- 22 PR 排期：[roadmapai-v1.1-release-plan.md](./roadmapai-v1.1-release-plan.md)
- 22 PR 模板：[roadmapai-v1.1-pr-templates.md](./roadmapai-v1.1-pr-templates.md)
- 回归测试：[roadmapai-v1.1-regression-test-plan.md](./roadmapai-v1.1-regression-test-plan.md)
- 设计稿总览：[roadmapai-v1.1-design-overview.md](./roadmapai-v1.1-design-overview.md)
- 各方向实施说明：`-design-0Xb-*-impl.md`（X = 1/3/4/5/6）
- 代码骨架：位于 `E:\roadmapai\src/` 下的 store 与 components 目录
