import { useState, type FC } from 'react';
import { useRoadmapStore } from '../../stores/useRoadmapStore';
import { SideDrawer } from '../drawer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

const TASK_TYPES = [
  { value: 'reading', label: '阅读' },
  { value: 'exercise', label: '练习' },
  { value: 'project', label: '项目' },
  { value: 'video', label: '视频' },
];

const MessageToTaskDrawer: FC<Props> = ({ isOpen, onClose, content }) => {
  const { roadmaps, currentRoadmap, fetchRoadmap } = useRoadmapStore();
  const [roadmapId, setRoadmapId] = useState<string>(currentRoadmap?.id ?? '');
  const [stageId, setStageId] = useState<string>('');
  const [title, setTitle] = useState(() => content.split('\n')[0].replace(/^#+\s*/, '').slice(0, 60));
  const [taskType, setTaskType] = useState<string>('reading');
  const [minutes, setMinutes] = useState<number>(20);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isOpen && !roadmapId && roadmaps.length > 0) {
    setRoadmapId(roadmaps[0].id);
  }

  const targetRoadmap = currentRoadmap?.id === roadmapId ? currentRoadmap : null;

  const handleRoadmapChange = async (id: string) => {
    setRoadmapId(id);
    setStageId('');
    if (id) await fetchRoadmap(id);
  };

  const handleSave = async () => {
    if (!roadmapId || !stageId) {
      setError('请选择路线和阶段');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('add_task_to_stage', {
        stageId,
        title: title.trim() || '新任务',
        content,
        taskType,
        minutes,
      });
      onClose();
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
      title="转成学习任务"
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
            {saving ? '保存中…' : '添加到阶段'}
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
            onChange={(e) => handleRoadmapChange(e.target.value)}
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

        {roadmapId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              所属阶段
            </label>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none"
            >
              <option value="">-- 请选择 --</option>
              {(targetRoadmap?.stages ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.order}. {s.name}
                </option>
              ))}
              {!targetRoadmap && (
                <option disabled>请先选择路线</option>
              )}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            任务标题
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              任务类型
            </label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none"
            >
              {TASK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              预计时长(分钟)
            </label>
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            任务内容(可编辑)
          </label>
          <textarea
            value={content}
            readOnly
            rows={8}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl font-mono text-xs text-gray-600 dark:text-gray-400 resize-none"
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

export default MessageToTaskDrawer;
