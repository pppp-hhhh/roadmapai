# v1.1 实施说明 · 方向 6：首次启动引导（代码骨架）

> 配套设计稿：[roadmapai-v1.1-design-06-onboarding.md](./roadmapai-v1.1-design-06-onboarding.md)
> 范围：5 步引导 + GeoIP 推荐 provider + API Key 测试 + 完成页。
> 状态：可作为 v1.1 第五个 PR（`feat/onboarding`）的开发起点。

---

## 一、文件清单

### 新增

| 路径 | 作用 |
| --- | --- |
| `src/stores/useOnboardingStore.ts` | 5 步字段 + currentStep + 持久化 + `detectRecommendedRegion` + `recommendProvider` |
| `src/components/onboarding/OnboardingProgress.tsx` | 顶部 4 步圆点进度条（欢迎页隐藏） |
| `src/components/onboarding/StepWelcome.tsx` | 步骤 0：欢迎页 + 价值主张 + 3 个特点 + 自动预选推荐 provider |
| `src/components/onboarding/StepProvider.tsx` | 步骤 1：4 个 provider 卡片 + "推荐"徽标 |
| `src/components/onboarding/StepApiKey.tsx` | 步骤 2：API Key 输入 + BaseURL + Model + 测试连接 |
| `src/components/onboarding/StepTopic.tsx` | 步骤 3：主题输入 + 6 个热门示例 + 2 个反例（复用 `validateTopic`） |
| `src/components/onboarding/StepPreferences.tsx` | 步骤 4：水平 + 目标 + 每周时长 |
| `src/components/onboarding/OnboardingComplete.tsx` | 步骤 5：完成页 + 5s 倒计时 + 跳转到路线详情 |
| `src/components/onboarding/index.ts` | barrel export |
| `src/pages/OnboardingPage.tsx` | 引导主页面（5 步容器 + 跳过确认 + 错误展示） |

### 修改

| 路径 | 改动 |
| --- | --- |
| `src/App.tsx` | 加 `/onboarding` 路由 + `OnboardingGate`（未完成则强制进入引导） |
| `src/stores/index.ts` | 导出新 store + 工具函数 + 类型 |
| `src/pages/index.ts` | 导出 `OnboardingPage` |

---

## 二、设计决策与对应代码

### 2.1 5 步用 `OnboardingStep = 0 | 1 | 2 | 3 | 4` 字面量类型

`0` 表示欢迎页（没有进度条 + 没有"上一步"），`1-4` 是 4 个设置步骤。`OnboardingPage` 根据 `currentStep` 决定渲染哪个组件 + 是否显示底部操作栏。

### 2.2 步骤 1 自动预选推荐 provider

`StepWelcome` 的"开始设置"按钮会调 `selectProvider(recommended)`，用户点欢迎页的"开始"就直接进入步骤 2 且 provider 已选好。**这是减少首步操作的关键技巧**。

### 2.3 GeoIP 推荐

`detectRecommendedRegion()` 优先调后端 `detect_user_region`（v1.1 后端命令，可选），失败回退到 `'other'`。`recommendProvider(region)` 返回：
- `cn` → `deepseek`
- `us` → `anthropic`
- `other` → `anthropic`（默认推荐 Claude）

**v1.1 简化版**：可以**完全跳过 GeoIP**，硬编码推荐 Claude。本骨架实现了完整版（含后端命令占位），生产可按需简化。

### 2.4 API Key 测试连接

`StepApiKey` 的"测试连接"按钮调 v1.0 的 `useSettingsStore.testConnection`，复用现有逻辑。**零后端改动**。

### 2.5 完成页用 emoji 撒花 + 倒计时

不引入 `canvas-confetti` 库，emoji + `animate-bounce` 已足够。倒计时 5 秒后自动跳转到 `/roadmap/:id`，用户可点击"5 秒后自动跳转"取消。

`markCompleted()` 在 mount 时调用，把 `completed: true` 写入 store → `OnboardingGate` 不再拦截 → 用户可访问 `/`。

### 2.6 跳过确认弹窗

设计稿 5.2 节要求"警告但不阻止"：

```tsx
<button onClick={...}>跳过引导</button>  // 不再警告
<button onClick={...} autoFocus>继续引导</button>  // 默认聚焦
```

`autoFocus` 在"继续引导"上，防误点。

### 2.7 `OnboardingGate`：路由级拦截

