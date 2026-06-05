import { useEffect } from 'react';
import { Star, Trash2, MessageSquare, ListTodo, Link2, Brain, type LucideIcon } from 'lucide-react';
import { useFavoriteStore, type Favorite, type FavoriteType } from '../stores/useFavoriteStore';
import { EmptyFavorites, LoadingState, ErrorState } from '../components/states';
import { useExponentialRetry } from '../utils/useExponentialRetry';

const FILTER_TABS: { key: FavoriteType | 'all'; label: string; icon: LucideIcon }[] = [
  { key: 'all', label: '全部', icon: Star },
  { key: 'task', label: '任务', icon: ListTodo },
  { key: 'resource', label: '资源', icon: Link2 },
  { key: 'message', label: 'AI 回答', icon: MessageSquare },
  { key: 'flashcard', label: '闪卡', icon: Brain },
];

const TYPE_ICON: Record<FavoriteType, LucideIcon> = {
  task: ListTodo,
  resource: Link2,
  message: MessageSquare,
  flashcard: Brain,
};

const TYPE_LABEL: Record<FavoriteType, string> = {
  task: '任务',
  resource: '资源',
  message: 'AI 回答',
  flashcard: '闪卡',
};

export default function FavoritesPage() {
  const { favorites, isLoading, error, filter, setFilter, fetchFavorites, removeFavorite } =
    useFavoriteStore();

  const { retry, isRetrying } = useExponentialRetry(async () => {
    await fetchFavorites();
  });

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Star className="text-amber-500" size={28} />
            收藏夹
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            集中管理你标记的高价值内容。
          </p>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-x-auto">
          {FILTER_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                filter === key
                  ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading && (
          <LoadingState variant="card" loadingVariant="spinner" description="加载收藏中…" />
        )}

        {!isLoading && error && (
          <ErrorState
            variant="card"
            level="unknown"
            error={error}
            onRetry={retry}
            isRetrying={isRetrying}
          />
        )}

        {!isLoading && !error && favorites.length === 0 && <EmptyFavorites />}

        {!isLoading && !error && favorites.length > 0 && (
          <ul className="space-y-3">
            {favorites.map((f) => (
              <FavoriteItem key={f.id} favorite={f} onRemove={() => removeFavorite(f.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FavoriteItem({ favorite, onRemove }: { favorite: Favorite; onRemove: () => void }) {
  const Icon = TYPE_ICON[favorite.type];
  return (
    <li className="group p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {TYPE_LABEL[favorite.type]}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(favorite.created_at).toLocaleDateString()}
            </span>
          </div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
            {favorite.title}
          </h3>
          {favorite.preview && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {favorite.preview}
            </p>
          )}
        </div>
        <button
          onClick={onRemove}
          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
          title="取消收藏"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
}
