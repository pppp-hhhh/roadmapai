import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, BookOpen, Clock, TrendingUp, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useRoadmapStore } from '../stores/useRoadmapStore';
import type { Stage } from '../types';

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
  const [taskCounts, setTaskCounts] = useState<Record<string, { total: number; completed: number }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deletingId === id) {
      await deleteRoadmap(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
    }
  };

  useEffect(() => {
    fetchRoadmaps();
  }, [fetchRoadmaps]);

  useEffect(() => {
    // Fetch task counts for each roadmap
    const fetchCounts = async () => {
      const counts: Record<string, { total: number; completed: number }> = {};
      for (const roadmap of roadmaps) {
        try {
          const roadmapData = await invoke<RoadmapWithStages>('get_roadmap', { id: roadmap.id });
          let total = 0;
          let completed = 0;
          roadmapData?.stages?.forEach((stage) => {
            stage.tasks?.forEach((task) => {
              total++;
              if (task.is_completed) completed++;
            });
          });
          counts[roadmap.id] = { total, completed };
        } catch {
          counts[roadmap.id] = { total: 0, completed: 0 };
        }
      }
      setTaskCounts(counts);
    };
    if (roadmaps.length > 0) {
      fetchCounts();
    }
  }, [roadmaps]);

  if (isLoading && roadmaps.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">我的学习路线</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              追踪你的学习进度与掌握情况
            </p>
          </div>
          <button
            onClick={() => navigate('/create')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors"
          >
            <PlusCircle size={20} />
            <span>新建路线</span>
          </button>
        </div>

        {/* Empty state */}
        {roadmaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
              <BookOpen size={48} className="text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              还没有学习路线
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
              创建你的第一条 AI 学习路线，让我们助你规划通往精通的旅程。
            </p>
            <button
              onClick={() => navigate('/create')}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors"
            >
              <PlusCircle size={20} />
              <span>创建你的第一条路线</span>
            </button>
          </div>
        ) : (
          /* Roadmap grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roadmaps.map(roadmap => {
              const counts = taskCounts[roadmap.id] || { total: 0, completed: 0 };
              const progress = counts.total > 0 ? (counts.completed / counts.total) * 100 : 0;

              return (
                <div
                  key={roadmap.id}
                  onClick={() => navigate(`/roadmap/${roadmap.id}`)}
                  className="block group cursor-pointer"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-all hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-xl flex items-center justify-center">
                        <TrendingUp size={24} className="text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm">
                        <Clock size={14} />
                        <span>{roadmap.estimated_total_hours} 小时</span>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, roadmap.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          deletingId === roadmap.id
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                            : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                        }`}
                        title={deletingId === roadmap.id ? '再次点击确认删除' : '删除路线'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {roadmap.title}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                      {roadmap.description}
                    </p>

                    {/* Progress bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">进度</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {counts.completed}/{counts.total} 任务
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