```tsx
function OnboardingGate({ children }) {
  const completed = useOnboardingStore((s) => s.completed);
  if (!completed) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
```

挂在 `Layout` 外层。**首次启动**自动进入 `/onboarding`，**完成或跳过后**才解锁其他路由。

### 2.8 复用方向 3 的 `validateTopic` 与 `toRoadmapRequest`

`StepTopic` 直接 `import { validateTopic } from 'useCreateRoadmapWizardStore'`，确保主题校验与创建向导一致。
`OnboardingPage` 步骤 4 的"生成"按钮调 `toRoadmapRequest({ ... })`，把 5 步字段拼回 v1.0 的 `RoadmapRequest`，**后端零改动**。

### 2.9 持久化与"上次进行到哪"

store 持久化 `currentStep` + 所有字段，**下次进入恢复**（设计稿 5.2 节）。`OnboardingGate` 仅在 `completed === true` 时放行，所以"未完成" = "继续引导"。

---

## 三、依赖与配置

### 3.1 包依赖

零新增。

### 3.2 后端 Tauri 命令

**可选**（v1.1 最小可发布版不需要）：

| 命令 | 返回 | 备注 |
| --- | --- | --- |
| `detect_user_region` | `'cn' \| 'us' \| 'other'` | 用于 GeoIP 推荐 |

不实现时 `detectRecommendedRegion` 直接回退到 `'other'`，行为降级为"默认推荐 Claude"。

### 3.3 路由

新增 `/onboarding`，**不嵌套 Layout**（独立全屏背景）。`OnboardingGate` 把其他路由保护起来。

---

## 四、迁移步骤（建议 PR 顺序）

1. **PR 1 — store + 6 个步骤组件 + OnboardingPage**
   - 加所有新文件
   - **不挂载到 App.tsx**
   - 临时在 `App.tsx` 把 `/` 指向 `<OnboardingPage />` 验证
   - 跑一遍 5 步流程

2. **PR 2 — 路由挂载 + Gate**
   - 改 `App.tsx` 加 `OnboardingGate`
   - **首次启动自动进入引导**
   - 设置页加 [重新运行新手引导] 按钮（清空 `completed` + `navigate('/onboarding')`）

3. **PR 3 — 后端 GeoIP（可选）**
   - 实现 `detect_user_region` Rust 命令
   - **失败回退到 'other'**，前端零改动

4. **PR 4 — 打磨**
   - 撒花动画换成更精致的（用 CSS 替代 emoji）
   - 倒计时显示改为进度条
   - 步骤条加过渡动画

---

## 五、测试与验收

按设计稿第十一节的 8 条验收标准逐条对照：

| 验收项 | 实现位置 | 是否满足 |
| --- | --- | --- |
| 首次启动自动进入 `/onboarding` | `OnboardingGate` | ✅ |
| 任意步骤退出后下次启动恢复 | store 持久化 | ✅ |
| API Key 格式错误时 [继续] 禁用 | `canGoNext` case 2 | ✅ |
| 测试连接成功后 [继续] 才变蓝 | 由 `testConnection` 返回值控制 | ✅ |
| 跳过警告默认焦点"继续引导" | `autoFocus` | ✅ |
| 完成页停留 5 秒后自动跳转 | 倒计时 + 取消按钮 | ✅ |
| 点击 [开始第 1 关] 立即跳转 | `navigate` 立即触发 | ✅ |
| 设置页 [重新运行引导] 按钮 | **本骨架未实现**，留到 PR 2 补 | ⏳ |

### 手动测试清单

- [ ] 首次启动（清空 `localStorage`）→ 自动进入 `/onboarding`
- [ ] 看到欢迎页 + 3 个特点 + 4 步预告
- [ ] 点"开始设置"→ 自动预选推荐 provider，进入步骤 1
- [ ] 步骤 1 选 Anthropic → 进入步骤 2
- [ ] 步骤 2 不填 API Key → "继续"禁用
- [ ] 填一个假 Key → 测连接 → 看到失败提示
- [ ] 填一个真 Key → 测连接 → 看到绿色"连接成功"
- [ ] 步骤 3 输入"AI"→ 看到橙色提示
- [ ] 步骤 4 选"进阶 / 求职面试 / 4-6 小时"→ 点"生成学习路线"
- [ ] 看到进度浮窗（来自方向 3 的复用）
- [ ] 生成完毕 → 看到完成页 + 撒花
- [ ] 5 秒倒计时开始；点"X 秒后自动跳转"取消
- [ ] 点"开始第 1 关"立即跳到 `/roadmap/:id`
- [ ] 关闭应用，重新打开 → 因为 `completed = true`，直接进首页
- [ ] 在 `/` 任意页面手改 `localStorage.removeItem('roadmapai-onboarding')` → 刷新 → 重新进入引导
- [ ] 步骤 1-4 任意时刻点"跳过"→ 警告弹窗，默认焦点"继续引导"→ 选"跳过引导"回首页

