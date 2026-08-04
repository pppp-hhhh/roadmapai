import { useEffect, useState, type FC } from 'react';
import { Star, Trash2, MessageSquare, ListTodo, Link2, ArrowUpRight, ExternalLink, X, FileText, AlertTriangle, type LucideIcon } from 'lucide-react';
import { useFavoriteStore, type Favorite, type FavoriteType } from '../stores/useFavoriteStore';
import { useRoadmapStore } from '../stores/useRoadmapStore';
import { EmptyFavorites, LoadingState, ErrorState } from '../components/states';
import { useExponentialRetry } from '../utils/useExponentialRetry';
import { roman } from '../components/manuscript/roman';
import { sanitizeMarkdown, toPlainText } from '../utils/markdown';
import { openExternalLink } from '../utils/links';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { lowlight } from '../utils/markdown';
import type { Resource, Stage, Task } from '../types';

const FILTER_TABS: { key: FavoriteType | 'all'; label: string; icon: LucideIcon }[] = [
  { key: 'all',      label: '全 部',     icon: Star },
  { key: 'task',     label: '任 务',     icon: ListTodo },
  { key: 'resource', label: '资 源',     icon: Link2 },
  { key: 'message',  label: 'AI 回 答',  icon: MessageSquare },
];

const TYPE_ICON: Record<FavoriteType, LucideIcon> = {
  task: ListTodo, resource: Link2, message: MessageSquare,
};
const TYPE_LABEL: Record<FavoriteType, string> = {
  task: '任 务', resource: '资 源', message: 'AI 回 答',
};

