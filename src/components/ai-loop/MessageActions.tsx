import { useState, type FC } from 'react';
import { Copy, Brain, ListTodo, Star, ThumbsUp, ThumbsDown, type LucideIcon } from 'lucide-react';
import { useFavoriteStore } from '../../stores/useFavoriteStore';
import { extractPreview } from '../../utils/extractQuestion';

interface Props {
  content: string;
  messageId: string;
  onOpenFlashcardDrawer: () => void;
  onOpenTaskDrawer: () => void;
  /** 用于构造 favorite refId,默认用 messageId */
  refId?: string;
}

const MessageActions: FC<Props> = ({
  content,
  messageId,
  onOpenFlashcardDrawer,
  onOpenTaskDrawer,
  refId,
}) => {
  const [copied, setCopied] = useState(false);
  const { favorites, addFavorite, removeFavorite, isFavorited } = useFavoriteStore();
  const fid = refId ?? messageId;
  const favorited = isFavorited('message', fid);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const handleFavorite = async () => {
    if (favorited) {
      const f = favorites.find((x) => x.type === 'message' && x.ref_id === fid);
      if (f) await removeFavorite(f.id);
    } else {
      await addFavorite({
        type: 'message',
        ref_id: fid,
        roadmap_id: null,
        title: extractPreview(content, 60),
        preview: extractPreview(content, 200),
      });
    }
  };

  return (
    <div className="mt-3 flex items-center gap-1 animate-fade-in">
      <ActionButton onClick={handleCopy} active={copied} label={copied ? '已复制' : '复制'} icon={Copy} />
      <ActionButton onClick={onOpenFlashcardDrawer} label="转闪卡" icon={Brain} />
      <ActionButton onClick={onOpenTaskDrawer} label="转任务" icon={ListTodo} />
      <ActionButton
        onClick={handleFavorite}
        active={favorited}
        label={favorited ? '已收藏' : '收藏'}
        icon={Star}
        filled={favorited}
      />
      <div className="ml-auto flex items-center gap-1">
        <ActionButton
          onClick={() => {
            // v1.1 占位:后续接入反馈数据
          }}
          label=""
          icon={ThumbsUp}
          noLabel
        />
        <ActionButton
          onClick={() => {
            // v1.1 占位
          }}
          label=""
          icon={ThumbsDown}
          noLabel
        />
      </div>
    </div>
  );
};

interface ActionButtonProps {
  onClick: () => void;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  filled?: boolean;
  noLabel?: boolean;
}

const ActionButton: FC<ActionButtonProps> = ({ onClick, label, icon: Icon, active, filled, noLabel }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
      active
        ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
    }`}
    title={label || undefined}
  >
    <Icon
      size={14}
      className={filled ? 'fill-amber-400 text-amber-500' : ''}
    />
    {!noLabel && label && <span>{label}</span>}
  </button>
);

export default MessageActions;