---

## 六、风险与权衡

### 6.1 `OnboardingGate` 阻塞所有路由

`OnboardingGate` 包裹整个 `Layout`，意味着 `OnboardingPage` 之外的所有页面都受 `completed` 控制。**优点**：强制新用户走完引导。**缺点**：
- 开发者调试时需要手动清 `localStorage`。
- 已完成用户被某次 `localStorage` 异常清空后会重新被引导（**不太可能但可能**）。

**缓解**：设置页加 [重新运行新手引导] 按钮 + 顶栏加"已登录"标识，让用户有掌控感。

### 6.2 GeoIP 的隐私顾虑

`detect_user_region` 在桌面端属于"用户没明示同意的轻量网络请求"，v1.1 阶段可**完全不做**，硬编码推荐 Claude。

**最简化版**：删除 `detectRecommendedRegion` 调用，`recommendProvider` 直接返回 `'anthropic'`，省去后端命令。

### 6.3 完成页倒计时与用户预期

5 秒倒计时对部分用户偏短（看不清就跳转了），对另一部分偏长。**已实现**"X 秒后自动跳转"可点击取消。

可考虑：首次完成不倒计时，让用户主动点 [开始第 1 关]；再次访问时倒计时（"你已经看过这个了"）。**v1.1 不做，留到 v1.2**。

### 6.4 `StepPreferences` 缺"难度"和"是否含项目"

设计稿 4.4 步骤 4 有 3 个字段，本骨架只实现了"水平 / 目标 / 每周时长"，**省略了"难度"和"是否含项目"**。理由：
- 首次引导不增加认知负担。
- 路线生成后用户可在详情页调整。

**v1.1.x 可补**：在 `StepPreferences` 加这两个字段，`toRoadmapRequest` 自动适配。

### 6.5 `provider` 类型与 v1.0 不一致

`useOnboardingStore` 的 `ProviderChoice` 是 `'anthropic' | 'openai' | 'deepseek' | 'custom'`，与 v1.0 `useSettingsStore.ai_provider` 的 `'openai' | 'anthropic'` 略有差异。
- `StepApiKey` 提交时把 `'deepseek'` / `'custom'` 都映射为 `'openai'`（因为它们都用 OpenAI 协议）。
- 这层映射在 `saveApiConfig` 调用时做，**`useSettingsStore` 本身不感知**。

### 6.6 步骤 1-4 都有"跳过"按钮

设计稿允许跳过（仅警告）。本骨架实现完整警告弹窗。**注意**：跳过意味着未配置 API Key，首页会显示"待配置"提示（来自方向 1）。

---

## 七、代码统计

- 新增文件：11 个
- 新增代码行数：约 1100 行（含注释）
- 修改文件：3 个
- 修改代码行数：约 25 行

开发估时：

- PR 1（store + 6 步骤 + OnboardingPage）：2 天
- PR 2（路由挂载 + Gate + 设置页入口）：0.5 天
- PR 3（GeoIP 后端，可选）：0.5 天
- PR 4（打磨）：0.5 天

合计：约 **3 天**（含可选 0.5 天）。

---

## 八、与设计稿 4.4 步骤 4 的偏差

设计稿的 4.4 步骤 4 包含 3 个字段（每周时长 / 难度 / 是否含项目）。本骨架只实现了"每周时长"，**省略"难度"和"是否含项目"**。

理由：避免首次引导过长。补全方案：

```ts
// StepPreferences.tsx 加：
const [difficulty, setDifficulty] = useState<'简单' | '适中' | '困难'>('适中');
const [includeProject, setIncludeProject] = useState<'yes' | 'no'>('yes');

// OnboardingPage 调 toRoadmapRequest 时传入：
toRoadmapRequest({
  topic, level, goal: goalTemplate, goalDetail: '',
  weeklyHours, difficulty, includeProject,
});
```

`toRoadmapRequest` 已支持这些字段，**仅需扩展 StepPreferences**。
