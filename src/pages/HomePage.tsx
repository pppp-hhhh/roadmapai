import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, BookOpen, Clock } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useRoadmapStore } from '../stores/useRoadmapStore';
import type { Stage } from '../types';
import { roman } from '../components/manuscript/roman';

interface RoadmapWithStages {
  id: string;
  title: string;
  description: string;
  estimated_total_hours: number;
  stages: Stage[];
}

export default function HomePage() {
  const navigate = useNavigate();
  const { roadmaps, isLoading, fetchRoadmaps, deleteRoadmap } = useRoadmapStore();
  const [taskCounts, setTaskCounts] = useState<Record<string, { total: number; completed: number; nextStage?: string }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRoadmaps = roadmaps.filter(r =>
    !searchQuery || r.title.includes(searchQuery) || r.description.includes(searchQuery)
  );

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deletingId === id) {
      await deleteRoadmap(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
    }
  };

  useEffect(() => { fetchRoadmaps(); }, [fetchRoadmaps]);

  useEffect(() => {
    const fetchCounts = async () => {
      const counts: Record<string, { total: number; completed: number; nextStage?: string }> = {};
      for (const roadmap of roadmaps) {
        try {
          const roadmapData = await invoke<RoadmapWithStages>('get_roadmap', { id: roadmap.id });
          let total = 0, completed = 0;
          roadmapData?.stages?.forEach((stage) => {
            stage.tasks?.forEach((task) => { total++; if (task.is_completed) completed++; });
          });
          const nextStage = roadmapData?.stages?.find(s => !s.isLocked)?.name;
          counts[roadmap.id] = { total, completed, nextStage };
        } catch {
          counts[roadmap.id] = { total: 0, completed: 0, nextStage: undefined };
        }
      }
      setTaskCounts(counts);
    };
    if (roadmaps.length > 0) fetchCounts();
  }, [roadmaps]);

  // 概览统计
  const totalHours = roadmaps.reduce((s, r) => s + (r.estimated_total_hours || 0), 0);
  const completedTasks = Object.values(taskCounts).reduce((s, c) => s + c.completed, 0);
  const totalTasks = Object.values(taskCounts).reduce((s, c) => s + c.total, 0);
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  if (isLoading && roadmaps.length === 0) {
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

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-[1100px] mx-auto px-12 py-10 relative">
        <div aria-hidden className="absolute top-6 right-12 font-display text-gilt-500 text-xs select-none">❦</div>

        {/* ====== 标题区 — 像书脊 ====== */}
        <header className="mb-10 animate-ink-spread">
          <div className="smallcaps mb-3">第 一 章 · 卷 首</div>
          <h1 className="font-display text-[56px] leading-[1.05] font-semibold text-ink-700 dark:text-ink-100 tracking-tight">
            我的<span className="italic font-normal text-seal-500">学习</span>路线
          </h1>
          <p className="font-display italic text-base text-ink-fade dark:text-ink-soft mt-3 max-w-xl">
            追踪你正在研习的篇章,检视已攻克的关隘,与那尚未读到的远方。
          </p>
          <div className="rule-gilt mt-6 max-w-md" />
        </header>

        {/* ====== 统计三联 ====== */}
        {roadmaps.length > 0 && (
          <section className="grid grid-cols-3 gap-px bg-ink-200 dark:bg-ink-700/40 border border-ink-200 dark:border-ink-700/40 mb-10">
            {[
              { roman: 'I',  label: '册 数',   value: roadmaps.length.toString().padStart(2, '0'), unit: '册' },
              { roman: 'II', label: '总 时 数', value: totalHours.toString(),                       unit: '小时' },
              { roman: 'III',label: '总 进 度', value: `${overallProgress}`,                        unit: '%' },
            ].map((s) => (
              <div key={s.roman} className="bg-ink-50 dark:bg-night-100 px-6 py-5 relative">
                <div className="absolute top-3 right-3 font-display italic text-2xl text-ink-200 dark:text-ink-700/60 select-none">
                  {roman(parseInt(s.roman))}
                </div>
                <div className="smallcaps mb-2">{s.label}</div>
                <div className="font-display text-3xl font-semibold text-ink-700 dark:text-ink-100 tabular-nums">
                  {s.value}<span className="text-base font-normal text-ink-fade ml-1">{s.unit}</span>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ====== 工具栏 ====== */}
        <div className="flex items-center justify-between mb-6">
          <div className="smallcaps flex items-center gap-3">
            <span>目 录</span>
            <span className="font-display normal-case tracking-normal text-ink-fade italic">
              — Catalogue —
            </span>
          </div>
          <div className="flex items-center gap-3">
            {roadmaps.length > 3 && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-fade" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="检索 册名…"
                  className="pl-8 pr-3 py-1.5 bg-transparent border-b border-ink-300 dark:border-ink-600
                    focus:border-seal-400 outline-none font-display italic text-sm
                    text-ink-700 dark:text-ink-100 placeholder-ink-fade/60 w-44"
                />
              </div>
            )}
            <button
              onClick={() => navigate('/create')}
              className="group flex items-center gap-2 px-4 py-2 bg-ink-700 dark:bg-seal-500
                hover:bg-seal-500 dark:hover:bg-seal-400 text-ink-50 dark:text-ink-50
                transition-colors font-display text-sm relative"
            >
              <Plus size={15} className="transition-transform group-hover:rotate-90" />
              <span>撰 新 篇</span>
            </button>
          </div>
        </div>

        {/* ====== 空状态 ====== */}
        {roadmaps.length === 0 ? (
          <div className="manuscript-card p-16 text-center relative overflow-hidden">
            <div className="ink-blot w-40 h-40 -top-10 -right-10" />
            <div className="ink-blot w-32 h-32 -bottom-8 -left-8" />
            <div className="relative">
              <div className="smallcaps mb-4">书 架 空 荡</div>
              <div className="font-display text-3xl italic text-ink-500 dark:text-ink-200 mb-2">
                The shelf awaits
              </div>
              <p className="font-display text-base text-ink-fade dark:text-ink-soft mb-1 max-w-md mx-auto leading-relaxed">
                此处尚无一册。你可以从一个<span className="text-seal-500">主题</span>开始,
              </p>
              <p className="font-display text-base text-ink-fade dark:text-ink-soft mb-8 max-w-md mx-auto leading-relaxed">
                AI 将为你拟出通往精通的章回目录。
              </p>
              <button
                onClick={() => navigate('/create')}
                className="group inline-flex items-center gap-2 px-6 py-3 bg-ink-700 dark:bg-seal-500
                  hover:bg-seal-500 dark:hover:bg-seal-400 text-ink-50 transition-colors font-display"
              >
                <Plus size={16} className="transition-transform group-hover:rotate-90" />
                <span>开 篇 落 笔</span>
              </button>
              <div className="smallcaps mt-8 text-ink-fade">— empty volume —</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRoadmaps.map((roadmap, idx) => {
              const counts = taskCounts[roadmap.id] || { total: 0, completed: 0, nextStage: undefined };
              const progress = counts.total > 0 ? (counts.completed / counts.total) * 100 : 0;
              const isDeleting = deletingId === roadmap.id;
              const isComplete = progress === 100;

              return (
                <article
                  key={roadmap.id}
                  onClick={() => navigate(`/roadmap/${roadmap.id}`)}
                  className="manuscript-card group cursor-pointer relative overflow-hidden
                    hover:shadow-ink-2 transition-all duration-300
                    animate-ink-spread"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div
                    aria-hidden
                    className={`absolute top-0 left-0 bottom-0 w-1
                      ${isComplete ? 'bg-gilt-500' : 'bg-seal-400'}
                      group-hover:w-1.5 transition-all`}
                  />
                  <span
                    aria-hidden
                    className="absolute top-0 right-0 w-4 h-4 z-10
                      bg-gradient-to-bl from-ink-100 dark:from-night-200 to-transparent
                      border-l border-b border-ink-200 dark:border-ink-700/40
                      group-hover:border-seal-400"
                    style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
                  />

                  <div className="p-5 pl-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-display italic text-2xl text-ink-300 dark:text-ink-700/60 leading-none select-none">
                          {roman(idx + 1)}
                        </span>
                        {isComplete && (
                          <span className="seal-stamp text-[9px] text-gilt-500 border-gilt-500">
                            通 关
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, roadmap.id)}
                        className={`p-1 transition-all ${
                          isDeleting
                            ? 'bg-seal-500 text-ink-50 px-2'
                            : 'opacity-0 group-hover:opacity-100 text-ink-fade hover:text-seal-500'
                        }`}
                        title={isDeleting ? '再次点击以焚毁' : '销毁此卷'}
                      >
                        <span className="font-mono text-[10px] tracking-wider">
                          {isDeleting ? '确认 焚毁' : '×'}
                        </span>
                      </button>
                    </div>

                    <h3 className="font-display text-[19px] font-semibold text-ink-700 dark:text-ink-100
                      group-hover:text-seal-500 transition-colors leading-snug mb-2 tracking-tight">
                      {roadmap.title}
                    </h3>

                    <p className="font-display italic text-sm text-ink-fade dark:text-ink-soft
                      line-clamp-2 leading-relaxed mb-4 min-h-[2.6em]">
                      {roadmap.description}
                    </p>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="smallcaps text-[9px]">已 研 习</span>
                        <span className="font-mono text-[10px] text-ink-500 dark:text-ink-200 tabular-nums">
                          {counts.completed}<span className="text-ink-fade">/{counts.total}</span>
                        </span>
                      </div>
                      <div className="h-px bg-ink-200 dark:bg-ink-700 relative">
                        <div
                          className={`absolute inset-y-0 left-0 transition-all duration-700
                            ${isComplete ? 'bg-gilt-500' : 'bg-seal-400'}`}
                          style={{ width: `${progress}%` }}
                        />
                        {progress > 5 && progress < 95 && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-seal-500 dark:bg-seal-300"
                            style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
                          />
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-dashed border-ink-200/60 dark:border-ink-700/40
                      flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 text-ink-fade">
                        <Clock size={11} />
                        <span className="font-mono tabular-nums">{roadmap.estimated_total_hours}h</span>
                      </div>
                      {counts.nextStage && !isComplete && (
                        <div className="flex items-center gap-1.5 text-ink-500 dark:text-ink-200 max-w-[60%]">
                          <BookOpen size={11} className="flex-shrink-0" />
                          <span className="font-display italic truncate">{counts.nextStage}</span>
                        </div>
                      )}
                      {isComplete && (
                        <div className="font-display italic text-gilt-500">— 完卷 —</div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {roadmaps.length > 0 && (
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-3 smallcaps text-ink-fade">
              <span className="w-8 h-px bg-gilt-500/60" />
              <span>Fin · 本卷止于此</span>
              <span className="w-8 h-px bg-gilt-500/60" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
