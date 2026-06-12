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
  chapter: string;
  badgeKey?: 'flashcards';
}

const navItems: NavItem[] = [
  { to: '/',           icon: Home,        label: '首页',     chapter: 'I' },
  { to: '/create',     icon: PlusCircle,  label: '创建路线', chapter: 'II' },
  { to: '/flashcards', icon: Brain,       label: '记忆卡片', chapter: 'III', badgeKey: 'flashcards' },
  { to: '/tutor',      icon: Bot,         label: 'AI 导师',  chapter: 'IV' },
  { to: '/favorites',  icon: Star,        label: '收藏夹',   chapter: 'V' },
  { to: '/stats',      icon: BarChart3,   label: '学习统计', chapter: 'VI' },
];

export default function MainNav() {
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const todo = useSidebarStore((s) => s.todayTodo);

  return (
    <nav className="flex-1 px-3 py-2 overflow-y-auto">
      {!isCollapsed && (
        <div className="smallcaps mb-2 px-2 flex items-center justify-between">
          <span>目 录</span>
          <span className="text-gilt-500">✦</span>
        </div>
      )}
      <div className={isCollapsed ? 'space-y-1' : 'border-t border-ink-200/60 dark:border-ink-700/40'}>
        {navItems.map(({ to, icon: Icon, label, chapter, badgeKey }) => {
          const count = badgeKey === 'flashcards' ? todo.flashcards : 0;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={isCollapsed ? label : undefined}
              className={({ isActive }) =>
                `relative flex items-center gap-3 my-0.5 transition-all duration-200
                ${isCollapsed
                  ? 'p-2.5 justify-center'
                  : 'px-3 py-2.5 border-l-2'}
                ${isActive
                  ? 'border-seal-400 bg-seal-50/60 dark:bg-seal-700/10 text-seal-500 dark:text-seal-300 font-medium'
                  : 'border-transparent text-ink-500 dark:text-ink-200 hover:bg-ink-100/50 dark:hover:bg-night-300/50 hover:border-ink-300 dark:hover:border-ink-500/40'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {!isCollapsed && (
                    <span className={`font-display italic text-[11px] w-4 tabular-nums
                      ${isActive ? 'text-seal-400' : 'text-ink-fade'}`}>
                      {chapter}
                    </span>
                  )}
                  <Icon size={17} className="flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="text-[13px] font-display truncate tracking-tight">{label}</span>
                  )}
                  {count > 0 && !isCollapsed && (
                    <span className="ml-auto font-mono text-[10px] font-semibold text-seal-500 tabular-nums">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                  {count > 0 && isCollapsed && (
                    <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-1 text-[9px] font-mono font-semibold text-paper bg-seal-400 flex items-center justify-center">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
