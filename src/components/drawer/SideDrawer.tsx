import { useEffect, useRef, type FC, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}

const SideDrawer: FC<SideDrawerProps> = ({ isOpen, onClose, title, width = 480, children, footer }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC 关闭 + 锁定 body 滚动
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  // 焦点陷阱:打开时把焦点移到抽屉内
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const first = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative ml-auto h-full bg-white dark:bg-gray-800 shadow-2xl flex flex-col animate-slide-in-right"
        style={{ width: `min(${width}px, 100%)` }}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-900/50">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};

export default SideDrawer;
