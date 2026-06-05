import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, BookOpen, CheckCircle2 } from 'lucide-react';
import { useSidebarStore } from '../../stores/useSidebarStore';
import { useRoadmapStore } from '../../stores/useRoadmapStore';

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
    if (roadmaps.length === 0) {
      fetchRoadmaps();
    }
  }, [roadmaps.length, fetchRoadmaps]);

  // 同步 URL 路线到 store
  useEffect(() => {
    const m = window.location.pathname.match(/^\/roadmap\/([^/]+)/);
    if (m && m[1] !== currentRoadmapId) {
      setCurrentRoadmap(m[1]);
    }
  }, [currentRoadmapId, setCurrentRoadmap]);

  const handleSelect = async (id: string) => {
    setCurrentRoadmap(id);
    setOpen(false);
    if (id !== currentRoadmap?.id) {
      await fetchRoadmap(id);
    }
    navigate(`/roadmap/${id}`);
  };

  // 计算进度
  let progress = 0;
  if (currentRoadmap && currentRoadmap.stages) {
    let total = 0;
    let done = 0;
    for (const s of currentRoadmap.stages) {
      for (const t of s.tasks || []) {
        total++;
        if (t.is_completed) done++;
      }
    }
    progress = total > 0 ? Math.round((done / total) * 100) : 0;
  }

  if (isCollapsed) {
    return (
      <div className="px-2 pb-2">
        <button
          onClick={() => navigate(currentRoadmapId ? `/roadmap/${currentRoadmapId}` : '/')}
          className="w-full p-2 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center"
          title={currentRoadmap?.title || '当前路线'}
        >
          <BookOpen size={20} />
        </button>
      </div>
    );
  }

  // 展开态
  if (!currentRoadmapId) {
    return (
      <div className="px-3 pb-3">
        <div className="p-4 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center">
          <BookOpen size={28} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">还没有正在学的路线</p>
          <button
            onClick={() => navigate('/create')}
            className="mt-3 text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline"
          >
            创建第一条 →
          </button>
        </div>
      </div>
    );
  }

  const current = currentRoadmap?.id === currentRoadmapId ? currentRoadmap : null;

  return (
    <div className="px-3 pb-3 relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full p-3 rounded-2xl bg-gradient-to-br from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 hover:from-primary-100 hover:to-purple-100 dark:hover:from-primary-900/40 dark:hover:to-purple-900/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex-shrink-0">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18" cy="18" r="15"
                className="fill-none stroke-gray-200 dark:stroke-gray-700"
                strokeWidth="3"
              />
              <circle
                cx="18" cy="18" r="15"
                className="fill-none stroke-primary-600 dark:stroke-primary-400 transition-all"
                strokeWidth="3"
                strokeDasharray={`${(progress / 100) * 94.2} 94.2`}
                strokeLinecap="round"
              />
            </svg>
            {progress === 100 && (
              <CheckCircle2
                size={14}
                className="absolute inset-0 m-auto text-green-500"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-500 dark:text-gray-400">当前路线</div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {current?.title || '加载中…'}
            </div>
          </div>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 top-full mt-1 p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-40 max-h-72 overflow-auto">
            {roadmaps.slice(0, 5).map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelect(r.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  r.id === currentRoadmapId
                    ? 'text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="truncate">{r.title}</div>
              </button>
            ))}
            {roadmaps.length > 5 && (
              <button
                onClick={() => {
                  setOpen(false);
                  navigate('/');
                }}
                className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                查看全部 {roadmaps.length} 条 →
              </button>
            )}
            {roadmaps.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">还没有路线</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
