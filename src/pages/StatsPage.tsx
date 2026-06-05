import { BarChart3, Clock, Brain, ListTodo, TrendingUp, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Stats {
  total_roadmaps: number;
  total_tasks: number;
  completed_tasks: number;
  total_flashcards: number;
  reviewed_flashcards: number;
  total_chat_messages: number;
  total_favorites: number;
}

const DEFAULT_STATS: Stats = {
  total_roadmaps: 0,
  total_tasks: 0,
  completed_tasks: 0,
  total_flashcards: 0,
  reviewed_flashcards: 0,
  total_chat_messages: 0,
  total_favorites: 0,
};

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await invoke<Stats>('get_user_stats', {});
        setStats(s);
      } catch (e) {
        // 后端命令未实现:聚合已有数据
        try {
          const roadmaps = await invoke<any[]>('get_all_roadmaps');
          const flashcards = await invoke<any[]>('get_due_flashcards').catch(() => []);
          setStats({
            ...DEFAULT_STATS,
            total_roadmaps: roadmaps.length,
            total_flashcards: flashcards.length,
          });
        } catch (err) {
          setError(String(err));
        }
      }
    })();
  }, []);

  if (error && !stats) {
    return (
      <div className="h-full overflow-y-auto p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="text-primary-600" /> 学习统计
            </h1>
          </header>
          <div className="p-8 rounded-2xl bg-white dark:bg-gray-800 border text-center text-gray-500">
            统计功能即将推出
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        加载中…
      </div>
    );
  }

  const taskCompletion = stats.total_tasks > 0
    ? Math.round((stats.completed_tasks / stats.total_tasks) * 100)
    : 0;
  const cardCompletion = stats.total_flashcards > 0
    ? Math.round((stats.reviewed_flashcards / stats.total_flashcards) * 100)
    : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <BarChart3 className="text-primary-600" /> 学习统计
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">汇总你的学习进度与产出。</p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            icon={ListTodo}
            label="学习路线"
            value={stats.total_roadmaps}
            color="from-primary-500 to-blue-500"
          />
          <StatCard
            icon={Clock}
            label="任务完成率"
            value={`${taskCompletion}%`}
            sub={`${stats.completed_tasks} / ${stats.total_tasks}`}
            color="from-green-500 to-emerald-500"
          />
          <StatCard
            icon={Brain}
            label="闪卡总数"
            value={stats.total_flashcards}
            sub={cardCompletion > 0 ? `已复习 ${cardCompletion}%` : undefined}
            color="from-purple-500 to-pink-500"
          />
          <StatCard
            icon={TrendingUp}
            label="AI 对话"
            value={stats.total_chat_messages}
            color="from-orange-500 to-amber-500"
          />
          <StatCard
            icon={BarChart3}
            label="收藏数"
            value={stats.total_favorites}
            color="from-rose-500 to-red-500"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <div
        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white mb-3`}
      >
        <Icon size={20} />
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}
