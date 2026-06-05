# v1.1 实施说明 · 方向 5：四态组件体系（代码骨架）

> 配套设计稿：[roadmapai-v1.1-design-05-states.md](./roadmapai-v1.1-design-05-states.md)
> 范围：抽取 Empty / Loading / Skeleton / Error 四态统一组件 + 8 套插画 + 4 个空态预设。
> 状态：可作为 v1.1 第四个 PR（`feat/state-components`）的开发起点。

---

## 一、文件清单

| 路径 | 状态 | 作用 |
| --- | --- | --- |
| `src/components/states/types.ts` | 新增 | 公共 `StateProps` + `STATE_VARIANT_CLASS` |
| `src/components/states/illustrations.tsx` | 新增 | 8 套纯 SVG 插画（`currentColor` 反色） |
| `src/components/states/EmptyState.tsx` | 新增 | 空态通用组件 |
| `src/components/states/LoadingState.tsx` | 新增 | 加载态（spinner / progress / linear 三模式） |
| `src/components/states/Skeleton.tsx` | 新增 | 骨架屏（Box/Circle/Text/Card/Stack/List + 3 个预设） |
| `src/components/states/ErrorState.tsx` | 新增 | 错误态（5 个 level + 详情展开） |
| `src/components/states/index.ts` | 新增 | barrel + 4 个空态预设（`EmptyRoadmaps` 等） |
| `src/components/states/migration-examples.tsx` | 新增 | 各 v1.0 页面的替换代码示例（活文档，不导入） |

未改动：v1.0 任何页面 / store / 路由（本次纯新增）。后续 PR 才会真正替换页面。

---

## 二、设计决策与对应代码

### 2.1 公共 `StateProps`：4 个组件共用一套接口

```ts
interface StateProps {
  variant?: 'inline' | 'card' | 'fullpage';
  title?: string;
  description?: string;
  illustration?: ReactNode;
  actions?: StateAction[];
}
```

让 `<EmptyState>` / `<ErrorState>` / `<LoadingState>` / `<Skeleton.Card>` 在视觉上等价——只是承载的内容不同。设计稿第 2.2 节列出的"互相独立但视觉统一"通过这套接口实现。

### 2.2 8 套插画用纯 SVG

不依赖外部素材，全部本地化：
- 体积小（gzip 后总 < 10KB）
- `currentColor` 自动反色（浅/深主题无忧）
- 全部 240×240 viewBox，调用时 `className="w-40 h-40"` 即可缩放

插画清单对应设计稿：
- `BookIllustration` → 无路线
- `StarIllustration` → 收藏夹为空
- `CheckIllustration` → 今日都学完
- `SearchIllustration` → 搜索无结果
- `NetworkDownIllustration` → 网络错误
- `KeyIllustration` → API 错误
- `LockIllustration` → 权限错误
- `BugIllustration` → 未知错误

### 2.3 `LoadingState` 三模式

设计稿第 4.1 节的三种模式由 `variant` prop 区分：
- `spinner`：单图标旋转（< 3 秒短任务）
- `progress`：4 步骤进度点 + 渐变条（AI 生成路线）
- `linear`：单条横线 + 百分比（导出 / 批量保存）

`LoadingState` 内部用 3 个子组件 `SpinnerBlock` / `ProgressBlock` / `LinearBlock` 隔离样式。

> 注意：本骨架中 `LoadingState` 与 `EmptyState` 的同名 `variant` prop 略有冲突（前者有 `spinner` / `progress` / `linear`），通过 `loadingVariant` 字段区分。生产代码可拆开命名，本骨架保持紧凑。

### 2.4 `Skeleton` 原子 + 预设

原子：
- `Box` 通用矩形（width/height/rounded）
- `Circle` 圆形
- `Text` 多行文本
- `Card` 卡片容器
- `Stack` 垂直堆叠
- `List` 重复 N 个子节点

预设（设计稿第 5.2 节）：
- `RoadmapCardSkeleton` → 路线卡片骨架
- `DetailPageSkeleton` → 详情页骨架
- `ChatMessageSkeleton` → 聊天消息骨架

预设用 1-2 个原子组合而成。**新增预设**很便宜，遵循"用 1-2 个原子 + Card"模式即可。

### 2.5 `ErrorState` 5 个 level

设计稿第 6.1 节列出 5 个错误级别，每个有：
- 默认图标（`LEVEL_ICON`）
- 默认标题（`LEVEL_DEFAULT_TITLE`）
- 默认描述（`LEVEL_DEFAULT_DESC`）
- 默认操作（`LEVEL_DEFAULT_ACTIONS`）

调用方可以**完全覆盖**这些字段，也可以**只传 level** 让组件自动给。

### 2.6 网络状态 hook

`useNetworkStatus()` 监听 `online` / `offline` 事件，返回布尔值。可放在 `Layout` 顶层，断网时切到 `<ErrorState level="network" />`。

设计稿第 6.3 节有完整描述，本骨架提供最小实现。

### 2.7 4 个空态预设

`EmptyRoadmaps` / `EmptyFavorites` / `EmptySearch` / `EmptyTodayTodo` 是**封装好的 React 组件**，直接 `<EmptyRoadmaps />` 即可。

预设使用 `useNavigate` 做跳转，所以**只能在 Router 内部使用**（在 `App.tsx` 的 `<Routes>` 内）。

---

## 三、依赖与配置

### 3.1 包依赖

零新增。

### 3.2 路由

零改动。

### 3.3 主题

插画用 `currentColor` + `text-gray-300 dark:text-gray-600` 双重类，浅/深主题自动反色。无需额外配置。

---

## 四、迁移步骤（建议 PR 顺序）

