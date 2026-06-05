# v1.1 回归测试计划

> 配套主文档：[roadmapai-v1.1-design-overview.md](./roadmapai-v1.1-design-overview.md)
> 配套实施说明：`roadmapai-v1.1-design-0Xb-*-impl.md`
> 范围：列出 5 个 v1.1 主攻方向**改动后需要回归验证的 v1.0 功能点**，确保新功能上线不破坏既有行为。
> 状态：在每个 PR 合入前/后跑一遍对应章节。

---

## 一、回归测试总览

| 方向 | 涉及 v1.0 改动文件 | 回归风险等级 | 建议测试方式 |
| --- | --- | --- | --- |
| 1 侧边栏 | `Layout.tsx` | 🟡 中 | 自动化 E2E + 手动冒烟 |
| 3 向导 | `CreateRoadmapPage.tsx` | 🟡 中 | 自动化 E2E + 手动 |
| 4 AI 闭环 | `AiTutorPage.tsx` | 🟢 低 | 手动（涉及 AI 流式） |
| 5 四态组件 | 多页面 | 🟢 低 | 手动 + 截图对比 |
| 6 Onboarding | `App.tsx`（新增 Gate） | 🔴 高 | 自动化 E2E + 全员冒烟 |

> **风险等级说明**：
> - 🟢 低：纯新增组件，不改既有逻辑
> - 🟡 中：替换或重写文件，需要逐场景验证
> - 🔴 高：路由级拦截，影响所有用户访问

---

## 二、通用前置：构建与启动验证

每个 PR 合入后第一步：

```bash
pnpm install
pnpm tsc --noEmit        # 类型检查 0 错
pnpm build               # Vite 构建无警告
pnpm tauri dev           # 启动桌面应用，确认不白屏
```

### 关键冒烟

- [ ] 应用正常启动到首页
- [ ] 深色主题切换正常
- [ ] 控制台无 error / warning
- [ ] localStorage 可写（persist 中间件）

---

## 三、方向 1：侧边栏重做

### 3.1 改动文件

| 文件 | 改动类型 |
| --- | --- |
| `src/components/Layout.tsx` | 重写 |
| `src/stores/useSidebarStore.ts` | 新增 |

### 3.2 不应受影响的功能

侧边栏重写**只影响壳层**，所有 page 的渲染逻辑、URL、参数、路由都不变。重点回归：

#### 3.2.1 路由跳转

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 主导航跳转 | 点击侧边栏"首页" | URL = `/`，渲染 HomePage |
| 主导航跳转 | 点击"创建路线" | URL = `/create`，渲染 CreateRoadmapPage |
| 主导航跳转 | 点击"记忆卡片" | URL = `/flashcards` |
| 主导航跳转 | 点击"AI 导师" | URL = `/tutor` |
| 主导航跳转 | 点击"设置" | URL = `/settings` |
| 主导航跳转 | 点击"收藏夹"（v1.1 新增） | URL = `/favorites` |
| 主导航跳转 | 点击"学习统计"（v1.1 新增） | URL = `/stats`（占位或空态） |
| 嵌套路由 | 在 `/roadmap/abc` 点击任意导航 | 切换路由正常 |
| 浏览器后退 | 任意页面点浏览器后退 | 路由正常回退 |
| 浏览器前进 | 任意页面点浏览器前进 | 路由正常前进 |

#### 3.2.2 折叠/展开

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 鼠标点击 | 展开态点"折叠侧边栏" | 宽度从 288px → 64px，文字 fade-out |
| 鼠标点击 | 折叠态点底部"展开" | 宽度从 64px → 288px，文字 fade-in |
| 快捷键 | 任意页面按 `Ctrl/Cmd + B` | 切换折叠态 |
| 持久化 | 折叠后刷新页面 | 保持折叠态 |
| 持久化 | 展开后刷新页面 | 保持展开态 |

