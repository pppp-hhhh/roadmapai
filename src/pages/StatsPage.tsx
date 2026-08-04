import { BarChart3, Clock, ListTodo, TrendingUp, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Stats {
  total_roadmaps: number;
  total_tasks: number;
  completed_tasks: number;
  total_chat_messages: number;
  total_favorites: number;
}

const DEFAULT_STATS: Stats = {
  total_roadmaps: 0,
  total_tasks: 0,
  completed_tasks: 0,
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
      } catch {
        try {
          const roadmaps = await invoke<any[]>('get_all_roadmaps');
          setStats({
            ...DEFAULT_STATS,
            total_roadmaps: roadmaps.length,
          });
        } catch (err) {
          setError(String(err));
        }
      }
    })();
  }, []);

  if (error && !stats) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-12 py-10">
          <header className="mb-8 animate-ink-spread">
            <div className="smallcaps mb-3">第 七 章 · 检 卷</div>
            <h1 className="font-display text-5xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-none">
              <span className="italic text-seal-500">学</span>习 统 计
            </h1>
            <div className="rule-gilt mt-5 max-w-xs" />
          </header>
          <div className="manuscript-card p-12 text-center">
            <div className="font-display italic text-base text-ink-fade dark:text-ink-soft">
              统 计 功 能 即 将 推 出
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
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

  const taskCompletion = stats.total_tasks > 0
    ? Math.round((stats.completed_tasks / stats.total_tasks) * 100)
    : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-12 py-10">
        <header className="mb-10 animate-ink-spread">
          <div className="smallcaps mb-3">第 七 章 · 检 卷</div>
          <h1 className="font-display text-5xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-none">
            <span className="italic text-seal-500">学</span>习 统 计
          </h1>
          <p className="font-display italic text-base text-ink-fade dark:text-ink-soft mt-3">
            汇 总 你 的 学 习 进 度 与 产 出。
          </p>
          <div className="rule-gilt mt-5 max-w-xs" />
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard icon={ListTodo}  roman="I"   label="学 习 路 线"   value={stats.total_roadmaps} />
          <StatCard icon={Clock}     roman="II"  label="任 务 完 成 率" value={`${taskCompletion}%`} sub={`${stats.completed_tasks} / ${stats.total_tasks}`} />
          <StatCard icon={TrendingUp} roman="III" label="AI 对 话"      value={stats.total_chat_messages} />
          <StatCard icon={BarChart3}  roman="IV"  label="收 藏 数"      value={stats.total_favorites} />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  roman: romanNum,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  roman: string;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="manuscript-card p-5 relative overflow-hidden">
      {/* 罗马水印 */}
      <span aria-hidden className="absolute top-2 right-3 font-display italic text-2xl
        text-ink-200/60 dark:text-ink-700/60 select-none pointer-events-none">
        {romanNum}
      </span>

      {/* 方形图标盒 */}
      <div className="w-10 h-10 border-2 border-ink-300 dark:border-ink-600
        bg-paper dark:bg-night-200 flex items-center justify-center text-seal-500 mb-4">
        <Icon size={18} />
      </div>

      <div className="font-display text-3xl font-semibold text-ink-700 dark:text-ink-100 tabular-nums">
        {value}
      </div>
      <div className="smallcaps mt-1.5">{label}</div>
      {sub && <div className="font-mono text-[10px] text-ink-fade mt-1.5">{sub}</div>}
    </div>
  );
}
