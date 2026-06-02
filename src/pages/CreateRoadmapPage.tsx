import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, Brain, ListChecks, FileText } from 'lucide-react';
import { useRoadmapStore } from '../stores/useRoadmapStore';

const levels = ['入门', '进阶', '高级'];
const difficulties = ['简单', '适中', '困难'];

export default function CreateRoadmapPage() {
  const navigate = useNavigate();
  const { generateRoadmap, isGenerating, error, progress } = useRoadmapStore();

  const [form, setForm] = useState({
    topic: '', level: '入门', goal: '', difficulty: '适中',
  });
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    if (!form.topic.trim()) { setValidationError('请输入学习主题'); return; }
    if (!form.goal.trim()) { setValidationError('请描述你的学习目标'); return; }
    try {
      const roadmapId = await generateRoadmap({
        topic: form.topic, level: form.level, goal: form.goal, difficulty: form.difficulty,
      });
      navigate(`/roadmap/${roadmapId}`);
    } catch (err) { /* store handles error */ }
  };

  const isOutlinePhase = !progress || progress.type === 'started' || progress.type === 'outline_complete';
  const isSkeletonPhase = progress?.type === 'stage_started' || progress?.type === 'stage_completed' || progress?.type === 'stage_failed';

  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  // Determine active layer label
  const layerLabel = !progress || progress.type === 'started'
    ? '生成大纲'
    : progress.type === 'outline_complete'
    ? '大纲完成，生成阶段架构'
    : isSkeletonPhase
    ? `生成阶段内容 (${progress.current}/${progress.total})`
    : progress.type === 'completed'
    ? '写入数据库'
    : '处理中...';

  const LayerIcon = !progress || progress.type === 'started' || progress.type === 'outline_complete'
    ? Brain
    : isSkeletonPhase
    ? ListChecks
    : FileText;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-8">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6">
          <ArrowLeft size={20} /><span>返回首页</span>
        </button>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">创建学习路线</h1>
          <p className="text-gray-500 dark:text-gray-400">让 AI 为你设计个性化的学习路径</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">你想学习什么？</label>
            <input type="text" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })}
              placeholder="例如：机器学习、Python 编程、Web 开发"
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">你当前的水平</label>
            <div className="flex gap-3">
              {levels.map(level => (
                <button key={level} type="button" onClick={() => setForm({ ...form, level })}
                  className={`flex-1 py-3 px-4 rounded-xl border transition-all ${form.level === level
                    ? 'bg-primary-100 dark:bg-primary-900 border-primary-500 text-primary-700 dark:text-primary-300'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>{level}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">你的学习目标是什么？</label>
            <textarea value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })}
              placeholder="例如：我想从零搭建自己的神经网络..." rows={3}
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">偏好难度</label>
            <div className="flex gap-3">
              {difficulties.map(diff => (
                <button key={diff} type="button" onClick={() => setForm({ ...form, difficulty: diff })}
                  className={`flex-1 py-3 px-4 rounded-xl border transition-all ${form.difficulty === diff
                    ? 'bg-primary-100 dark:bg-primary-900 border-primary-500 text-primary-700 dark:text-primary-300'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>{diff}</button>
              ))}
            </div>
          </div>
          {(error || validationError) && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 text-sm">
              {validationError || error}
            </div>
          )}
          <button type="submit" disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-xl font-medium">
            {isGenerating ? <><Loader2 size={20} className="animate-spin" /><span>AI 正在生成你的路线...</span></>
            : <><Sparkles size={20} /><span>生成学习路线</span></>}
          </button>
        </form>

        {/* Progress overlay */}
        {isGenerating && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-8 shadow-2xl">
              {/* Icon + title */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                  <div className="absolute inset-0 rounded-full border-4 border-primary-200 dark:border-primary-800 border-t-primary-500 animate-spin" />
                  <LayerIcon size={28} className="text-primary-600 dark:text-primary-400 relative z-10" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  {!progress || progress.type === 'started' ? '正在生成学习路线大纲' :
                   progress.type === 'outline_complete' ? '大纲生成完成' :
                   progress.type === 'stage_started' || progress.type === 'stage_completed' ? '正在并行生成各阶段内容' :
                   progress.type === 'completed' ? '正在保存到数据库...' :
                   '正在处理...'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{layerLabel}</p>
              </div>

              {/* Progress bar */}
              {!isOutlinePhase && progress && progress.total > 0 && (
                <div className="space-y-3">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{progress.current}/{progress.total} 阶段</span>
                    <span>{progressPercent}%</span>
                  </div>
                  {progress.stage_title && (
                    <div className="text-xs text-gray-600 dark:text-gray-300 text-center animate-pulse">
                      {progress.stage_title}
                    </div>
                  )}
                </div>
              )}

              {/* Layer indicator dots */}
              <div className="flex justify-center gap-2 mt-4">
                <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                  (!progress || progress.type === 'started' || progress.type === 'outline_complete')
                    ? 'bg-primary-500 scale-125' : 'bg-gray-300 dark:bg-gray-600'}`} />
                <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                  (progress?.type === 'stage_started' || progress?.type === 'stage_completed')
                    ? 'bg-primary-500 scale-125 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
                <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                  progress?.type === 'completed'
                    ? 'bg-green-500 scale-125' : 'bg-gray-300 dark:bg-gray-600'}`} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
