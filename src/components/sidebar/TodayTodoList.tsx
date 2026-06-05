import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, ListTodo, Sparkles, type LucideIcon } from 'lucide-react';
import { useSidebarStore } from '../../stores/useSidebarStore';

interface TodoItemProps {
  icon: LucideIcon;
  count: number;
  label: string;
  color: string;
  onClick: () => void;
}

function TodoItem({ icon: Icon, count, label, color, onClick }: TodoItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors group"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
      <div className="flex-1 text-left">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {label}
        </div>
      </div>
      {count > 0 && (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 group-hover:bg-primary-200 dark:group-hover:bg-primary-900/60">
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
    // 30 秒轮询
    const t = setInterval(() => {
      refreshTodayTodo();
    }, 30_000);
    return () => clearInterval(t);
  }, [refreshTodayTodo]);

  const total = todo.flashcards + todo.tasks + todo.updates;

  if (isCollapsed) return null;
  if (total === 0 && !todo.flashcards) return null; // 全部为空时隐藏整段

  return (
    <div className="px-3 pb-3">
      <div className="flex items-center gap-2 px-3 mb-2">
        <Sparkles size={14} className="text-primary-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          今日待办
        </span>
      </div>
      <div className="space-y-1">
        {todo.flashcards > 0 && (
          <TodoItem
            icon={Brain}
            count={todo.flashcards}
            label="待复习卡片"
            color="bg-purple-500"
            onClick={() => navigate('/flashcards')}
          />
        )}
        {todo.tasks > 0 && (
          <TodoItem
            icon={ListTodo}
            count={todo.tasks}
            label="今日未完成"
            color="bg-orange-500"
            onClick={() => navigate('/')}
          />
        )}
        {todo.updates > 0 && (
          <TodoItem
            icon={Sparkles}
            count={todo.updates}
            label="路线更新"
            color="bg-blue-500"
            onClick={() => navigate('/')}
          />
        )}
      </div>
    </div>
  );
}