#### 3.2.3 主体内容区不受影响

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 内容区布局 | 切换折叠态 | 主内容区宽度自适应，无内容位移、跳动 |
| 滚动条 | 主内容区有滚动条时折叠 | 滚动条不消失、内容不抖动 |
| 浮窗 | `StudyTimer` 浮窗 | 仍正常显示在右下角 |
| 弹窗 | RoadmapDetailPage 的阶段弹窗 | 仍可正常打开/关闭 |

#### 3.2.4 数字徽标

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 折叠态徽标 | 待复习 12 张 | 折叠态图标右上角显示红色徽标 |
| 展开态徽标 | 待复习 12 张 | 主导航"记忆卡片"右侧显示 "12" |
| 数字更新 | 在 `/flashcards` 完成一轮复习，回首页 | 徽标数字减少 |
| 数字 > 99 | 模拟 200 张待复习 | 显示 "99+" |
| 空状态 | 待复习 = 0 | B 段（今日待办）整段不渲染 |

#### 3.2.5 当前路线卡

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 无路线 | 删除所有路线 | A 段显示"创建第一条"引导 |
| 有路线 | 任意路线存在 | A 段显示路线缩略 + 进度环 |
| 切换路线 | 在 A 段下拉选另一条 | 当前路线更新，URL 跳转 `/roadmap/:id` |
| 自动同步 | 在 `/roadmap/abc` 页面 | A 段自动显示"abc"作为当前路线 |

#### 3.2.6 设置入口高亮

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 未配置 API | 删除 API Key | 设置按钮琥珀色 + "待配置"徽标 |
| 已配置 API | 配置 Key | 设置按钮恢复正常灰色 |

### 3.3 自动化建议

```ts
// cypress/e2e/sidebar.cy.ts
describe('侧边栏', () => {
  it('快捷键 Ctrl+B 切换折叠', () => {
    cy.visit('/')
    cy.get('aside').should('have.class', 'w-72')
    cy.get('body').type('{ctrl+b}')
    cy.get('aside').should('have.class', 'w-16')
  })
  
  it('数字徽标显示 99+', () => {
    // 模拟 200 张待复习
    cy.intercept('GET', '/api/flashcards/due', { fixture: 'due-200.json' })
    cy.visit('/flashcards')
    cy.contains('99+').should('be.visible')
  })
})
```

### 3.4 手动冒烟清单

- [ ] 在每个 page（首页/创建/详情/闪卡/导师/设置/收藏夹）切换折叠展开，主体内容不抖
- [ ] 数字徽标在 0 / 1 / 50 / 100 / 200 几个数据点都正确
- [ ] 持久化：折叠 + 退出 + 重启 → 仍是折叠
- [ ] StudyTimer 浮窗位置和功能不受影响
- [ ] 快速来回点击折叠按钮 10 次，无卡顿

---

## 四、方向 3：创建页向导化

### 4.1 改动文件

| 文件 | 改动类型 |
| --- | --- |
| `src/pages/CreateRoadmapPage.tsx` | 重写 |
| `src/stores/useCreateRoadmapWizardStore.ts` | 新增 |

### 4.2 关键回归

向导改动只影响 `/create` 页面，但**生成路线**是产品核心流程，需要重点验证。

#### 4.2.1 完整流程

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 完整流程 | 4 步走完 → 点"生成" | 调后端 → 弹进度 → 跳详情 |
| 中断 | 第 3 步点浏览器关闭 | 重新打开 `/create` 回到第 3 步 |
| 中断 | 进度浮窗点"取消" | 回到首页，已生成部分保留（如有） |
| 离开确认 | 任意步骤关浏览器 | 弹原生"确认离开" |

