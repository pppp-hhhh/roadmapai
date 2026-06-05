# v1.1 设计稿 · 方向 5：四态组件体系

> 范围：抽取 Empty / Loading / Skeleton / Error 四类统一状态组件，让全产品在数据状态切换时保持一致的品质感。
> 关联总览：[roadmapai-v1.1-design-overview.md](./roadmapai-v1.1-design-overview.md)
> 状态：v1.1 候选（次优先），可在 1.1.x 或 1.2 落地。

---

## 一、设计目标

1. **解决 v1.0 各页面"各自写状态"** 的问题（每个页面都有自己的 spinner、empty 文案、错误提示）。
2. **缩短用户对"卡死"的感知**：用 Skeleton 替代生硬的 spinner，让用户看到"内容正在搭建"。
3. **错误分级**：网络错误、API 错误、空数据、权限错误分别有专属文案与操作建议。
4. **可组合、可扩展**：所有四态组件遵循同一套 props 接口，便于在任意页面复用。

---

## 二、组件总览

| 组件 | 用途 | 出现场景 |
| --- | --- | --- |
| `<EmptyState>` | 空数据 | 路线列表为空 / 没有待复习卡片 / 收藏夹为空 / 搜索无结果 |
| `<LoadingState>` | 加载中（带进度感） | AI 生成路线时 / 导出大文件时 / 提交长任务时 |
| `<Skeleton>` | 占位骨架 | 路线列表加载 / 闪卡列表加载 / 详情页加载 |
| `<ErrorState>` | 错误 | 网络断连 / API 报错 / 权限不足 / 数据损坏 |

每个组件的 props 都遵循：

```ts
interface StateProps {
  variant?: 'inline' | 'card' | 'fullpage';  // 容器尺寸
  title?: string;                             // 主标题
  description?: string;                       // 副标题/说明
  illustration?: ReactNode;                   // 自定义插画
  actions?: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' }[];
}
```

---

## 三、EmptyState

### 3.1 视觉语言

```
┌──────────────────────────────────────────┐
│                                          │
│              [插画 / 图标]                │
│                                          │
│           主标题（18px 粗体）             │
│                                          │
│        副标题（14px 灰色，最多 2 行）     │
│                                          │
│      [主操作]   [次操作（可选）]          │
│                                          │
└──────────────────────────────────────────┘
```

- 容器：`text-center py-16`（fullpage 模式）。
- 插画：240×240 SVG，单色线稿，描边色 `gray-300`，可在浅/深主题下反色。
- 主标题：`text-xl font-semibold text-gray-900 dark:text-white`。
- 副标题：`text-sm text-gray-500 dark:text-gray-400`，`max-w-md mx-auto`。
- 主操作：`bg-primary-600 text-white rounded-xl px-6 py-3`。
- 次操作：`text-gray-500 hover:text-gray-700`，无背景。

### 3.2 4 种空状态预设

| 场景 | 插画 | 主标题 | 副标题 | 主操作 |
| --- | --- | --- | --- | --- |
| 无路线 | 📚 大书 | "还没有学习路线" | "创建你的第一条 AI 学习路线" | [创建第一条] → /create |
| 无待复习 | ✅ 勾选 | "今天都学完啦" | "继续保持，或探索新主题" | [探索新主题] → /create |
| 收藏夹为空 | ⭐ 空星 | "收藏夹是空的" | "把任务/资源/AI 回答收藏到这里" | [浏览我的路线] → / |
| 搜索无结果 | 🔍 空镜 | "没有匹配的结果" | "试试其他关键词" | [清空搜索] |

### 3.3 通用接口

```tsx
<EmptyState
  illustration={<BookIllustration />}
  title="还没有学习路线"
  description="创建你的第一条 AI 学习路线，让我们助你规划通往精通的旅程。"
  actions={[
    { label: '创建第一条', onClick: () => navigate('/create'), variant: 'primary' },
  ]}
  variant="fullpage"  // 或 'card' / 'inline'
/>
```

---

## 四、LoadingState

### 4.1 三种模式

| 模式 | 用途 | 视觉 |
| --- | --- | --- |
| `spinner` | 短任务（<3 秒） | 居中旋转图标 |
| `progress` | 长任务（AI 生成） | 复用 v1.0 的四阶段进度弹窗 |
| `linear` | 中等任务（导出、批量保存） | 顶部条状进度条 |

### 4.2 progress 模式（生成路线）

复用 v1.0 的四阶段进度组件 `<RoadmapGenerationProgress>`，提取为公共组件（v1.0 嵌在 CreateRoadmapPage 内，v1.1 抽离）：

- 4 个步骤圆点 + 连接线。
- 进度条：渐变 + 微光。
- 阶段标题、当前阶段名、百分比。
- 取消按钮。