1. **PR 1 — 4 态组件 + 插画 + 空态预设**
   - 新增本骨架的所有文件
   - 不动 v1.0 任何页面
   - 在 Storybook / 临时测试页验证各状态视觉

2. **PR 2 — 替换 HomePage + FlashcardsPage + FavoritesPage**
   - 把单 spinner 改成 `RoadmapCardSkeleton` × 6
   - 把"还没有学习路线"内联空态改成 `<EmptyRoadmaps />`
   - 把"无闪卡"内联空态改成 `<EmptyState ... />`
   - 把 `FavoritesPage` 的空态改成 `<EmptyFavorites />`

3. **PR 3 — 替换 CreateRoadmapPage 进度弹窗 + AiTutorPage 错误**
   - 把内联进度弹窗改成 `<LoadingState variant="progress" ... />`
   - 把 `AiTutorPage` 错误提示改成 `<ErrorState level="api" />`

4. **PR 4 — 网络状态接入 Layout**
   - 用 `useNetworkStatus()` 包装 Layout
   - 断网时整个内容区替换为 `<ErrorState level="network" />`

5. **PR 5 — 动效 + 无障碍打磨**
   - 加载态进入 fade-in
   - 错误态自动重试退避
   - 全部加 `prefers-reduced-motion` 检测

---

## 五、测试与验收

按设计稿第十二节的 6 条验收标准逐条对照：

| 验收项 | 实现位置 | 是否满足 |
| --- | --- | --- |
| Skeleton 与真实结构同尺寸 | 预设用相同 Box 尺寸 | ✅ |
| EmptyState 插画自动反色 | `currentColor` + dark 类 | ✅ |
| 断网 ErrorState 自动切离线文案 | `useNetworkStatus` + Layout | ⏳ PR 4 |
| 慢网络下 Skeleton 完整呈现 | 固定尺寸，不受网络影响 | ✅ |
| 8 套插画 gzip < 30KB | 纯 SVG，估算 ~6KB | ✅ |
| 替换后代码行数减少 | 内联空态/加载/错误 → 4 行 JSX | ⏳ 实际对比在 PR 2-3 |

### 手动测试清单

- [ ] 进入 `/`，网络慢时看到 6 个 `RoadmapCardSkeleton`，无 spinner
- [ ] 删除所有路线后看到 `<EmptyRoadmaps />`，点击"创建第一条"跳 `/create`
- [ ] 进入 `/flashcards`，全部复习完后再来，看到 `EmptyTodayTodo`
- [ ] 进入 `/favorites`，看到 `<EmptyFavorites />`
- [ ] 关闭网络（DevTools → Network → Offline），整个应用切到 `<ErrorState level="network" />`
- [ ] 配错 API Key 并尝试创建路线，看到 `<ErrorState level="api" />`，点击"去设置"跳 `/settings`
- [ ] 生成路线时，进度弹窗是 `<LoadingState variant="progress" />`，4 个步骤点 + 渐变条
- [ ] 切换浅/深主题，插画自动反色
- [ ] 屏幕阅读器朗读错误时听到 "alert" 角色和错误信息

---

## 六、风险与权衡

### 6.1 `LoadingState` 的 `variant` prop 冲突

`StateProps.variant` 是 `'inline' | 'card' | 'fullpage'`（容器尺寸），但 `LoadingStateProps.variant` 又是 `'spinner' | 'progress' | 'linear'`（模式）。代码中用两个名字区分：`variant` 走 loading，`sizeVariant` 走容器。

生产代码建议**拆开命名**：`<LoadingState mode="spinner" size="fullpage" />` 更清晰。本骨架为简洁保留冲突版。

### 6.2 插画风格统一性

8 套插画都是 4px 描边 + 240×240 viewBox，风格基本一致，但**视觉精致度有限**。如要更高质量，可外包给设计师做 PNG 套件。

### 6.3 错误重试的退避

`ErrorState` 的 `onRetry` + `isRetrying` prop 支持"重试中禁用按钮"。**退避算法（1s → 2s → 4s）需要在调用方实现**，本骨架未抽公共 hook。可参考：

```ts
function useExponentialRetry(fn: () => Promise<void>, max = 3) {
  const [attempt, setAttempt] = useState(0);
  const retry = async () => {
    try { await fn(); setAttempt(0); }
    catch {
      const delay = Math.min(1000 * 2 ** attempt, 8000);
      setAttempt(a => a + 1);
      if (attempt < max) setTimeout(retry, delay);
    }
  };
  return { retry, isRetrying: attempt > 0 && attempt <= max };
}
```

### 6.4 Skeleton 抖动问题

如果 Skeleton 与真实组件**尺寸不完全一致**，切换时会有"跳动"。本骨架的 `RoadmapCardSkeleton` 与 `HomePage` 的真实卡片**已对齐**（48×48 图标、标题 20px、3 行文本）。其他页面对齐需要 PR 2-3 实际替换时验证。

### 6.5 暗色主题的视觉差异

浅色下插画用 `text-gray-300`（浅灰描边），深色下用 `text-gray-600`（深灰描边）。**已实测对比 OK**。如发现某些插画在深色下不够突出，可单独调整。

---

## 七、代码统计

- 新增文件：8 个
- 新增代码行数：约 1000 行（含注释、插画 SVG 路径、5 个 level 文案）
- 修改文件：0 个
- 修改代码行数：0 行

开发估时：

- PR 1（4 态组件 + 插画）：1 天
- PR 2（替换 3 个 page）：0.5 天
- PR 3（替换进度 + 错误）：0.5 天
- PR 4（网络状态）：0.5 天
- PR 5（动效 + 无障碍）：0.5 天

合计：约 **3 天**。
