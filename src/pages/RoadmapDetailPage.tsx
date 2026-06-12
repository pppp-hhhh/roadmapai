import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Circle, ExternalLink,
  HelpCircle, X, Play,
  ChevronDown, ChevronRight, AlertTriangle, Plus, MessageCircle, Star,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { lowlight, sanitizeMarkdown } from '../utils/markdown';
import { useRoadmapStore } from '../stores/useRoadmapStore';
import QuizModal from '../components/QuizModal';
import { openExternalLink } from '../utils/links';
import type { Stage, Resource, Task } from '../types';
import { TaskToTutorDrawer, ResourceDrawer } from '../components/ai-loop';
import { useFavoriteStore } from '../stores/useFavoriteStore';
import { roman } from '../components/manuscript/roman';

const taskTypeGlyph: Record<string, string> = {
  reading: '§', video: '▶', exercise: '✎', project: '✦', quiz: '?',
};

export default function RoadmapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRoadmap, isLoading, fetchRoadmap, markTaskCompleted, submitQuiz, deleteResource, retryStage } = useRoadmapStore();
  const { addFavorite, removeFavorite, isFavorited, favorites } = useFavoriteStore();
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [showStageModal, setShowStageModal] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [quizStage, setQuizStage] = useState<Stage | null>(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [resourceDrawer, setResourceDrawer] = useState<{
    mode: 'add' | 'edit';
    taskId: string;
    resource: Resource | null;
  } | null>(null);
  const [tutorTask, setTutorTask] = useState<Task | null>(null);

  useEffect(() => { if (id) fetchRoadmap(id); }, [id, fetchRoadmap]);

  const handleStageClick = (stage: Stage) => {
    if (stage.isLocked) return;
    setSelectedStage(stage); setShowStageModal(true); setExpandedTasks(new Set());
  };

  const toggleExpandTask = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  const handleTaskToggle = async (taskId: string, completed: boolean) => {
    await markTaskCompleted(taskId, completed);
    if (selectedStage && showStageModal) {
      setSelectedStage(prev => {
        if (!prev) return null;
        return { ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, is_completed: completed } : t) };
      });
    }
  };

  const handleStartQuiz = (stage: Stage) => { setShowStageModal(false); setQuizStage(stage); setShowQuizModal(true); };
  const handleQuizSubmit = async (answers: number[]) => {
    if (!quizStage) return { passed: false, score: 0, correctCount: 0, totalQuestions: 0, feedback: [] };
    const result = await submitQuiz(quizStage.id, answers);
    if (result.passed && currentRoadmap) fetchRoadmap(currentRoadmap.id);
    return result;
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!confirm('确定删除此资源?')) return;
    await deleteResource(resourceId);
    if (currentRoadmap) fetchRoadmap(currentRoadmap.id);
  };

  const getCompletedTaskCount = (stage: Stage) => stage.tasks.filter(t => t.is_completed).length;
  const getStageProgress = (stage: Stage) => stage.tasks.length === 0 ? 0 : Math.round((getCompletedTaskCount(stage) / stage.tasks.length) * 100);
  const canTakeQuiz = (stage: Stage) => {
    if (stage.isLocked || stage.stageType === 'quiz') return false;
    return stage.tasks.length > 0 && getCompletedTaskCount(stage) === stage.tasks.length;
  };

  const overview = useMemo(() => {
    if (!currentRoadmap) return { total: 0, done: 0, pct: 0, chapters: 0 };
    let total = 0, done = 0;
    currentRoadmap.stages.forEach(s => {
      if (s.stageType !== 'quiz') s.tasks.forEach(t => { total++; if (t.is_completed) done++; });
    });
    return {
      total, done,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
      chapters: currentRoadmap.stages.length,
    };
  }, [currentRoadmap]);

  const renderResourceCard = (r: Resource) => {
    const favorited = isFavorited('resource', r.id);
    return (
      <div key={r.id} className="shrink-0 w-60 manuscript-card p-3 group relative bg-ink-50/70 dark:bg-night-200/60">
        <div className="flex items-center justify-between mb-1.5">
          <div className="smallcaps text-[8px]">
            {r.resource_type === 'video' ? '影 · 視頻' :
             r.resource_type === 'course' ? '課 · 課程' :
             r.resource_type === 'article' ? '文 · 文章' : '典 · 文檔'}
          </div>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (favorited) {
                  const f = favorites.find((x) => x.type === 'resource' && x.ref_id === r.id);
                  if (f) removeFavorite(f.id);
                } else {
                  addFavorite({
                    type: 'resource',
                    ref_id: r.id,
                    roadmap_id: currentRoadmap?.id ?? null,
                    title: r.title,
                    preview: r.snippet ?? null,
                  });
                }
              }}
              className="p-0.5 hover:bg-gilt-500/20 text-ink-fade hover:text-gilt-500"
              title={favorited ? '取消收藏' : '收藏'}
            >
              <Star size={11} className={favorited ? 'fill-gilt-500 text-gilt-500' : ''} />
            </button>
            <button
              onClick={(evt) => {
                evt.stopPropagation();
                setResourceDrawer({ mode: 'edit', taskId: '', resource: r });
              }}
              className="p-0.5 hover:bg-ink-200 dark:hover:bg-ink-700 text-ink-fade"
              title="编辑"
            >
              <Plus size={11} className="rotate-45" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteResource(r.id); }}
              className="p-0.5 hover:bg-seal-50 text-ink-fade hover:text-seal-500"
              title="删除"
            >
              ×
            </button>
          </div>
        </div>
        <button onClick={() => openExternalLink(r.url)} className="w-full text-left">
          <div className="font-display text-[13px] font-semibold text-ink-700 dark:text-ink-100 mb-1 line-clamp-2 hover:text-seal-500 transition-colors leading-snug">
            {r.title}
          </div>
          {r.snippet && <div className="font-display italic text-[11px] text-ink-fade line-clamp-1">{r.snippet}</div>}
          <div className="flex items-center gap-1 mt-2 font-mono text-[9px] smallcaps text-seal-500">
            <ExternalLink size={10} />
            <span>展 卷</span>
          </div>
        </button>
      </div>
    );
  };

  const renderAddResourceButton = (taskId: string) => (
    <div className="shrink-0 w-60">
      <button
        onClick={() => setResourceDrawer({ mode: 'add', taskId, resource: null })}
        className="w-full h-full min-h-[88px] flex flex-col items-center justify-center gap-1
          border border-dashed border-ink-300 dark:border-ink-700/60
          hover:border-seal-400 transition-colors text-ink-fade hover:text-seal-500"
      >
        <Plus size={18} />
        <span className="smallcaps text-[8px]">添 资 料</span>
      </button>
    </div>
  );

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

  const radius = 46, circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overview.pct / 100) * circumference;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ====== 头部 ====== */}
      <header className="flex-shrink-0 relative">
        <div className="px-12 pt-7 pb-5 border-b border-ink-200 dark:border-ink-700/40
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
                  {currentRoadmap.stages.length} 章
                </span>
              </div>
              <h1 className="font-display text-[42px] leading-[1.05] font-semibold text-ink-700 dark:text-ink-100 tracking-tight mb-3">
                {currentRoadmap.title}
              </h1>
              <p className="font-display italic text-base text-ink-fade dark:text-ink-soft max-w-2xl leading-relaxed">
                {currentRoadmap.description}
              </p>
            </div>

            <div className="flex items-center gap-6 flex-shrink-0 animate-ink-spread" style={{ animationDelay: '120ms' }}>
              <div className="flex flex-col items-center">
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--rule)" strokeWidth="1.5" />
                    <circle cx="50" cy="50" r={radius}
                      fill="none" stroke="var(--seal)" strokeWidth="2" strokeLinecap="round"
                      style={{ strokeDasharray: circumference, strokeDashoffset, transition: 'stroke-dashoffset 0.8s' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-3xl font-semibold text-seal-500 tabular-nums">
                      {overview.pct}<tspan fontSize="14" className="text-ink-fade">%</tspan>
                    </span>
                    <span className="smallcaps text-[8px] mt-0.5">已 通 关</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3 border-l border-ink-200 dark:border-ink-700/40 pl-6">
                {[
                  { l: '章',    v: overview.chapters },
                  { l: '节',    v: overview.total },
                  { l: '已竟',  v: overview.done },
                ].map((m) => (
                  <div key={m.l} className="flex items-baseline gap-3">
                    <span className="smallcaps w-10 text-[9px]">{m.l}</span>
                    <span className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100 tabular-nums">
                      {m.v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="rule-gilt mt-5 max-w-3xl" />
        </div>
      </header>

      {/* ====== 章回目录 ====== */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[860px] mx-auto px-12 py-10">
          <div className="smallcaps mb-6 flex items-center gap-3">
            <span>章 回</span>
            <span className="font-display normal-case tracking-normal text-ink-fade italic text-xs">— Chapters —</span>
          </div>

          <div className="relative">
            <div className="ink-thread absolute left-[19px] top-2 bottom-2" aria-hidden />

            <div className="space-y-7">
              {currentRoadmap.stages.map((stage) => {
                const stageProgress = getStageProgress(stage);
                const isComplete = stageProgress === 100 && stage.tasks.length > 0;
                const stageTasks = stage.tasks.length;

                return (
                  <article key={stage.id} className="relative pl-14">
                    <button
                      onClick={() => handleStageClick(stage)}
                      disabled={stage.isLocked}
                      aria-label={stage.name}
                      className={`absolute left-0 top-1.5 w-10 h-10 flex items-center justify-center transition-all z-10
                        ${stage.isLocked ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-110'}`}
                    >
                      {stage.isLocked ? (
                        <div className="wax-seal" aria-hidden />
                      ) : stage.isFallback ? (
                        <div className="w-9 h-9 border-2 border-dashed border-seal-400 bg-seal-50 dark:bg-seal-700/20 flex items-center justify-center">
                          <AlertTriangle size={16} className="text-seal-500" />
                        </div>
                      ) : stage.stageType === 'quiz' ? (
                        <div className="w-9 h-9 rounded-full bg-gilt-500/15 border border-gilt-500 flex items-center justify-center text-gilt-500">
                          <HelpCircle size={17} />
                        </div>
                      ) : isComplete ? (
                        <div className="w-9 h-9 rounded-full border-2 border-gilt-500 bg-gilt-500/10 flex items-center justify-center">
                          <CheckCircle2 size={17} className="text-gilt-500" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-full border-2 border-seal-400 bg-paper flex items-center justify-center">
                          <span className="font-display italic text-base text-seal-500 font-semibold">
                            {roman(stage.order)}
                          </span>
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => handleStageClick(stage)}
                      disabled={stage.isLocked}
                      className={`w-full text-left transition-all duration-300
                        ${stage.isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'}`}
                    >
                      <div className="flex items-baseline gap-3 mb-2">
                        <span className="smallcaps">第 {roman(stage.order)} 章</span>
                        <span className="text-gilt-500">·</span>
                        {stage.isFallback ? (
                          <span className="font-display italic text-xs text-seal-500">待补</span>
                        ) : (
                          <span className={`font-mono text-[10px] tracking-wider
                            ${stage.stageType === 'quiz' ? 'text-gilt-500' :
                              stage.stageType === 'project' ? 'text-seal-500' : 'text-ink-fade'}`}>
                            {stage.stageType === 'learning' ? 'LEARNING' :
                             stage.stageType === 'quiz' ? 'QUIZ' : 'PROJECT'}
                          </span>
                        )}
                        <span className="ml-auto font-mono text-[10px] text-ink-fade tabular-nums">
                          {stage.estimated_hours}h · {stageTasks} 节
                        </span>
                      </div>

                      <h2 className={`font-display text-[26px] font-semibold leading-tight tracking-tight mb-2 transition-colors
                        ${stage.isLocked ? 'text-ink-fade' :
                          isComplete ? 'text-gilt-500' :
                          'text-ink-700 dark:text-ink-100 group-hover:text-seal-500'}`}>
                        {stage.name}
                      </h2>
                      <p className="font-display italic text-[15px] text-ink-fade dark:text-ink-soft leading-relaxed line-clamp-2 max-w-2xl">
                        {stage.objective}
                      </p>

                      {stageTasks > 0 && !stage.isLocked && stage.stageType !== 'quiz' && (
                        <div className="mt-3 flex items-center gap-3 max-w-md">
                          <div className="flex-1 h-px bg-ink-200 dark:bg-ink-700/50 relative">
                            <div
                              className={`absolute inset-y-0 left-0 transition-all duration-500
                                ${isComplete ? 'bg-gilt-500' : 'bg-seal-400'}`}
                              style={{ width: `${stageProgress}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-ink-fade tabular-nums w-12 text-right">
                            {stageProgress}%
                          </span>
                        </div>
                      )}
                    </button>
                  </article>
                );
              })}
            </div>

            <div className="relative pl-14 mt-10">
              <div className="absolute left-0 top-1.5 w-10 h-10 flex items-center justify-center text-gilt-500">
                <div className="font-display text-xl">❦</div>
              </div>
              <p className="font-display italic text-ink-fade text-sm">— 终 · 完卷之日,方见月明 —</p>
            </div>
          </div>
        </div>
      </div>

      {/* ====== 章节详情 Modal ====== */}
      {showStageModal && selectedStage && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4">
          <div
            className="fixed inset-0 bg-ink-900/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => setShowStageModal(false)}
          />
          <div className="relative manuscript-card w-full max-w-3xl max-h-[88vh] overflow-auto z-10 animate-ink-spread">
            <div className="sticky top-0 z-10 bg-ink-50/95 dark:bg-night-100/95 backdrop-blur
              border-b border-ink-200 dark:border-ink-700/40 px-8 py-5">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="smallcaps">第 {roman(selectedStage.order)} 章</span>
                <span className="text-gilt-500">·</span>
                <span className={`font-mono text-[10px] tracking-wider
                  ${selectedStage.stageType === 'quiz' ? 'text-gilt-500' :
                    selectedStage.stageType === 'project' ? 'text-seal-500' : 'text-ink-fade'}`}>
                  {selectedStage.stageType === 'learning' ? 'LEARNING' :
                   selectedStage.stageType === 'quiz' ? 'QUIZ' : 'PROJECT'}
                </span>
                <span className="ml-auto font-mono text-[10px] text-ink-fade">
                  {selectedStage.estimated_hours}h
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-display text-3xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-tight">
                  {selectedStage.name}
                </h2>
                <button
                  onClick={() => setShowStageModal(false)}
                  className="p-1.5 text-ink-fade hover:text-seal-500 transition-colors flex-shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-7">
              {selectedStage.isFallback && (
                <div className="border-l-3 border-seal-400 pl-4 py-3 bg-seal-50/40 dark:bg-seal-700/10">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-seal-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-display italic text-sm font-semibold text-seal-500 mb-1">
                        AI 暂 未 着 墨
                      </div>
                      <div className="font-display text-xs text-ink-fade leading-relaxed">
                        此章尚为占位,墨痕未干。你可以重新生成,或依下述目标自补笔记。
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await retryStage(selectedStage.id);
                      if (currentRoadmap) fetchRoadmap(currentRoadmap.id);
                    }}
                    className="mt-3 ml-7 px-4 py-1.5 bg-seal-500 hover:bg-seal-400 text-ink-50
                      font-display text-xs flex items-center gap-2 transition-colors"
                  >
                    <Play size={12} />重 研 此 章
                  </button>
                </div>
              )}

              <div>
                <div className="smallcaps mb-2">章 旨</div>
                <p className="font-display text-[15px] text-ink-700 dark:text-ink-100 leading-relaxed">
                  {selectedStage.objective}
                </p>
                {(selectedStage.stageType === 'learning' || selectedStage.stageType === 'project') && selectedStage.tasks.length > 0 && (
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1 h-px bg-ink-200 dark:bg-ink-700/50 relative">
                      <div className="absolute inset-y-0 left-0 bg-seal-400 transition-all duration-500"
                        style={{ width: `${getStageProgress(selectedStage)}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-ink-fade tabular-nums w-20 text-right">
                      {getCompletedTaskCount(selectedStage)}/{selectedStage.tasks.length} · {getStageProgress(selectedStage)}%
                    </span>
                  </div>
                )}
              </div>

              {selectedStage.tasks.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="smallcaps">本 章 节 录</div>
                    <span className="font-mono text-[10px] text-ink-fade">
                      {selectedStage.tasks.length} entries
                    </span>
                    <div className="flex-1 h-px bg-ink-200/60 dark:bg-ink-700/40" />
                  </div>

                  <div className="space-y-2">
                    {selectedStage.tasks.map((task, ti) => {
                      const isExpanded = expandedTasks.has(task.id);
                      return (
                        <div key={task.id}
                          className={`border transition-colors
                            ${task.is_completed
                              ? 'border-gilt-500/30 bg-gilt-500/5'
                              : 'border-ink-200 dark:border-ink-700/40 hover:border-seal-400/60'
                            }`}>
                          <div className="px-4 py-3 flex items-center gap-3">
                            <span className="font-display italic text-xs text-ink-fade w-6 tabular-nums">
                              {String(ti + 1).padStart(2, '0')}.
                            </span>
                            <button
                              onClick={() => handleTaskToggle(task.id, !task.is_completed)}
                              className="shrink-0 transition-transform hover:scale-110"
                            >
                              {task.is_completed
                                ? <CheckCircle2 size={19} className="text-gilt-500" />
                                : <Circle size={19} className="text-ink-fade hover:text-seal-400" />}
                            </button>
                            <span className={`font-mono text-xs w-5 text-center
                              ${task.is_completed ? 'text-gilt-500' : 'text-seal-400'}`}>
                              {taskTypeGlyph[task.task_type] || '·'}
                            </span>
                            <button
                              onClick={() => toggleExpandTask(task.id)}
                              className="flex-1 text-left"
                            >
                              <div className={`font-display text-[15px] font-medium tracking-tight
                                ${task.is_completed ? 'text-ink-fade line-through decoration-gilt-500/50' : 'text-ink-700 dark:text-ink-100'}`}>
                                {task.title}
                              </div>
                            </button>
                            <button
                              onClick={() => toggleExpandTask(task.id)}
                              className="p-1 text-ink-fade hover:text-seal-500 transition-colors"
                            >
                              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-ink-200/60 dark:border-ink-700/30 px-6 py-5 space-y-5 bg-ink-50/30 dark:bg-night-200/30">
                              {task.content?.trim() ? (
                                <>
                                  <div className="markdown-content text-sm">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      rehypePlugins={[[rehypeHighlight, { lowlight }]]}
                                    >
                                      {sanitizeMarkdown(task.content)}
                                    </ReactMarkdown>
                                  </div>
                                  {task.code_example && (
                                    <pre className="bg-ink-700 text-ink-100 p-4 overflow-x-auto text-sm font-mono
                                      border-l-2 border-gilt-500">
                                      <code>{task.code_example}</code>
                                    </pre>
                                  )}
                                  {task.exercise && (
                                    <div className="border border-seal-400/40 bg-seal-50/40 dark:bg-seal-700/10 p-4">
                                      <div className="smallcaps text-seal-500 mb-2">习 · EXERCISE</div>
                                      <div className="markdown-content text-sm">
                                        <ReactMarkdown
                                          remarkPlugins={[remarkGfm]}
                                          rehypePlugins={[[rehypeHighlight, { lowlight }]]}
                                        >
                                          {sanitizeMarkdown(task.exercise)}
                                        </ReactMarkdown>
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="border-l-2 border-seal-400 pl-4 py-2">
                                  <div className="flex items-center gap-2 text-seal-500 font-display italic text-sm font-semibold mb-1">
                                    <AlertTriangle size={14} />
                                    墨痕未干
                                  </div>
                                  <p className="font-display italic text-xs text-ink-fade leading-relaxed">
                                    AI 暂未为此节着墨。可循题自补,或于 AI 导师处求教。
                                  </p>
                                </div>
                              )}

                              <div className="flex items-center gap-1 pt-3 border-t border-ink-200/60 dark:border-ink-700/30">
                                <button
                                  onClick={() => setTutorTask(task)}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 font-display text-xs
                                    text-seal-500 hover:bg-seal-50 dark:hover:bg-seal-700/15 transition-colors"
                                >
                                  <MessageCircle size={13} />
                                  就 此 节 质 疑
                                </button>
                                <button
                                  onClick={async () => {
                                    if (isFavorited('task', task.id)) {
                                      const f = favorites.find((x) => x.type === 'task' && x.ref_id === task.id);
                                      if (f) await removeFavorite(f.id);
                                    } else {
                                      await addFavorite({
                                        type: 'task',
                                        ref_id: task.id,
                                        roadmap_id: currentRoadmap?.id ?? null,
                                        title: task.title,
                                        preview: task.content.slice(0, 200),
                                      });
                                    }
                                  }}
                                  className={`flex items-center gap-1.5 px-2.5 py-1.5 font-display text-xs transition-colors
                                    ${isFavorited('task', task.id)
                                      ? 'text-gilt-500 bg-gilt-500/10'
                                      : 'text-ink-fade hover:bg-ink-100 dark:hover:bg-night-300/50'
                                    }`}
                                >
                                  <Star
                                    size={13}
                                    className={isFavorited('task', task.id) ? 'fill-gilt-500' : ''}
                                  />
                                  {isFavorited('task', task.id) ? '已 收 录' : '收 录'}
                                </button>
                              </div>

                              <div>
                                <div className="smallcaps mb-2.5 text-[9px]">参 考 资 料 · RESOURCES</div>
                                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                                  {task.resources.map(renderResourceCard)}
                                  {renderAddResourceButton(task.id)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {canTakeQuiz(selectedStage) && (
                <button
                  onClick={() => handleStartQuiz(selectedStage)}
                  className="w-full py-3.5 bg-gilt-500 hover:bg-gilt-600 text-ink-50
                    font-display text-sm flex items-center justify-center gap-2 transition-colors
                    border-2 border-gilt-600"
                >
                  <Play size={15} />
                  <span>参 加 攻 关 测 验</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <QuizModal stage={quizStage as Stage} isOpen={showQuizModal} onClose={() => { setShowQuizModal(false); setQuizStage(null); }} onSubmit={handleQuizSubmit} />

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

      <TaskToTutorDrawer
        isOpen={!!tutorTask}
        onClose={() => setTutorTask(null)}
        task={tutorTask}
      />
    </div>
  );
}
