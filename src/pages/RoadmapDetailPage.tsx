import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Library,
  ChevronDown,
  Circle,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircleQuestion,
  Play,
  Star,
  Wand2,
  X,
} from 'lucide-react';
import { useRoadmapStore } from '../stores/useRoadmapStore';
import { useAiCompanionStore } from '../stores/useAiCompanionStore';
import { ResourceDrawer } from '../components/ai-loop';
import { openExternalLink } from '../utils/links';
import { roman } from '../components/manuscript/roman';
import type { OptimizeScope, Resource, Stage, Task } from '../types';

export default function RoadmapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentRoadmap,
    isLoading,
    fetchRoadmap,
    markTaskCompleted,
    optimizeRoadmap,
    retryStage,
  } = useRoadmapStore();

  const [resourceDrawer, setResourceDrawer] = useState<{
    mode: 'add' | 'edit';
    taskId: string;
    resource: Resource | null;
  } | null>(null);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };
  type FeedbackTarget = {
    scope: OptimizeScope;
    stageId: string | null;
    taskId: string | null;
    title: string;
    subject: string;
  };
  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackTarget | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  const openFeedback = (target: FeedbackTarget) => {
    setFeedbackTarget(target);
    setFeedbackText('');
    setOptimizeError(null);
  };
  const closeFeedback = () => {
    if (optimizing) return;
    setFeedbackTarget(null);
    setFeedbackText('');
    setOptimizeError(null);
  };
  const submitFeedback = async () => {
    if (!currentRoadmap || !feedbackTarget || !feedbackText.trim() || optimizing) return;
    setOptimizing(true);
    setOptimizeError(null);
    try {
      await optimizeRoadmap({
        roadmap_id: currentRoadmap.id,
        scope: feedbackTarget.scope,
        stage_id: feedbackTarget.stageId,
        task_id: feedbackTarget.taskId,
        feedback: feedbackText.trim(),
      });
      setFeedbackTarget(null);
      setFeedbackText('');
    } catch (error) {
      setOptimizeError(String(error));
    } finally {
      setOptimizing(false);
    }
  };

  useEffect(() => {
    if (id) fetchRoadmap(id);
  }, [id, fetchRoadmap]);

  const overview = useMemo(() => {
    if (!currentRoadmap) {
      return { stages: 0, tasks: 0, done: 0, pct: 0 };
    }
    let total = 0;
    let done = 0;
    currentRoadmap.stages.forEach((stage) => {
      stage.tasks.forEach((task) => {
        total += 1;
        if (task.is_completed) done += 1;
      });
    });
    return {
      stages: currentRoadmap.stages.length,
      tasks: total,
      done,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [currentRoadmap]);

  const firstIncomplete = useMemo(() => {
    if (!currentRoadmap) return null;
    for (const stage of currentRoadmap.stages) {
      for (const task of stage.tasks) {
        if (!task.is_completed) return { stageId: stage.id, taskId: task.id };
      }
    }
    return null;
  }, [currentRoadmap]);

  const handleTaskToggle = async (task: Task, completed: boolean) => {
    await markTaskCompleted(task.id, completed);
  };




  if (isLoading || !currentRoadmap) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="font-display italic text-ink-fade text-sm tracking-wider mb-3">墨 干 中</div>
          <div className="w-32 h-px bg-ink-200 dark:bg-ink-700 mx-auto overflow-hidden">
            <div className="h-full w-1/3 bg-seal-400 animate-flow" />
          </div>
        </div>
      </div>
    );
  }


  const renderTaskCard = (task: Task) => {
    const isCurrent = firstIncomplete?.taskId === task.id;
    const taskResourceCount = task.resources?.length || 0;
    const isExpanded = expandedTasks.has(task.id);
    const hasPoints = (task.points?.length || 0) > 0;
    const expandable = hasPoints || taskResourceCount > 0;
    return (
      <div
        className={`group relative border bg-paper/70 dark:bg-night-200/30 transition-colors
          ${isCurrent
            ? 'border-seal-400 bg-seal-50/50 dark:bg-seal-700/15 shadow-ink-1'
            : task.is_completed
              ? 'border-gilt-500/30 bg-gilt-500/5'
              : 'border-ink-200 dark:border-ink-700/40'}
        `}
      >
        <div className="px-2.5 py-2 flex items-start gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); handleTaskToggle(task, !task.is_completed); }}
            className="shrink-0 mt-0.5 transition-transform hover:scale-110"
            title={task.is_completed ? '标记为未完成' : '标记为已完成'}
          >
            {task.is_completed ? (
              <CheckCircle2 size={14} className="text-gilt-500" />
            ) : (
              <Circle size={14} className="text-ink-fade hover:text-seal-400" />
            )}
          </button>
          <button
            type="button"
            onClick={() => expandable && toggleTaskExpanded(task.id)}
            className={`flex-1 min-w-0 text-left ${expandable ? 'cursor-pointer' : 'cursor-default'}`}
            title={expandable ? (isExpanded ? '收起' : '点击查看核心知识点与学习资源') : task.title}
          >
            <div
              className={`font-display text-[12px] leading-snug
                ${task.is_completed
                  ? 'text-ink-fade line-through decoration-gilt-500/50'
                  : isCurrent
                    ? 'text-seal-600 dark:text-seal-200 font-medium'
                    : 'text-ink-700 dark:text-ink-100'}
                ${expandable && !isExpanded ? 'hover:text-seal-500 transition-colors' : ''}
              `}
            >
              {task.title}
            </div>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span className={`font-mono text-[8px] tracking-wider px-1 py-px
                ${task.task_type === 'project'
                  ? 'bg-seal-500/15 text-seal-500'
                  : task.task_type === 'video'
                    ? 'bg-gilt-500/15 text-gilt-600 dark:text-gilt-400'
                    : 'bg-ink-200/50 dark:bg-night-100/40 text-ink-soft dark:text-ink-fade'}`}>
                {task.task_type.toUpperCase()}
              </span>
              {isCurrent && (
                <span className="inline-flex items-center gap-0.5 px-1 py-px bg-seal-500 text-ink-50 text-[8px] font-display">
                  <MapPin size={8} />
                  当 前
                </span>
              )}
              {taskResourceCount > 0 && (
                <span className="inline-flex items-center gap-0.5 font-mono text-[8px] text-gilt-600 dark:text-gilt-400">
                  <BookOpen size={9} />
                  {taskResourceCount}
                </span>
              )}
              {expandable && (
                <span className={`ml-auto font-mono text-[8px] text-ink-fade transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  <ChevronDown size={10} />
                </span>
              )}
            </div>
          </button>
        </div>

        {isExpanded && expandable && (
          <div className="px-2.5 py-2 border-t border-ink-200/60 dark:border-ink-700/40 space-y-2 bg-white dark:bg-night-100/30">
            {hasPoints && (
              <ul className="space-y-1">
                {task.points!.slice(0, 4).map((point, pi) => (
                  <li key={pi} className="flex items-start gap-1.5 font-display text-[10px] text-ink-600 dark:text-ink-200 leading-snug">
                    <span className="mt-[5px] w-1 h-1 bg-seal-400 flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            )}
            {taskResourceCount > 0 && (
              <div className="space-y-1">
                <div className="smallcaps text-[8px] text-gilt-600 dark:text-gilt-400">学 习 资 料</div>
                <ul className="space-y-1">
                  {task.resources!.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => openExternalLink(r.url)}
                        className="w-full flex items-start gap-1.5 px-1.5 py-1 text-left
                          border border-ink-200/70 dark:border-ink-700/30 bg-white dark:bg-night-200/40
                          hover:border-seal-400/60 hover:bg-seal-50/30 transition-colors"
                        title={r.url}
                      >
                        <span className="w-4 h-4 flex items-center justify-center bg-gilt-500/10 text-gilt-500 flex-shrink-0 mt-0.5">
                          {r.resource_type === 'video' ? <Play size={8} /> : <ExternalLink size={8} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-display text-[11px] text-ink-800 dark:text-ink-100 truncate">
                            {r.title}
                          </span>
                          <span className="block font-mono text-[9px] text-ink-soft dark:text-ink-fade truncate">
                            {(() => { try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { return r.url; } })()}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderStageColumn = (stage: Stage) => {
    const isCurrentStage = firstIncomplete?.stageId === stage.id;
    const stageDone = stage.tasks.length > 0 && stage.tasks.every((t) => t.is_completed);
    const stageResourceCount = stage.tasks.reduce((sum, t) => sum + (t.resources?.length || 0), 0);
    return (
      <section
        key={stage.id}
        className={`snap-start flex-shrink-0 w-[210px] flex flex-col border
          ${isCurrentStage
            ? 'border-seal-400 shadow-ink-1'
            : stageDone
              ? 'border-gilt-500/40'
              : 'border-ink-200 dark:border-ink-700/40'}
          bg-paper/60 dark:bg-night-200/40`}
      >
        <header className="min-h-[112px] px-3 py-2.5 flex flex-col bg-gradient-to-br from-seal-500 to-seal-600 text-ink-50">
          <div className="flex items-center justify-between">
            <span className="font-display italic text-[11px] tracking-wider opacity-90">
              {roman(stage.order)}
            </span>
            <div className="flex items-center gap-2">
              {stage.is_fallback && (
                <span className="font-display italic text-[9px] opacity-90">待补</span>
              )}
              {stageDone && <CheckCircle2 size={12} className="text-ink-50" />}
            </div>
          </div>
          <h2
            className="mt-1 flex-1 font-display text-[13px] font-medium leading-tight line-clamp-2 opacity-95"
            title={stage.name}
          >
            {stage.name}
          </h2>
          <p
            className="mt-1 font-display italic text-[11px] opacity-95 leading-snug line-clamp-3 break-words flex-shrink-0"
            title={stage.objective}
          >
            {stage.objective}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-[9px] opacity-90 font-mono tracking-wider flex-shrink-0">
            <span>{stage.stage_type === 'project' ? 'PROJECT' : 'LEARNING'}</span>
            <span className="opacity-60">·</span>
            <span>{stage.tasks.length} 节</span>
            {stageResourceCount > 0 && (
              <>
                <span className="opacity-60">·</span>
                <button
                  onClick={() => setResourcesOpen(true)}
                  className="underline-offset-2 hover:underline"
                >
                  {stageResourceCount} 资料
                </button>
              </>
            )}
          </div>
        </header>

        <div className="px-3 py-2 border-b border-ink-200/60 dark:border-ink-700/40 flex items-center gap-1.5 bg-paper/40 dark:bg-night-100/40">
          <button
            onClick={() => useAiCompanionStore.getState().openCompanion({ stageId: stage.id, taskId: null })}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 font-display text-[10px]
              text-seal-500 hover:bg-seal-50 dark:hover:bg-seal-700/15 transition-colors"
            title="问 AI"
          >
            <MessageCircleQuestion size={10} />
            问 AI
          </button>
          <button
            onClick={() => openFeedback({
              scope: 'stage',
              stageId: stage.id,
              taskId: null,
              title: `第 ${roman(stage.order)} 章 · ${stage.name}`,
              subject: `阶段「${stage.name}」`,
            })}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 font-display text-[10px]
              text-seal-500 hover:bg-seal-50 dark:hover:bg-seal-700/15 transition-colors"
            title="评价"
          >
            <Star size={10} />
            评 价
          </button>
          {stage.is_fallback && (
            <button
              onClick={async () => {
                await retryStage(stage.id);
                if (currentRoadmap) fetchRoadmap(currentRoadmap.id);
              }}
              className="inline-flex items-center justify-center px-2 py-1 bg-seal-500 hover:bg-seal-400 text-ink-50
                font-display text-[10px] transition-colors"
              title="重研此章"
            >
              <Play size={10} />
            </button>
          )}
        </div>

        {stage.prerequisites && stage.prerequisites.length > 0 && (
          <p className="px-3 py-1.5 font-display italic text-[10px] text-ink-fade border-b border-ink-200/40 dark:border-ink-700/30 truncate">
            <span className="smallcaps text-[8px] text-gilt-500 mr-1">前 置</span>
            {stage.prerequisites.join(' → ')}
          </p>
        )}

        <div className="flex-1 px-2 py-2 space-y-1.5 min-h-[60px]">
          {stage.tasks.map((task) => renderTaskCard(task))}
        </div>
      </section>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ====== 头部 ====== */}
      <header className="flex-shrink-0 px-12 pt-7 pb-5 border-b border-ink-200 dark:border-ink-700/40
        bg-gradient-to-b from-ink-50 to-transparent dark:from-night-100 dark:to-transparent">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-ink-fade hover:text-seal-500 mb-4
            font-display italic text-sm transition-colors group"
        >
          <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-1" />
          <span>返 · 目录</span>
        </button>

        <div className="flex items-start justify-between gap-8">
          <div className="flex-1 min-w-0 animate-ink-spread">
            <div className="smallcaps mb-2 flex items-center gap-3">
              <span>在 读 册</span>
              <span className="text-gilt-500">✦</span>
              <span className="font-mono normal-case tracking-normal text-ink-fade text-[10px]">
                {overview.stages} 章 · {overview.tasks} 节
              </span>
            </div>
            <h1 className="font-display text-[42px] leading-[1.05] font-semibold text-ink-700 dark:text-ink-100 tracking-tight mb-3">
{currentRoadmap.title}
              <span
                className="ml-3 inline-flex items-center gap-1 align-middle font-display italic text-[12px] text-gilt-600 dark:text-gilt-400/80 select-none"
                aria-hidden
              >
                <Library size={12} />
                点 击 查 看 学 习 资 料
              </span>
            </h1>
            <p className="font-display italic text-base text-ink-fade dark:text-ink-soft max-w-2xl leading-relaxed">
              {currentRoadmap.description}
            </p>
          </div>

          <div className="flex items-start gap-5 flex-shrink-0 animate-ink-spread" style={{ animationDelay: '120ms' }}>
            <div className="space-y-2.5 text-right">
              {[
                { label: '进 度', value: `${overview.pct}%` },
                { label: '已 竟', value: `${overview.done}/${overview.tasks}` },
                { label: '时 长', value: `${currentRoadmap.estimated_total_hours}h` },
              ].map((m) => (
                <div key={m.label} className="flex items-baseline justify-end gap-3">
                  <span className="smallcaps text-[9px]">{m.label}</span>
                  <span className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100 tabular-nums">
                    {m.value}
                  </span>
                </div>
              ))}
              <button
                onClick={() => openFeedback({
                  scope: 'roadmap',
                  stageId: null,
                  taskId: null,
                  title: '整体路线',
                  subject: '整条学习路线',
                })}
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 font-display text-xs
                  text-seal-500 hover:bg-seal-50 dark:hover:bg-seal-700/15 transition-colors
                  border border-seal-400/50 hover:border-seal-400"
              >
                <Star size={12} />
                评 价 整 体 路 线
              </button>
            </div>
          </div>
        </div>
        <div className="rule-gilt mt-5 max-w-3xl" />
      </header>

      {/* ====== 路线主体 ====== */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1280px] mx-auto px-12 py-10">
          {currentRoadmap.stages.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-display italic text-sm text-ink-fade">此 卷 尚 无 章 节</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2 snap-x snap-mandatory">
              {currentRoadmap.stages.map(renderStageColumn)}
            </div>
          )}


        </div>
      </div>

      {resourceDrawer && (
        <ResourceDrawer
          isOpen={!!resourceDrawer}
          onClose={() => {
            setResourceDrawer(null);
            if (currentRoadmap) fetchRoadmap(currentRoadmap.id);
          }}
          mode={resourceDrawer.mode}
          taskId={resourceDrawer.taskId}
          resource={resourceDrawer.resource}
        />
      )}

      {resourcesOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-900/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setResourcesOpen(false)}
        >
          <aside
            className="absolute right-0 top-0 bottom-0 w-full max-w-md
              bg-white dark:bg-night-100 shadow-ink-3 flex flex-col animate-ink-spread"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-ink-200 dark:border-ink-700/40">
              <div>
                <div className="smallcaps text-[9px] text-gilt-600 dark:text-gilt-400">学 习 资 料</div>
                <h3 className="font-display text-xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight">
                  全部资源
                </h3>
              </div>
              <button
                onClick={() => setResourcesOpen(false)}
                className="p-1.5 text-ink-fade hover:text-seal-500 transition-colors"
                title="关闭"
              >
                <X size={16} />
              </button>
            </header>

            <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
              {currentRoadmap.stages.map((stage) => {
                const allResources = stage.tasks.flatMap((t) =>
                  (t.resources || []).map((r) => ({ ...r, _taskTitle: t.title, _taskId: t.id }))
                );
                if (allResources.length === 0) return null;
                return (
                  <section key={stage.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="smallcaps text-[9px] text-seal-500">第 {roman(stage.order)} 章</span>
                      <span className="font-display text-sm font-semibold text-ink-700 dark:text-ink-100 truncate">
                        {stage.name}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-ink-700 dark:text-ink-200">{allResources.length} 条</span>
                    </div>
                    <ul className="space-y-1.5">
                      {allResources.map((r) => (
                        <li key={r.id}>
                          <button
                            onClick={() => openExternalLink(r.url)}
                            className="w-full flex items-start gap-2 px-3 py-2 text-left
                              border border-ink-200 dark:border-ink-700/40 bg-white dark:bg-night-200/30
                              hover:border-seal-400 hover:bg-seal-50/30 dark:hover:bg-seal-700/10 transition-colors"
                          >
                            <span className="w-6 h-6 flex items-center justify-center bg-gilt-500/10 text-gilt-500 flex-shrink-0 mt-0.5">
                              {r.resource_type === 'video' ? <Play size={10} /> : <ExternalLink size={10} />}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block font-display text-[13px] text-ink-800 dark:text-ink-100 truncate">
                                {r.title}
                              </span>
                              <span className="block font-mono text-[10px] text-ink-700 dark:text-ink-200 truncate mt-0.5">
                                {(() => { try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { return r.url; } })()}
                                {' · '}
                                {r._taskTitle}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      {feedbackTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
          onClick={closeFeedback}
        >
          <div
            className="w-full max-w-md manuscript-card p-7 animate-ink-spread"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <div className="smallcaps text-[9px] text-gilt-500 mb-1">修 卷 · AI 局 部 优 化</div>
                <h3 className="font-display text-xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight">
                  {feedbackTarget.title}
                </h3>
              </div>
              <button
                onClick={closeFeedback}
                disabled={optimizing}
                className="p-1 text-ink-fade hover:text-seal-500 transition-colors disabled:opacity-30"
                title="关闭"
              >
                <X size={16} />
              </button>
            </div>

            <p className="font-display italic text-xs text-ink-fade mb-4 leading-relaxed">
              针对{feedbackTarget.subject}写下具体反馈,AI 会重绘对应部分,并尽量保留你已完成的进度。
            </p>

            <textarea
              value={feedbackText}
              onChange={(e) => {
                setFeedbackText(e.target.value);
                setOptimizeError(null);
              }}
              rows={5}
              autoFocus
              placeholder={feedbackTarget.scope === 'task'
                ? '例如:这个任务的要点太抽象、希望补一段示例…'
                : feedbackTarget.scope === 'stage'
                  ? '例如:这一章的节奏太赶、希望拆成两章…'
                  : '例如:整体路线偏理论、希望加 1 个实践项目章…'}
              className="w-full px-4 py-3 bg-paper-fold dark:bg-night-300 border-b-2 border-ink-300 dark:border-ink-600
                focus:border-seal-400 outline-none resize-y font-display text-sm text-ink-700 dark:text-ink-100
                placeholder:text-ink-600 placeholder:dark:text-ink-soft placeholder:font-display placeholder:italic"
            />

            {optimizeError && (
              <p className="mt-3 font-display italic text-xs text-seal-500 leading-relaxed break-all">{optimizeError}</p>
            )}

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={closeFeedback}
                disabled={optimizing}
                className="px-4 py-2.5 font-display text-sm text-ink-fade hover:text-seal-500 transition-colors
                  border border-ink-200 dark:border-ink-700/40 disabled:opacity-30"
              >
                取 消
              </button>
              <button
                onClick={submitFeedback}
                disabled={!feedbackText.trim() || optimizing}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5
                  bg-seal-500 hover:bg-seal-400 text-ink-50
                  transition-colors font-display text-sm border-2 border-seal-600
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {optimizing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                <span>{optimizing ? 'AI 重 绘 中…' : '提 交 优 化'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
