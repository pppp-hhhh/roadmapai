import { Outlet, NavLink } from 'react-router-dom';
import {
  Home,
  PlusCircle,
  Layers,
  Brain,
  Settings,
  Moon,
  Sun,
} from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';

const navItems = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/create', icon: PlusCircle, label: '创建路线' },
  { to: '/flashcards', icon: Brain, label: '记忆卡片' },
  { to: '/tutor', icon: Layers, label: 'AI 导师' },
  { to: '/settings', icon: Settings, label: '设置' },
];

export default function Layout() {
  const { theme, setTheme } = useSettingsStore();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-16 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-4 gap-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `p-3 rounded-xl transition-colors ${
                isActive
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`
            }
            title={label}
          >
            <Icon size={24} />
          </NavLink>
        ))}

        {/* Theme toggle at bottom */}
        <div className="mt-auto">
          <button
            onClick={toggleTheme}
            className="p-3 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          >
            {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
