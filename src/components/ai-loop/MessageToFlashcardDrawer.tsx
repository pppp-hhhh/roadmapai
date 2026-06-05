import { useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoadmapStore } from '../../stores/useRoadmapStore';
import { SideDrawer } from '../drawer';
import { extractQuestion } from '../../utils/extractQuestion';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

const MessageToFlashcardDrawer: FC<Props> = ({ isOpen, onClose, content }) => {
  const navigate = useNavigate();
  const { roadmaps } = useRoadmapStore();
  const [roadmapId, setRoadmapId] = useState<string>(roadmaps[0]?.id ?? '');
  const [question, setQuestion] = useState(() => extractQuestion(content));
  const [answer, setAnswer] = useState(content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!roadmapId) {
      setError('请先选择学习路线');
      return;
    }
    if (!question.trim()) {
      setError('请填写问题');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // 调 v1.0 创建闪卡命令
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('create_flashcard', {
        request: { roadmap_id: roadmapId, question: question.trim(), answer: answer.trim() },
      });
      onClose();
      navigate('/flashcards');
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="转成记忆卡片"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium"
          >
            {saving ? '保存中…' : '保存卡片'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            所属路线
          </label>
          <select
            value={roadmapId}
            onChange={(e) => setRoadmapId(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none"
          >
            <option value="">-- 请选择 --</option>
            {roadmaps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            问题
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例如:什么是闭包?"
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">已自动从回答中提取,你可以修改</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            答案
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none font-mono text-sm resize-none"
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">
            {error}
          </div>
        )}
      </div>
    </SideDrawer>
  );
};

export default MessageToFlashcardDrawer;