#### 4.2.2 字段校验

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 主题空 | 步骤 1 不填直接继续 | "继续"禁用 |
| 主题宽泛 | 填"AI" | 橙色提示但不阻止 |
| 主题具体 | 填"机器学习" | 无提示，可继续 |
| 水平未选 | 步骤 2 不选 | "继续"禁用（v1.1 应补：当前是默认"进阶"） |
| 目标未选 | 步骤 3 不选 | "继续"禁用 |
| 目标"其他" | 选其他 + 不填详情 | "继续"禁用 |
| 偏好未填 | 步骤 4 任意字段空 | "继续"禁用 |

#### 4.2.3 进度浮窗

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 阶段 1 | 进度 = `started` | 显示"Layer 1: 大纲生成" + 3 个跳动点 |
| 阶段 2 | 进度 = `outline_complete` | 显示"Layer 2: 阶段架构" + 总数 |
| 阶段 3 | 进度 = `stage_completed` | 显示"Layer 3: 任务内容" + 阶段名 |
| 阶段 4 | 进度 = `completed` | 显示"写入数据库" + 跳详情 |
| 取消 | 浮窗点"取消" | 路由回首页，进度停止 |
| 错误 | 后端 API 失败 | 浮窗消失 + 红字错误提示 + "重新生成"按钮 |

#### 4.2.4 路线生成结果

v1.1 通过 `toRoadmapRequest` 把 4 步字段拼回 `RoadmapRequest`，**生成的路线**与 v1.0 必须**字段完全一致**（这样后端无感）：

| 字段 | v1.0 格式 | v1.1 是否一致 |
| --- | --- | --- |
| `topic` | 用户输入 | ✅ 一致 |
| `level` | '入门'/'进阶'/'高级' | ✅ 一致 |
| `goal` | 文本 | ✅ 拼接方式变更（"求职面试" vs "系统学习X"） |
| `difficulty` | 文本 | ✅ 拼接方式变更（含项目/每周时长） |

**注意**：v1.1 的 `goal` 和 `difficulty` 拼接方式**与 v1.0 不同**。后端 AI 收到的 prompt 文本会有差异。**这不是 bug，但需要在 PR 3 验证生成的路线质量没有显著下降**（手动对比 5 条路线的阶段数、任务数）。

### 4.3 自动化建议

```ts
// cypress/e2e/create-wizard.cy.ts
describe('创建路线向导', () => {
  it('完整流程', () => {
    cy.visit('/create')
    cy.get('input[placeholder*="机器学习"]').type('Cypress 测试主题')
    cy.contains('继续').click()
    cy.contains('进阶').click()
    cy.contains('继续').click()
    cy.contains('个人兴趣').click()
    cy.contains('继续').click()
    cy.contains('4-6 小时').click()
    cy.contains('生成学习路线').click()
    cy.url().should('match', /\/roadmap\//)
  })
  
  it('离开后恢复步骤', () => {
    cy.visit('/create')
    cy.get('input').type('test')
    cy.contains('继续').click()
    cy.visit('/')
    cy.visit('/create')
    cy.contains('你现在什么水平').should('be.visible')
  })
})
```

### 4.4 手动冒烟清单

- [ ] 4 步走完，生成的路线可正常打开
- [ ] 生成的路线字段（标题、阶段、任务）与 v1.0 同样输入生成的对比（5 条）
- [ ] 中途刷新页面不丢字段
- [ ] 主题输入"AI"看到橙色提示，"机器学习"无提示
- [ ] 进度浮窗的 4 阶段文案、进度条颜色与 v1.0 一致
- [ ] 取消生成后回到首页
- [ ] 离开确认弹窗（关浏览器）正常

---

## 五、方向 4：AI 闭环

### 5.1 改动文件

| 文件 | 改动类型 |
| --- | --- |
| `src/pages/AiTutorPage.tsx` | 微调（接入 MessageActions + sessionStorage） |
| `src/stores/useFavoriteStore.ts` | 新增 |
| `src/pages/FavoritesPage.tsx` | 新增 |
| `src/components/ai-loop/*` | 新增 |

### 5.2 关键回归

