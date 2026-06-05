import { useNavigate } from 'react-router-dom';
import type { FC } from 'react';
import EmptyState from './EmptyState';
import { BookIllustration, StarIllustration, CheckIllustration } from './illustrations';

export const EmptyRoadmaps: FC = () => {
  const navigate = useNavigate();
  return (
    <EmptyState
      variant="fullpage"
      title="还没有学习路线"
      description="从任意主题开始,让 AI 为你定制结构化学习路径。"
      illustration={<BookIllustration />}
      actions={[
        {
          label: '创建第一条路线',
          onClick: () => navigate('/create'),
          variant: 'primary',
        },
      ]}
    />
  );
};

export const EmptyFavorites: FC = () => {
  const navigate = useNavigate();
  return (
    <EmptyState
      variant="card"
      title="收藏夹空空如也"
      description="在 AI 回答、任务、闪卡中点击星标即可收藏。"
      illustration={<StarIllustration />}
      actions={[
        {
          label: '去 AI 导师',
          onClick: () => navigate('/tutor'),
          variant: 'primary',
        },
      ]}
    />
  );
};

export const EmptySearch: FC<{ keyword?: string }> = ({ keyword }) => (
  <EmptyState
    variant="card"
    title="没有匹配的结果"
    description={keyword ? `找不到包含"${keyword}"的内容` : '试试调整关键词或筛选条件'}
  />
);

export const EmptyTodayTodo: FC = () => (
  <EmptyState
    variant="card"
    title="今日都学完啦"
    description="没有待办,明天再来吧。"
    illustration={<CheckIllustration />}
  />
);
