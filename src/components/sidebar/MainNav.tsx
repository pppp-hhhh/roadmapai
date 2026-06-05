import { NavLink } from 'react-router-dom';
import {
  Home,
  PlusCircle,
  Brain,
  Bot,
  Star,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { useSidebarStore } from '../../stores/useSidebarStore';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  badgeKey?: 'flashcards';
}

const navItems: NavItem[] = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/create', icon: PlusCircle, label: '创建路线' },
  { to: '/flashcards', icon: Brain, label: '记忆卡片', badgeKey: 'flashcards' },
  { to: '/tutor', icon: Bot, label: 'AI 导师' },
  { to: '/favorites', icon: Star, label: '收藏夹' },
  { to: '/stats', icon: BarChart3, label: '学习统计' },
];

export default function MainNav() {
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const todo = useSidebarStore((s) => s.todayTodo);

  return (
    <nav className="flex-1 px-2 py-2 overflow-y-auto">
      {navItems.map(({ to, icon: Icon, label, badgeKey }) => {
        const count = badgeKey === 'flashcards' ? todo.flashcards : 0;
        return (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={isCollapsed ? label : undefined}
            className={({ isActive }) =>
              `relative flex items-center gap-3 my-0.5 rounded-xl transition-all duration-200 ${
                isCollapsed
                  ? 'p-3 justify-center'
                  : 'px-3 py-2.5'
              } ${
                isActive
                  ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} className="flex-shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm truncate">{label}</span>
                )}
                {count > 0 && (
                  <span
                    className={`${
                      isCollapsed
                        ? 'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1'
                        : 'ml-auto min-w-[20px] h-5 px-1.5'
                    } rounded-full text-[10px] font-semibold flex items-center justify-center ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
                {!count && isActive && !isCollapsed && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-600 dark:bg-primary-400" />
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
