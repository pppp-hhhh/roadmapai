import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, BookOpen, CheckCircle2 } from 'lucide-react';
import { useSidebarStore } from '../../stores/useSidebarStore';
import { useRoadmapStore } from '../../stores/useRoadmapStore';
import { roman } from '../manuscript/roman';

export default function CurrentRoadmapCard() {
  const navigate = useNavigate();
  const currentRoadmapId = useSidebarStore((s) => s.currentRoadmapId);
  const setCurrentRoadmap = useSidebarStore((s) => s.setCurrentRoadmap);
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const roadmaps = useRoadmapStore((s) => s.roadmaps);
  const currentRoadmap = useRoadmapStore((s) => s.currentRoadmap);
  const fetchRoadmaps = useRoadmapStore((s) => s.fetchRoadmaps);
  const fetchRoadmap = useRoadmapStore((s) => s.fetchRoadmap);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (roadmaps.length === 0) fetchRoadmaps();
  }, [roadmaps.length, fetchRoadmaps]);

  useEffect(() => {
    const m = window.location.pathname.match(/^\/roadmap\/([^/]+)/);
    if (m && m[1] !== currentRoadmapId) setCurrentRoadmap(m[1]);
  }, [currentRoadmapId, setCurrentRoadmap]);

  // URL 路由到 /roadmap/{id} 时,自己拉详情,
  // 避免与 RoadmapDetailPage 并行挂载时 store 还没数据导致显示"加载中…"
  useEffect(() => {
    const m = window.location.pathname.match(/^\/roadmap\/([^/]+)/);
    if (!m) return;
    const id = m[1];
    if (id !== currentRoadmap?.id) {
      fetchRoadmap(id).catch(() => { /* swallow:详情页会再拉 */ });
    }
  }, [currentRoadmap?.id, fetchRoadmap]);

  const handleSelect = async (id: string) => {
    setCurrentRoadmap(id);
    setOpen(false);
    if (id !== currentRoadmap?.id) await fetchRoadmap(id);
    navigate(`/roadmap/${id}`);
  };

  let progress = 0;
  // 当前路线 store 数据(可能没拉到,那 stages 不可用)
  const currentDetail =
    currentRoadmap && currentRoadmap.id === currentRoadmapId
      ? currentRoadmap
      : null;
  // fallback 摘要:从 roadmaps 列表里查,至少有 title/id
  const fallback = !currentDetail
    ? roadmaps.find((r) => r.id === currentRoadmapId) || null
    : null;
  if (currentDetail && currentDetail.stages) {
    let total = 0, done = 0;
    for (const s of currentDetail.stages) for (const t of s.tasks || []) { total++; if (t.is_completed) done++; }
    progress = total > 0 ? Math.round((done / total) * 100) : 0;
  }

  // 折叠态 — 仅方形图标
  if (isCollapsed) {
    return (
      <div className="px-3 pb-3">
        <button
          onClick={() => navigate(currentRoadmapId ? `/roadmap/${currentRoadmapId}` : '/')}
          className="w-full aspect-square flex items-center justify-center
            border border-ink-200 dark:border-ink-700/50
            hover:border-seal-400 transition-colors
            bg-ink-50/50 dark:bg-night-200/50"
          title={currentRoadmap?.title || '当前路线'}
        >
          <BookOpen size={18} className="text-ink-500 dark:text-ink-200" />
        </button>
      </div>
    );
  }

  // 展开态 — 无当前路线
  if (!currentRoadmapId) {
    return (
      <div className="px-5 pb-4">
        <div className="manuscript-card p-5 relative overflow-hidden">
          <span
            aria-hidden
            className="absolute top-0 right-0 w-5 h-5 border-l border-b border-ink-200 dark:border-ink-700/60"
            style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
          />
          <div className="relative text-center">
            <div className="smallcaps mb-3 text-seal-500">— 空 —</div>
            <p className="font-display text-base font-semibold text-ink-700 dark:text-ink-100 mb-1 tracking-tight">
              书架尚空
            </p>
            <p className="font-display italic text-[11px] text-ink-fade dark:text-ink-soft mb-4 leading-relaxed">
              此处尚无一册在读
            </p>
            <button
              onClick={() => navigate('/create')}
              className="group inline-flex items-center gap-1.5 px-3.5 py-1.5
                bg-seal-500 hover:bg-seal-400 text-ink-50
                font-display text-xs transition-colors"
            >
              <span>撰 写 新 篇</span>
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 展开态 — 有当前路线
  // current 优先用详情,缺则用列表摘要(至少给标题)
  const current = currentDetail || fallback;
  const stageCount = currentDetail?.stages?.length ?? 0;

  return (
    <div className="px-5 pb-4">
      <div className="smallcaps mb-2 flex items-center justify-between">
        <span>在 读 册</span>
        <span className="text-gilt-500">✦</span>
      </div>

      {/* button + dropdown 共用一层 relative,dropdown 紧贴 button 下边缘弹出 */}
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full p-4 border border-ink-200 dark:border-ink-700/50
            hover:border-seal-400 dark:hover:border-seal-400
            transition-all text-left relative group
            bg-ink-50/40 dark:bg-night-200/40"
        >
          <span
            aria-hidden
            className="absolute top-0 right-0 w-3 h-3 border-l border-b border-ink-200 dark:border-ink-700/50
              group-hover:border-seal-400"
          />
          <div className="flex items-center gap-3">
            {/* 进度环 — 方形印章式 */}
            <div className="relative w-11 h-11 flex-shrink-0">
              <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" className="stroke-ink-200 dark:stroke-ink-700" strokeWidth="1.5" />
                <circle
                  cx="22" cy="22" r="18"
                  className="stroke-seal-400 transition-all duration-700"
                  strokeWidth="1.8"
                  strokeDasharray={`${(progress / 100) * 113.1} 113.1`}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {progress === 100
                  ? <CheckCircle2 size={16} className="text-seal-400" />
                  : <span className="font-display text-[11px] font-semibold text-seal-500">{progress}<tspan fontSize="7">%</tspan></span>}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-[15px] font-medium text-ink-600 dark:text-ink-50 truncate leading-tight tracking-wide">
                {current?.title || '尚 未 选 册'}
              </div>
              <div className="smallcaps mt-1.5 text-[9px] flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-seal-400" />
                {progress === 100 ? '已 通 关' : current ? '研 习 中' : '静 待 翻 阅'}
              </div>
            </div>
            <ChevronDown
              size={14}
              className={`text-ink-fade transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute left-0 right-0 top-full mt-1 p-1 manuscript-card z-40 max-h-72 overflow-auto">
              {roadmaps.slice(0, 5).map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r.id)}
                  className={`w-full text-left pl-3 pr-3 py-2 text-sm hover:bg-ink-100/60 dark:hover:bg-night-300/60 transition-colors flex items-center gap-3
                    ${r.id === currentRoadmapId ? 'text-seal-500' : 'text-ink-600 dark:text-ink-200'}`}
                >
                  <span className="font-mono text-[10px] text-ink-fade w-4 tabular-nums flex-shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {/* 占位:对齐卡片"进度环"位置(44px + gap-3 12px = 56px,减去编号 16px + gap-3 12px = 额外 28px 占位)*/}
                  <span className="w-7 flex-shrink-0" aria-hidden />
                  <span className="truncate font-display font-medium tracking-wide flex-1">{r.title}</span>
                </button>
              ))}
              {roadmaps.length > 5 && (
                <button
                  onClick={() => { setOpen(false); navigate('/'); }}
                  className="w-full text-left px-3 py-2 text-[10px] smallcaps text-ink-fade hover:bg-ink-100/60 dark:hover:bg-night-300/60"
                >
                  阅 全 部 {roadmaps.length} 册 →
                </button>
              )}
              {roadmaps.length === 0 && (
                <div className="px-3 py-3 text-xs text-ink-fade italic font-display text-center">书架空荡</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 装饰 — 罗马章数 + 进度 */}
      {current && stageCount > 0 && (
        <div className="mt-1 text-center font-display italic text-[10px] text-ink-fade/50 tracking-widest leading-none">
          {roman(stageCount)} 章 · {progress}%
        </div>
      )}
    </div>
  );
}