export default function FavoritesPage() {
  const { favorites, isLoading, error, filter, setFilter, fetchFavorites, removeFavorite } =
    useFavoriteStore();
  const { currentRoadmap, fetchRoadmap } = useRoadmapStore();
  const { retry, isRetrying } = useExponentialRetry(async () => { await fetchFavorites(); });

  const [resourceModal, setResourceModal] = useState<{ resource: Resource; fromTask: string; fromStage: string } | null>(null);
  const [taskModal, setTaskModal] = useState<{ task: Task; fromStage: string; fromStageId: string; roadmapId: string } | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const openResource = async (fav: Favorite) => {
    if (!fav.roadmap_id) return;
    setResourceLoading(true);
    try {
      let rmp = currentRoadmap;
      if (!rmp || rmp.id !== fav.roadmap_id) {
        await fetchRoadmap(fav.roadmap_id);
        rmp = useRoadmapStore.getState().currentRoadmap;
      }
      if (!rmp) return;
      let found: { resource: Resource; fromTask: string; fromStage: string } | null = null;
      outer: for (const s of rmp.stages as Stage[]) {
        for (const t of s.tasks as Task[]) {
          const hit = t.resources?.find((r) => r.id === fav.ref_id);
          if (hit) {
            found = { resource: hit, fromTask: t.title, fromStage: s.name };
            break outer;
          }
        }
      }
      if (found) setResourceModal(found);
    } finally {
      setResourceLoading(false);
    }
  };

  const openTask = async (fav: Favorite) => {
    if (!fav.roadmap_id) return;
    setResourceLoading(true);
    try {
      let rmp = currentRoadmap;
      if (!rmp || rmp.id !== fav.roadmap_id) {
        await fetchRoadmap(fav.roadmap_id);
        rmp = useRoadmapStore.getState().currentRoadmap;
      }
      if (!rmp) return;
      let found: { task: Task; fromStage: string; fromStageId: string; roadmapId: string } | null = null;
      outer: for (const s of rmp.stages as Stage[]) {
        const t = s.tasks?.find((x) => x.id === fav.ref_id);
        if (t) {
          found = { task: t, fromStage: s.name, fromStageId: s.id, roadmapId: fav.roadmap_id };
          break outer;
        }
      }
      if (found) setTaskModal(found);
    } finally {
      setResourceLoading(false);
    }
  };

  const handleItemOpen = async (fav: Favorite) => {
    if (fav.type === 'resource') { await openResource(fav); return; }
    if (fav.type === 'task')    { await openTask(fav); return; }
    if (fav.roadmap_id) {
      window.location.assign(`/roadmap/${fav.roadmap_id}`);
    } else if (fav.type === 'message') {
      window.location.assign('/tutor');
    } else {
      window.location.assign('/');
    }
  };

  const visibleFavorites = favorites.filter(
    (f) => f.type === 'task' || f.type === 'resource' || f.type === 'message'
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-12 py-10">
        <header className="mb-8 animate-ink-spread">
          <div className="flex items-center gap-3 mb-3">
            <div className="smallcaps">第 五 章 · 录 珍</div>
            <div className="flex-1 h-px bg-gilt-500/40" />
            <Star size={14} className="text-gilt-500" />
          </div>
          <h1 className="font-display text-5xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-none">
            <span className="italic text-seal-500">收</span>藏 夹
          </h1>
          <p className="font-display italic text-base text-ink-fade dark:text-ink-soft mt-3">
            集 中 管 理 你 标 记 的 高 价 值 内 容。
          </p>
          <div className="rule-gilt mt-5 max-w-xs" />
        </header>

        {/* Tabs — 罗马编号书签式 */}
        <div className="flex gap-1 mb-6 border-b border-ink-200 dark:border-ink-700/40 overflow-x-auto">
          {FILTER_TABS.map(({ key, label, icon: Icon }, i) => {
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 font-display text-sm whitespace-nowrap transition-colors
                  ${active
                    ? 'text-seal-500'
                    : 'text-ink-fade hover:text-ink-700 dark:hover:text-ink-100'
                  }`}
              >
                <span className={`font-display italic text-[10px] tabular-nums ${active ? 'text-seal-400' : 'text-ink-fade/60'}`}>
                  {roman(i + 1)}
                </span>
                <Icon size={14} />
                <span>{label}</span>
                {active && (
                  <span aria-hidden className="absolute bottom-0 left-0 right-0 h-px bg-seal-400" />
                )}
              </button>
            );
          })}
        </div>

        {isLoading && <LoadingState variant="card" loadingVariant="spinner" description="加 载 收 藏 中 …" />}
        {!isLoading && error && (
          <ErrorState variant="card" level="unknown" error={error} onRetry={retry} isRetrying={isRetrying} />
        )}
        {!isLoading && !error && visibleFavorites.length === 0 && <EmptyFavorites />}

        {!isLoading && !error && visibleFavorites.length > 0 && (
          <ul className="space-y-3">
            {visibleFavorites.map((f) => (
              <FavoriteItem
                key={f.id}
                favorite={f}
                onOpen={() => handleItemOpen(f)}
                onRemove={() => removeFavorite(f.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {resourceModal && (
        <ResourceDetailModal
          data={resourceModal}
          onClose={() => setResourceModal(null)}
        />
      )}

      {taskModal && (
        <TaskDetailModal
          data={taskModal}
          onClose={() => setTaskModal(null)}
        />
      )}

      {resourceLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 dark:bg-black/60 backdrop-blur-sm">
          <div className="text-center">
            <div className="font-display italic text-ink-50 text-sm tracking-wider mb-3">取 典 中</div>
            <div className="w-32 h-px bg-ink-50/30 mx-auto overflow-hidden">
              <div className="h-full w-1/3 bg-seal-400 animate-flow" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FavoriteItem({ favorite, onOpen, onRemove }: { favorite: Favorite; onOpen: () => void; onRemove: () => void }) {
  const Icon = TYPE_ICON[favorite.type];
  return (
    <li
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
      }}
      className="manuscript-card p-4 group hover:border-seal-400 transition-colors cursor-pointer relative"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 border border-ink-300 dark:border-ink-600
          bg-paper dark:bg-night-200 flex items-center justify-center flex-shrink-0 text-gilt-500">
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="smallcaps text-[9px]">
              {TYPE_LABEL[favorite.type]}
            </span>
            <span className="font-mono text-[10px] text-ink-fade">
              {new Date(favorite.created_at).toLocaleDateString()}
            </span>
            <ArrowUpRight size={12} className="ml-auto text-ink-fade opacity-0 group-hover:opacity-100
              group-hover:text-seal-500 transition-all" />
          </div>
          <h3 className="font-display text-[15px] font-semibold text-ink-700 dark:text-ink-100 line-clamp-2 tracking-tight">
            {favorite.title}
          </h3>
          {favorite.preview && (
            <p className="mt-1.5 font-display italic text-sm text-ink-fade dark:text-ink-soft line-clamp-2 leading-relaxed">
              {toPlainText(favorite.preview, 160)}
            </p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-2 text-ink-fade hover:text-seal-500 hover:bg-ink-100/50 dark:hover:bg-night-300/50
            opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
          title="取消收藏"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
}

const RESOURCE_TYPE_LABEL: Record<string, string> = {
  documentation: '典 · DOCUMENTATION',
  video:         '影 · VIDEO',
  course:        '課 · COURSE',
  article:       '文 · ARTICLE',
};

const ResourceDetailModal: FC<{
  data: { resource: Resource; fromTask: string; fromStage: string };
  onClose: () => void;
}> = ({ data, onClose }) => {
  const { resource: r, fromTask, fromStage } = data;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 dark:bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="manuscript-card max-w-2xl w-full max-h-[85vh] overflow-auto animate-ink-spread"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 装订条 */}
        <div className="sticky top-0 z-10 bg-ink-50/95 dark:bg-night-100/95 backdrop-blur
          border-b border-ink-200 dark:border-ink-700/40 px-7 py-5 flex items-start justify-between">
          <div>
            <div className="smallcaps mb-1.5 text-gilt-500">— 资 源 · RESOURCE —</div>
            <h2 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-tight max-w-[480px]">
              {r.title}
            </h2>
            <p className="font-display italic text-xs text-ink-fade mt-2">
              {RESOURCE_TYPE_LABEL[r.resource_type] || r.resource_type}
              <span className="mx-2 text-ink-fade/50">·</span>
              第 {fromStage} · {fromTask}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-ink-fade hover:text-seal-500 transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-7 space-y-5">
          {r.snippet && (
            <section>
              <div className="smallcaps mb-2 text-[9px]">引 · SNIPPET</div>
              <blockquote className="font-display italic text-sm text-ink-600 dark:text-ink-200
                border-l-2 border-gilt-500 pl-4 py-2 leading-relaxed">
                {r.snippet}
              </blockquote>
            </section>
          )}

          <section>
            <div className="smallcaps mb-2 text-[9px]">链 · URL</div>
            <div className="font-mono text-xs text-ink-600 dark:text-ink-200 break-all
              bg-ink-50/60 dark:bg-night-200/40 px-3 py-2 border border-ink-200 dark:border-ink-700/40">
              {r.url}
            </div>
          </section>

          <div className="flex gap-3 pt-3 border-t border-dashed border-ink-200/60 dark:border-ink-700/40">
            <button
              onClick={() => openExternalLink(r.url)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3
                bg-seal-500 hover:bg-seal-400 text-ink-50
                transition-colors font-display text-sm border-2 border-seal-600"
            >
              <ExternalLink size={15} />
              <span>展 卷 · 打 开</span>
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-ink-300 dark:border-ink-600
                hover:border-seal-400 hover:text-seal-500 text-ink-600 dark:text-ink-200
                transition-colors font-display text-sm bg-transparent"
            >
              合 卷
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TASK_TYPE_LABEL: Record<string, string> = {
  reading: '阅 · READING', video: '影 · VIDEO', project: '作 · PROJECT',
};

const TaskDetailModal: FC<{
  data: { task: Task; fromStage: string; fromStageId: string; roadmapId: string };
  onClose: () => void;
}> = ({ data, onClose }) => {
  const { task, fromStage, roadmapId } = data;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 dark:bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="manuscript-card max-w-2xl w-full max-h-[85vh] overflow-auto animate-ink-spread"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 装订条 */}
        <div className="sticky top-0 z-10 bg-ink-50/95 dark:bg-night-100/95 backdrop-blur
          border-b border-ink-200 dark:border-ink-700/40 px-7 py-5 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="smallcaps mb-1.5 text-seal-500">
              — 任 务 · TASK · {TASK_TYPE_LABEL[task.task_type] || task.task_type}
            </div>
            <h2 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-tight">
              {task.title}
            </h2>
            <p className="font-display italic text-xs text-ink-fade mt-2">
              收 录 于 · 第 {fromStage}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-ink-fade hover:text-seal-500 transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-7 space-y-6">
          {/* 任务内容 */}
          {task.content?.trim() ? (
            <section>
              <div className="smallcaps mb-2 text-[9px] flex items-center gap-2">
                <FileText size={10} className="text-seal-500" />
                <span>内 容 · CONTENT</span>
              </div>
              <div className="markdown-content text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { lowlight }]]}>
                  {sanitizeMarkdown(task.content)}
                </ReactMarkdown>
              </div>
            </section>
          ) : (
            <div className="border-l-2 border-seal-400 pl-4 py-2 bg-seal-50/40 dark:bg-seal-700/10">
              <div className="flex items-center gap-2 text-seal-500 font-display italic text-sm font-semibold mb-1">
                <AlertTriangle size={14} />
                墨 痕 未 干
              </div>
              <p className="font-display italic text-xs text-ink-fade leading-relaxed">
                AI 暂 未 为 此 节 着 墨。可 循 题 自 补,或 于 AI 导 师 处 求 教。
              </p>
            </div>
          )}

          {task.example?.trim() && (
            <section>
              <div className="smallcaps mb-2 text-[9px] text-gilt-500">示 例 · EXAMPLE</div>
              <div className="border border-gilt-500/40 bg-gilt-500/5 p-4">
                <div className="markdown-content text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { lowlight }]]}>
                    {sanitizeMarkdown(task.example)}
                  </ReactMarkdown>
                </div>
              </div>
            </section>
          )}

          {/* 资源列表 */}
          {task.resources && task.resources.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="smallcaps text-[9px]">参 考 资 料 · RESOURCES</div>
                <div className="flex-1 h-px bg-ink-200/60 dark:bg-ink-700/40" />
                <span className="font-mono text-[10px] text-ink-fade">{task.resources.length} 条</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {task.resources.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => openExternalLink(r.url)}
                    className="text-left p-3 bg-ink-50/60 dark:bg-night-200/40
                      border border-ink-200 dark:border-ink-700/40
                      hover:border-seal-400 hover:bg-seal-50/40 dark:hover:bg-seal-700/10
                      transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="smallcaps text-[8px]">
                        {RESOURCE_TYPE_LABEL[r.resource_type] || r.resource_type}
                      </span>
                      <ExternalLink size={10} className="text-ink-fade group-hover:text-seal-500 flex-shrink-0" />
                    </div>
                    <div className="font-display text-sm font-semibold text-ink-700 dark:text-ink-100 line-clamp-2">
                      {r.title}
                    </div>
                    {r.snippet && (
                      <div className="font-display italic text-[11px] text-ink-fade mt-1 line-clamp-2 leading-relaxed">
                        {r.snippet}
                      </div>
                    )}
                    <div className="font-mono text-[9px] text-seal-500 mt-1.5 truncate">
                      {r.url}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="flex gap-3 pt-3 border-t border-dashed border-ink-200/60 dark:border-ink-700/40">
            <button
              onClick={() => window.location.assign(`/roadmap/${roadmapId}`)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3
                bg-seal-500 hover:bg-seal-400 text-ink-50
                transition-colors font-display text-sm border-2 border-seal-600"
            >
              <ArrowUpRight size={15} />
              <span>至 路 线 全 貌</span>
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-ink-300 dark:border-ink-600
                hover:border-seal-400 hover:text-seal-500 text-ink-600 dark:text-ink-200
                transition-colors font-display text-sm bg-transparent"
            >
              合 卷
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