AI 闭环改动**几乎全是新增**，但 `AiTutorPage` 改了 3 处，需要回归原有聊天功能。

#### 5.2.1 原有聊天不受影响

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 发送消息 | 输入框输入 + 回车 | 消息发送 + 流式响应（与 v1.0 一致） |
| 清空消息 | 点"清空"按钮 | 消息列表清空（与 v1.0 一致） |
| 路线上下文 | 选路线 + 提问 | 消息自动带"（背景：...）"前缀 |
| 滚动 | 多消息后 | 自动滚到底部 |
| 错误 | API 失败 | 显示红字错误（与 v1.0 一致） |

#### 5.2.2 新增的 AI 回答操作栏

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 操作栏出现 | AI 完整回答 | 底部出现 4 个按钮（复制/转闪卡/转任务/收藏） |
| 操作栏不出现 | 流式响应中 | 不显示，等消息完成 |
| 复制 | 点"复制" | 复制全文 + 按钮变 ✓ 1.5s |
| 转闪卡 | 点"转闪卡" | 抽屉滑入 |
| 转任务 | 点"转任务" | 抽屉滑入 |
| 收藏 | 点"收藏" | 按钮变实心星 |
| 取消收藏 | 再次点 | 按钮变空心星 |
| 反馈 | 点 👍 / 👎 | 占位（v1.1 无后续动作） |

#### 5.2.3 转闪卡抽屉

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 抽屉打开 | 点"转闪卡" | 右侧滑入，宽度 480px |
| 字段预填 | 抽屉打开 | 答案自动填入 AI 全文 |
| 路线选择 | 不选路线 + 点保存 | 红字"请选择所属学习路线" |
| 保存 | 选路线 + 保存 | 抽屉关闭，闪卡创建成功 |
| 加入今日队列 | 勾选"加入今日学习队列" | 闪卡出现在 `/flashcards` 待学习列表 |

#### 5.2.4 转任务抽屉

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 抽屉打开 | 点"转任务" | 右侧滑入，宽度 520px |
| 路线/阶段选择 | 不选 + 保存 | 红字报错 |
| 任务类型 | 5 选 1 | 选中态蓝边 |
| 时长 | 默认 30 分钟 | 可改 5-600 |
| 保存 | 全部填好 | 抽屉关闭，任务添加成功（依赖后端） |

#### 5.2.5 收藏页 `/favorites`

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 5 个 Tab | 全部 / 任务 / 资源 / AI 回答 / 闪卡 | 点击切换 |
| 空状态 | 没有任何收藏 | 显示 `<EmptyFavorites />` |
| 列表 | 收藏 3 条 | 列表显示 3 条 |
| 取消收藏 | 点垃圾桶 | 乐观删除，列表立即移除 |
| 取消收藏失败 | 网络断 | 回滚 + 错误提示 |
| 打开 | 点外链图标 | v1.1 占位（无操作或 TODO） |

#### 5.2.6 回路 ③（任务 → AI 提问）— 仅控制台验证

由于本骨架未在 RoadmapDetailPage 任务卡片底部加"基于此任务提问"按钮，**PR 2 之前此功能无法手动测试**。可临时用 console 验证：

```js
sessionStorage.setItem('roadmapai-pending-tutor-message', '梯度下降怎么学？')
window.location.href = '/tutor'
```

预期：进入导师页后**自动发送**这条消息，AI 流式响应。

### 5.3 自动化建议

```ts
// cypress/e2e/ai-loop.cy.ts
describe('AI 闭环', () => {
  it('转闪卡', () => {
    cy.visit('/tutor')
    // 模拟 AI 回答
    cy.window().then((win) => {
      win.useChatStore.setState({ messages: [{ id: '1', role: 'assistant', content: '测试内容' }] })
    })
    cy.contains('转闪卡').click()
    cy.get('select').select(1)  // 选第一条路线
    cy.contains('保存').click()
    cy.visit('/flashcards')
    cy.contains('测试内容').should('exist')
  })
})
```

