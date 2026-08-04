import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTodo, Sparkles, type LucideIcon } from 'lucide-react';
import { useSidebarStore } from '../../stores/useSidebarStore';

interface TodoItemProps {
  icon: LucideIcon;
  count: number;
  label: string;
  glyph: string;
  onClick: () => void;
}

function TodoItem({ icon: Icon, count, label, glyph, onClick }: TodoItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5
        hover:bg-ink-100/50 dark:hover:bg-night-300/60
        transition-colors group border-l-2 border-transparent
        hover:border-seal-400"
    >
      <span className="font-mono text-[10px] text-ink-fade w-4 tabular-nums tracking-tight">{glyph}</span>
      <Icon size={15} className="text-ink-500 dark:text-ink-200 flex-shrink-0 group-hover:text-seal-400 transition-colors" />
      <span className="flex-1 text-left font-display text-[13px] text-ink-600 dark:text-ink-100 group-hover:text-ink-700 dark:group-hover:text-ink-50">
        {label}
      </span>
      {count > 0 && (
        <span className="font-mono text-[11px] font-semibold text-seal-500 tabular-nums">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

export default function TodayTodoList() {
  const navigate = useNavigate();
  const todo = useSidebarStore((s) => s.todayTodo);
  const refreshTodayTodo = useSidebarStore((s) => s.refreshTodayTodo);
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);

  useEffect(() => {
    refreshTodayTodo();
    const t = setInterval(refreshTodayTodo, 30_000);
    return () => clearInterval(t);
  }, [refreshTodayTodo]);

  const total = todo.tasks + todo.updates;

  if (isCollapsed) return null;
  if (total === 0) return null;

  return (
    <div className="px-5 pb-4">
      <div className="smallcaps mb-2 flex items-center justify-between">
        <span>今 日 笔 记</span>
        <span className="text-gilt-500">❦</span>
      </div>
      <div className="border-t border-ink-200/60 dark:border-ink-700/40">
        {todo.tasks > 0 && (
          <TodoItem
            icon={ListTodo}
            count={todo.tasks}
            label="今日未竟"
            glyph="I"
            onClick={() => navigate('/')}
          />
        )}
        {todo.updates > 0 && (
          <TodoItem
            icon={Sparkles}
            count={todo.updates}
            label="路线更新"
            glyph="II"
            onClick={() => navigate('/')}
          />
        )}
      </div>
    </div>
  );
}
