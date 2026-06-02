import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { useRoadmapStore } from '../stores/useRoadmapStore';

const levels = ['入门', '进阶', '高级'];
const difficulties = ['简单', '适中', '困难'];

export default function CreateRoadmapPage() {
  const navigate = useNavigate();
  const { generateRoadmap, isGenerating, error } = useRoadmapStore();

  const [form, setForm] = useState({
    topic: '',
    level: '入门',
    goal: '',
    weekly_hours: 10,
    total_weeks: 8,
    difficulty: '适中',
  });

  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!form.topic.trim()) {
      setValidationError('请输入学习主题');
      return;
    }
    if (!form.goal.trim()) {
      setValidationError('请描述你的学习目标');
      return;
    }

    try {
      const roadmapId = await generateRoadmap({
        topic: form.topic,
        level: form.level,
        goal: form.goal,
        weekly_hours: form.weekly_hours,
        total_weeks: form.total_weeks,
        difficulty: form.difficulty,
      });
      navigate(`/roadmap/${roadmapId}`);
    } catch (err) {
      // Error handled by store
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>返回首页</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            创建学习路线
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            让 AI 为你设计个性化的学习路径
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              你想学习什么？
            </label>
            <input
              type="text"
              value={form.topic}
              onChange={e => setForm({ ...form, topic: e.target.value })}
              placeholder="例如：机器学习、Python 编程、Web 开发"
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              你当前的水平
            </label>
            <div className="flex gap-3">
              {levels.map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setForm({ ...form, level })}
                  className={`flex-1 py-3 px-4 rounded-xl border transition-all ${
                    form.level === level
                      ? 'bg-primary-100 dark:bg-primary-900 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              你的学习目标是什么？
            </label>
            <textarea
              value={form.goal}
              onChange={e => setForm({ ...form, goal: e.target.value })}
              placeholder="例如：我想从零搭建自己的神经网络，准备数据科学岗位面试..."
              rows={3}
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                每周学习小时
              </label>
              <input
                type="number"
                min={1}
                max={40}
                value={form.weekly_hours}
                onChange={e => setForm({ ...form, weekly_hours: parseInt(e.target.value) || 10 })}
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                学习周期（周）
              </label>
              <input
                type="number"
                min={1}
                max={52}
                value={form.total_weeks}
                onChange={e => setForm({ ...form, total_weeks: parseInt(e.target.value) || 8 })}
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              偏好难度
            </label>
            <div className="flex gap-3">
              {difficulties.map(diff => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setForm({ ...form, difficulty: diff })}
                  className={`flex-1 py-3 px-4 rounded-xl border transition-all ${
                    form.difficulty === diff
                      ? 'bg-primary-100 dark:bg-primary-900 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          {(error || validationError) && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {validationError || error}
            </div>
          )}

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-xl font-medium transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>AI 正在生成你的路线...</span>
              </>
            ) : (
              <>
                <Sparkles size={20} />
                <span>生成学习路线</span>
              </>
            )}
          </button>
        </form>

        {isGenerating && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md mx-4 text-center">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles size={32} className="text-primary-600 dark:text-primary-400 animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                正在创建你的学习路线
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                AI 正在设计个性化的路线图，请耐心等待...
              </p>
              <div className="flex items-center justify-center gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
