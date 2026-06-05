import { type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { SideDrawer } from '../drawer';
import type { Task } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
}

const PENDING_KEY = 'roadmapai-pending-tutor-message';

const TaskToTutorDrawer: FC<Props> = ({ isOpen, onClose, task }) => {
  const navigate = useNavigate();

  const handleAsk = () => {
    if (!task) return;
    const prompt = `请基于以下学习任务,向我提问或解释关键概念:

【任务标题】${task.title}
【任务内容】
${task.content.slice(0, 2000)}
`;
    try {
      sessionStorage.setItem(PENDING_KEY, prompt);
    } catch {
      /* quota */
    }
    onClose();
    navigate('/tutor');
  };

  if (!task) return null;

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="基于此任务提问"
      width={560}
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            取消
          </button>
          <button
            onClick={handleAsk}
            className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium"
          >
            打开 AI 导师
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-900/30">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            AI 会读取以下任务作为上下文,你可以继续追问或要求进一步解释。
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            任务
          </div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{task.title}</div>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            内容预览
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 max-h-64 overflow-y-auto whitespace-pre-wrap font-mono">
            {task.content.slice(0, 600)}
            {task.content.length > 600 && '…'}
          </div>
        </div>
      </div>
    </SideDrawer>
  );
};

export default TaskToTutorDrawer;
export { PENDING_KEY };