### 5.4 手动冒烟清单

- [ ] 原有聊天功能与 v1.0 完全一致（发消息、清空、上下文、错误）
- [ ] AI 回答底部出现 4 个按钮
- [ ] 复制成功（粘贴板内容正确）
- [ ] 转闪卡后 `/flashcards` 看到新卡片
- [ ] 转任务后对应路线阶段看到新任务
- [ ] 收藏 + 取消收藏，`/favorites` 列表同步
- [ ] 收藏页 5 个 Tab 都能正常切换
- [ ] 抽屉 ESC 关闭、背景点击关闭

---

## 六、方向 5：四态组件

### 6.1 改动文件

**纯新增**，无 v1.0 改动。但 4 态组件**会替换** v1.0 页面里的内联空态/加载/错误（PR 2-4）。替换前需要先**对替换目标页面做基线截图**。

### 6.2 替换前的基线

| 页面 | 现状 | 基线截图 |
| --- | --- | --- |
| HomePage | 单 spinner / 内联空态 | `screenshots/v1.0-home-empty.png` |
| FlashcardsPage | 单 spinner / 内联空态 | `screenshots/v1.0-flashcards-empty.png` |
| AiTutorPage | 内联红框错误 | `screenshots/v1.0-tutor-error.png` |
| SettingsPage | 简单红字保存失败 | `screenshots/v1.0-settings-error.png` |
| CreateRoadmapPage | 内联进度浮窗 | `screenshots/v1.0-create-progress.png` |

### 6.3 替换后的视觉对比

每个替换 PR 合入后：

- [ ] 浅色主题：空态 / 加载 / 错误截图与基线对比
- [ ] 深色主题：同上
- [ ] 插画自动反色
- [ ] 错误态的"查看详情"可展开
- [ ] Skeleton 与真实组件尺寸一致（无跳动）

### 6.4 自动化建议

```ts
// cypress/e2e/states.cy.ts
describe('四态组件', () => {
  it('无路线时显示 EmptyRoadmaps', () => {
    cy.intercept('GET', '/api/roadmaps', { body: [] })
    cy.visit('/')
    cy.contains('还没有学习路线').should('be.visible')
    cy.contains('创建第一条').click()
    cy.url().should('include', '/create')
  })
  
  it('断网时显示网络错误', () => {
    cy.visit('/')
    cy.intercept('GET', '/api/**', { forceNetworkError: true })
    cy.reload()
    cy.contains('网络已断开').should('be.visible')
  })
})
```

### 6.5 手动冒烟清单

- [ ] HomePage 删除所有路线 → `<EmptyRoadmaps />` 显示
- [ ] HomePage 网络慢时 → 6 个 `RoadmapCardSkeleton` 显示
- [ ] FlashcardsPage 全部完成 → `<EmptyTodayTodo />` 显示
- [ ] FavoritesPage 无收藏 → `<EmptyFavorites />` 显示
- [ ] AiTutorPage 配错 API Key → `<ErrorState level="api" />` 显示
- [ ] 关闭网络 → 整个应用切到 `<ErrorState level="network" />`
- [ ] 生成路线时 → `<LoadingState variant="progress" />` 显示
- [ ] 浅/深主题切换插画自动反色
- [ ] 屏幕阅读器朗读错误时听到 alert 角色

---

## 七、方向 6：Onboarding

### 7.1 改动文件

| 文件 | 改动类型 |
| --- | --- |
| `src/App.tsx` | 加 `OnboardingGate` 路由级拦截 |

**🔴 高风险**：OnboardingGate 包裹整个 Layout，**所有用户**都受影响。

### 7.2 关键回归