### 4.3 linear 模式（导出 / 批量操作）

```
┌──────────────────────────────────────────┐
│ 正在导出路线...                          │
│ ━━━━━━━━━━━━━━━━░░░░░░░░░░░░  68%        │
│                                          │
│ 已处理 6/9 个阶段 · 约剩 12 秒            │
└──────────────────────────────────────────┘
```

- 弹层宽 480 px，居中。
- 进度条 4 px 高，圆角 `rounded-full`。
- 文字 12px 灰色。

### 4.4 通用接口

```tsx
<LoadingState
  variant="progress"  // 'spinner' | 'progress' | 'linear'
  title="正在导出..."
  steps={['打包数据', '生成 PDF', '上传', '完成']}
  currentStep={2}
  percent={68}
  onCancel={() => {}}
/>
```

---

## 五、Skeleton

### 5.1 基础元素

| 元素 | 用途 | 视觉 |
| --- | --- | --- |
| `<Skeleton.Box>` | 通用矩形 | 灰底圆角，120×16 默认 |
| `<Skeleton.Circle>` | 圆形（头像、图标） | 直径 40 px |
| `<Skeleton.Text>` | 文本行 | 整行宽度，多行堆叠 |
| `<Skeleton.Card>` | 卡片 | 组合 Box + Text |

- 颜色：`bg-gray-200 dark:bg-gray-700`。
- 动画：`animate-pulse`（沿用 Tailwind）。
- 圆角：与目标元素一致（卡片 `rounded-2xl`，文本 `rounded`）。

### 5.2 预设组合

```tsx
// 路线卡片骨架
<Skeleton.Card>
  <div className="flex items-start gap-4">
    <Skeleton.Circle size={48} />
    <div className="flex-1 space-y-2">
      <Skeleton.Box width="60%" height={20} />
      <Skeleton.Box width="90%" height={14} />
      <Skeleton.Box width="40%" height={14} />
    </div>
  </div>
</Skeleton.Card>

// 详情页骨架
<Skeleton>
  <Skeleton.Box width="40%" height={28} />  {/* 标题 */}
  <Skeleton.Box width="80%" height={16} />  {/* 描述 */}
  <div className="mt-8 space-y-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <Skeleton.Box key={i} width="100%" height={80} />
    ))}
  </div>
</Skeleton>
```

### 5.3 通用接口

```tsx
<Skeleton
  count={6}            // 渲染数量（列表场景）
  variant="card"       // 'box' | 'circle' | 'text' | 'card'
  width={120}
  height={16}
  rounded="xl"
/>
```

---

## 六、ErrorState

### 6.1 错误分级

| 级别 | 触发条件 | 视觉 | 操作 |
| --- | --- | --- | --- |
| `network` | 网络断连 | 离线插画 + "网络异常" | [重试] [查看缓存] |
| `api` | API Key 错误 / 余额不足 / 限流 | 🔑 插画 + 明确文案 | [去设置] [重试] |
| `empty-result` | AI 生成的路线无内容 | ⚠️ 插画 | [调整输入] [换模型] |
| `permission` | 文件无权限 / 磁盘满 | 🔒 插画 | [查看帮助] |
| `unknown` | 其他 | 🐛 插画 | [重试] [反馈] [查看日志] |

### 6.2 视觉

```
┌──────────────────────────────────────────┐
│                                          │
│              [错误插画]                   │
│                                          │
│           主标题（红色 18px 粗体）        │
│                                          │
│      副标题（说明原因 + 建议操作）        │
│                                          │
│      [主操作]   [次操作]   [反馈]         │
│                                          │
│      [展开 ▼ 查看错误详情]                │
└──────────────────────────────────────────┘
```

- 主标题颜色：`text-red-600 dark:text-red-400`。
- "展开错误详情"默认折叠，点击展开显示 `error.stack`（开发环境）或脱敏后的错误码（生产环境）。

### 6.3 网络错误的特殊处理

- 检测到 `navigator.onLine === false` 时，自动切到离线模式。
- 显示"网络已断开，正在使用本地缓存"提示。
- 网络恢复后自动重试上次失败的请求。

### 6.4 通用接口

```tsx
<ErrorState
  level="api"
  title="API Key 无效"
  description="请在设置中检查你的 API Key 是否正确，或余额是否充足。"
  error={err}  // 原始错误对象，会在"详情"中展示
  actions={[
    { label: '去设置', onClick: () => navigate('/settings'), variant: 'primary' },
    { label: '重试', onClick: handleRetry, variant: 'secondary' },
    { label: '反馈', onClick: openFeedback },
  ]}
/>
```

---

## 七、组件目录与文件组织

