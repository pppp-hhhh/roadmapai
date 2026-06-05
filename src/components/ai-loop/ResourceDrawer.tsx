import { useState, useEffect, type FC } from 'react';
import { SideDrawer } from '../drawer';
import { useRoadmapStore } from '../../stores/useRoadmapStore';
import type { Resource } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  taskId: string;
  resource: Resource | null;
}

const TYPES = [
  { value: 'documentation', label: '官方文档' },
  { value: 'video', label: '视频' },
  { value: 'course', label: '课程' },
  { value: 'article', label: '文章' },
];

const ResourceDrawer: FC<Props> = ({ isOpen, onClose, mode, taskId, resource }) => {
  const { addResource, updateResource } = useRoadmapStore();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [snippet, setSnippet] = useState('');
  const [resourceType, setResourceType] = useState('article');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(resource?.title ?? '');
      setUrl(resource?.url ?? '');
      setSnippet(resource?.snippet ?? '');
      setResourceType(resource?.resource_type ?? 'article');
      setError(null);
    }
  }, [isOpen, resource]);

  const handleSave = async () => {
    if (!title.trim() || !url.trim()) {
      setError('请填写标题和链接');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (mode === 'edit' && resource) {
        await updateResource(resource.id, title.trim(), url.trim(), snippet.trim(), resourceType);
      } else {
        await addResource(taskId, title.trim(), url.trim(), snippet.trim(), resourceType);
      }
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
      title={mode === 'edit' ? '编辑资源' : '添加资源'}
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
            {saving ? '保存中…' : '保存'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            标题
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            链接
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            类型
          </label>
          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            简介(可选)
          </label>
          <textarea
            value={snippet}
            onChange={(e) => setSnippet(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none resize-none"
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

export default ResourceDrawer;