#### 7.2.1 首次启动

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 全新安装 | 清空 `localStorage` + 启动 | 自动进入 `/onboarding` |
| 旧用户 | 已完成过引导（`completed = true`） | 直接进首页，不出现引导 |
| 升级用户 | 从 v1.0 升级到 v1.1（无 onboarding 记录） | 直接进首页（Gate 看 `completed`，未设置 = undefined = falsy，**会进入引导**） |

> ⚠️ **第 3 个场景是已知的迁移陷阱**：从 v1.0 升级到 v1.1 的用户，**没有 `roadmapai-onboarding` localStorage 条目**，会被当作新用户强制引导。
>
> **缓解方案**（PR 2 必加）：检测到存在任意路线时，自动跳过引导并设 `completed = true`。

#### 7.2.2 完整引导流程

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 步骤 0 | 看到欢迎页 | "开始设置" 按钮 |
| 步骤 1 | 选 provider | 卡片选中态 + 推荐徽标 |
| 步骤 2 | 填 API Key | 测连接成功/失败 |
| 步骤 3 | 填主题 | 宽泛提示 vs 静默 |
| 步骤 4 | 选偏好 | 水平 + 目标 + 每周时长 |
| 步骤 5 | 生成路线 | 进度浮窗 |
| 完成页 | 生成成功 | 撒花 + 5s 倒计时 + 跳详情 |

#### 7.2.3 跳过行为

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 跳过警告 | 任意步骤点"跳过" | 弹窗，默认焦点"继续引导" |
| 选跳过 | 弹窗点"跳过引导" | `reset()` + 跳首页 |
| 选继续 | 弹窗点"继续引导" | 弹窗关闭 |
| 跳过后的首页 | API 未配置 | 顶部显示"待配置 API Key"提示（来自方向 1） |

#### 7.2.4 中断恢复

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 步骤 2 关应用 | 重新启动 | 回到步骤 2，字段保留 |
| 步骤 3 强退 | 重新启动 | 回到步骤 3 |
| 步骤 4 杀进程 | 重新启动 | 回到步骤 4，4 步字段都在 |
| localStorage 清空 | 任意时刻 | 重新进入步骤 0 |

#### 7.2.5 OnboardingGate 拦截

| 场景 | 步骤 | 预期 |
| --- | --- | --- |
| 未完成访问 `/` | 手动 URL 输入 | 跳 `/onboarding` |
| 未完成访问 `/flashcards` | 手动 URL 输入 | 跳 `/onboarding` |
| 已完成访问 `/` | 正常 | 渲染 Layout |
| 已完成访问 `/onboarding` | 正常 | 跳 `/`（completed 后已不需要引导） |

#### 7.2.6 已有用户升级回归

**最关键**：v1.0 已有用户升级到 v1.1：

- [ ] 启动后**不出现引导**（因为有路线数据）
- [ ] 主页 / 闪卡 / 路线详情 等所有页面正常访问
- [ ] 侧边栏正确显示当前路线
- [ ] 收藏夹、统计等 v1.1 新页面也可访问

### 7.3 自动化建议

```ts
// cypress/e2e/onboarding.cy.ts
describe('Onboarding', () => {
  it('全新用户走完引导', () => {
    cy.clearLocalStorage()
    cy.visit('/')
    cy.url().should('include', '/onboarding')
    // ... 走完 5 步
    cy.url().should('match', /\/roadmap\//)
  })
  
  it('已有用户跳过引导', () => {
    // 模拟已有路线 + 已完成
    cy.window().then((win) => {
      win.localStorage.setItem('roadmapai-onboarding', JSON.stringify({ state: { completed: true } }))
    })
    cy.visit('/')
    cy.url().should('eq', Cypress.config().baseUrl + '/')
  })
})
```

### 7.4 手动冒烟清单

- [ ] 清空 localStorage 后启动 → 自动进入引导
- [ ] 5 步走完 → 跳到路线详情
- [ ] 任意步骤点"跳过" → 警告弹窗 → 选跳过 → 回首页
- [ ] 步骤 3 强退应用 → 重启 → 回到步骤 3
- [ ] 已有路线的用户从 v1.0 升级 → 不出现引导
- [ ] 设置页加 [重新运行引导] 按钮（PR 2 补）可重置
- [ ] 引导生成的路线可正常使用