```
src/
├── components/
│   ├── states/
│   │   ├── EmptyState.tsx
│   │   ├── LoadingState.tsx
│   │   ├── Skeleton.tsx
│   │   ├── ErrorState.tsx
│   │   ├── illustrations/        # 4 套插画（每套 4-6 个）
│   │   │   ├── EmptyBook.tsx
│   │   │   ├── EmptyStar.tsx
│   │   │   ├── EmptyCheck.tsx
│   │   │   ├── NetworkDown.tsx
│   │   │   ├── ApiKey.tsx
│   │   │   ├── Lock.tsx
│   │   │   └── Bug.tsx
│   │   └── index.ts
│   └── ...
```

- 插画使用纯 SVG（不依赖外部素材），尺寸 240×240 默认。
- 浅/深主题通过 `currentColor` 自动反色。
- 主题色统一为 `gray-300`（线稿），避免破坏整体观感。

---

## 八、对 v1.0 现状的替换清单

| 页面 | v1.0 现状 | v1.1 替换 |
| --- | --- | --- |
| HomePage 加载 | 单 spinner | `<Skeleton count={6} variant="card" />` |
| HomePage 空 | 自写图标+文字 | `<EmptyState variant="empty-roadmaps" />` |
| CreateRoadmapPage 进度 | 嵌在页面内 | 抽离为 `<LoadingState variant="progress" />` |
| RoadmapDetailPage 加载 | 单 spinner | `<Skeleton>` 标题 + 5 个任务骨架 |
| RoadmapDetailPage 错误 | 无 | `<ErrorState level="api" />` |
| FlashcardsPage 加载 | 单 spinner | `<Skeleton count={3} variant="card" />` |
| FlashcardsPage 空 | 自写 emoji | `<EmptyState variant="empty-flashcards" />` |
| AiTutorPage 错误 | 自写红框 | `<ErrorState level="api" />` |
| SettingsPage 保存失败 | 简单红字 | `<ErrorState level="api" inline />` |

---

## 九、视觉规范

| 元素 | 浅色 | 深色 |
| --- | --- | --- |
| 容器背景 | `bg-white` | `bg-gray-800` |
| 主标题 | `text-gray-900` | `text-white` |
| 副标题 | `text-gray-500` | `text-gray-400` |
| 插画线稿 | `text-gray-300` | `text-gray-600` |
| 错误主标题 | `text-red-600` | `text-red-400` |
| Skeleton 背景 | `bg-gray-200` | `bg-gray-700` |
| 骨架动画 | `animate-pulse` | 同上 |
| 主操作 | `bg-primary-600` | 同上 |
| 次操作 | `text-gray-500 hover:text-gray-700` | `text-gray-400 hover:text-gray-200` |

字号：主标题 18-24px（fullpage 24，card 18） / 副标题 14px / 操作 14px。
圆角：卡片 `rounded-2xl`，按钮 `rounded-xl`。
阴影：仅 fullpage 模式默认无阴影（避免与背景割裂），inline 模式可加 `shadow-sm`。

---

## 十、可访问性

1. **ARIA 角色**：
   - `<EmptyState>` 加 `role="status"`。
   - `<LoadingState>` 加 `role="status" aria-live="polite"`。
   - `<ErrorState>` 加 `role="alert" aria-live="assertive"`。
2. **键盘可达**：所有操作按钮都可 Tab 聚焦，焦点环沿用 `focus:ring-2 focus:ring-primary-500`。
3. **屏幕阅读器**：插画都带 `aria-hidden="true"`，标题/副标题可被朗读。

---

## 十一、技术实现要点

1. **组件基于 React.lazy + Suspense**：插画按需加载，避免首屏 bundle 过大。
2. **Skeleton 与真实组件同结构**：让"骨架→真实"的过渡自然，避免布局抖动。
3. **ErrorState 自动重试**：网络错误时支持指数退避（1s → 2s → 4s），最多 3 次。
4. **EmptyState 预设**：通过 `variant` prop 选用预设（`'empty-roadmaps' | 'empty-flashcards' | 'empty-favorites' | 'empty-search'`），减少重复 props。
5. **插画统一封装**：所有插画接收 `className` 和 `size` props，不写死尺寸。

---

## 十二、验收标准

1. 任意页面从 loading → loaded 的过渡无布局抖动（Skeleton 与真实结构同尺寸）。
2. EmptyState 在浅/深主题下插画自动反色。
3. 网络断开时 ErrorState 自动切到离线文案，恢复后自动重试。
4. Skeleton 在慢网络（3G 模拟）下能完整呈现，让用户感知"内容正在加载"。
5. 4 套插画体积总和 < 30KB（gzip）。
6. 替换 v1.0 的所有状态 UI 后，整体代码行数应减少（统一组件的复用价值）。