---

## 八、跨方向回归

### 8.1 数据兼容性

v1.1 新增多个字段，但**不破坏** v1.0 数据：

| 数据 | v1.0 字段 | v1.1 新增 | 兼容性 |
| --- | --- | --- | --- |
| Roadmap | title/description/... | 无 | ✅ 不变 |
| Stage | stageType/tasks/... | 无 | ✅ 不变 |
| Task | content/task_type/... | 无 | ✅ 不变 |
| Flashcard | question/answer/... | 无 | ✅ 不变 |
| Settings | api_provider/key | 无 | ✅ 不变 |
| **新增** Favorite 表 | — | type/ref_id/... | ✅ 新表，旧数据无影响 |

### 8.2 API 兼容性

v1.1 **新增** 4 个 Tauri 命令（来自方向 4），**不修改**任何 v1.0 命令。

| 命令 | v1.0 | v1.1 | 兼容性 |
| --- | --- | --- | --- |
| `get_all_roadmaps` | ✅ | ✅ | 不变 |
| `generate_roadmap` | ✅ | ✅ | 入参格式不变（`toRoadmapRequest` 拼回一致） |
| `get_roadmap` | ✅ | ✅ | 不变 |
| ...（其他 v1.0 命令） | ✅ | ✅ | 不变 |
| `add_favorite` | ❌ | ✅ 新增 | 仅前端用 |
| `list_favorites` | ❌ | ✅ 新增 | 仅前端用 |
| `add_task_to_stage` | ❌ | ✅ 新增 | 仅前端用 |
| `remove_favorite` | ❌ | ✅ 新增 | 仅前端用 |

### 8.3 性能回归

| 指标 | v1.0 基线 | v1.1 期望 | 监控方式 |
| --- | --- | --- | --- |
| 首屏时间 | < 1.5s | < 1.5s | Lighthouse |
| 路线列表加载 | < 500ms | < 500ms | Performance API |
| 侧边栏折叠动画 | 无 | 60fps | DevTools Performance |
| 抽屉滑入 | 无 | < 200ms | DevTools |
| 闪卡复习响应 | < 100ms | < 100ms | 手动 |

### 8.4 跨浏览器/平台

Tauri 应用理论上跨平台，但 v1.1 重点验证：

- [ ] Windows 10 / 11（WebView2）
- [ ] macOS 12+（WKWebView）
- [ ] Linux（WebKitGTK）— 优先级低

---

## 九、回归测试节奏

| 节点 | 跑哪些章节 |
| --- | --- |
| 每个 PR 合入前 | 第二节（前置）+ 该 PR 涉及的章节 |
| v1.1 全部合入后 | **跑全部章节**（二-八） |
| 灰度发布 | 八、性能 + 已有用户升级路径（七、7.2.6） |
| 正式发布 | 全部 + 灰度数据复盘 |

---

## 十、回归失败的处理

如果发现回归问题：

1. **不要在该 PR 修**——开新 issue 跟踪
2. **判断严重程度**：
   - P0（主流程断裂）→ 立即回滚 PR
   - P1（次要功能受影响）→ 评估修复成本，决定修还是延后
   - P2（视觉/体验问题）→ 延后到 v1.1.x
3. **记录到** `roadmapai-v1.1-regressions.md`（v1.1 期间维护），每周 review

---

## 十一、与 PR 模板的配合

每个 PR 模板（见 `roadmapai-v1.1-pr-templates.md`）的"回归测试"章节应：

- 列出本 PR 涉及的回归章节号（如"§3.2.1 路由跳转"）
- 贴出自动化测试通过截图
- 注明手动冒烟清单的执行结果

合入前需 review PR 的人**逐条核对**。
