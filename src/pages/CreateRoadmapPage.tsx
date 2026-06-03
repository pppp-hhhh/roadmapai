import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
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
    try {
      const roadmapId = await generateRoadmap({
        topic: form.topic, level: form.level, goal: form.goal.trim() || `系统学习${form.topic}`,
        difficulty: form.difficulty,
      });
      navigate(`/roadmap/${roadmapId}`);
    } catch (err) { /* store handles error */ }
  };

  const isOutlinePhase = !progress || progress.type === 'started' || progress.type === 'outline_complete';

  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

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
            <p className="text-xs text-gray-400 mt-1">AI 将严格围绕此主题生成所有学习内容 · 学习时间和周期由 AI 自动评估</p>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              学习目标 <span className="text-gray-400 font-normal">（可选）</span>
            </label>
            <textarea value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })}
              placeholder="如：期末复习、系统掌握、快速入门... 不填则 AI 自动判断"
              rows={2}
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
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-white/20 dark:border-gray-700/50">

              {/* Steps indicator */}
              <div className="flex items-center justify-center gap-1 mb-8">
                {[
                  { id: 1, label: '大纲', icon: '🧠' },
                  { id: 2, label: '骨架', icon: '📋' },
                  { id: 3, label: '内容', icon: '📝' },
                  { id: 4, label: '完成', icon: '✅' },
                ].map(step => {
                  const isActive = (step.id === 1 && (!progress || progress.type === 'started' || progress.type === 'outline_complete'))
                    || (step.id === 2 && (progress?.type === 'stage_started' || progress?.type === 'stage_completed'))
                    || (step.id === 3 && (progress?.type === 'stage_completed' && progress.current > 0))
                    || (step.id === 4 && progress?.type === 'completed');
                  const isDone = step.id < (progress?.type === 'completed' ? 5 : progress?.type === 'stage_completed' ? 3 : progress?.type === 'outline_complete' ? 2 : 1);
                  return (
                    <div key={step.id} className="flex items-center gap-1">
                      <div className={`flex flex-col items-center gap-1 transition-all duration-700 ${
                        isActive ? 'scale-110' : isDone ? 'opacity-50 scale-95' : 'opacity-25 scale-90'
                      }`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm transition-all duration-500 ${
                          isActive ? 'bg-primary-500 text-white shadow-primary-500/30 ring-4 ring-primary-100 dark:ring-primary-900/50' :
                          isDone ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          {isDone ? '✓' : step.icon}
                        </div>
                        <span className={`text-[10px] font-medium transition-colors duration-500 ${
                          isActive ? 'text-primary-600 dark:text-primary-400' :
                          isDone ? 'text-green-500' : 'text-gray-400'
                        }`}>{step.label}</span>
                      </div>
                      {step.id < 4 && (
                        <div className={`w-6 h-0.5 rounded-full mb-4 transition-all duration-700 ${
                          isDone ? 'bg-green-400' : isActive && step.id < 4 ? 'bg-primary-300 animate-pulse' : 'bg-gray-200 dark:bg-gray-700'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Main status */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-medium mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                  {!progress || progress.type === 'started' ? 'Layer 1: 大纲生成' :
                   progress.type === 'outline_complete' ? 'Layer 2: 阶段架构' :
                   progress.type === 'stage_started' || progress.type === 'stage_completed' ? 'Layer 3: 任务内容' :
                   progress.type === 'completed' ? '写入数据库' : '处理中'}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {!progress || progress.type === 'started' ? 'AI 正在规划学习路径' :
                   progress.type === 'outline_complete' ? '大纲生成完毕，正在细化' :
                   progress.type === 'stage_started' || progress.type === 'stage_completed' ? '正在并行生成任务内容' :
                   progress.type === 'completed' ? '正在保存...' : '处理中'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {!progress || progress.type === 'started' ? '分析主题、评估难度、设计阶段划分...' :
                   progress.type === 'outline_complete' ? `已规划 ${progress.total} 个阶段，正在为每个阶段生成任务列表...` :
                   progress.type === 'stage_started' || progress.type === 'stage_completed'
                    ? progress.stage_title
                      ? `当前阶段：${progress.stage_title}`
                      : 'AI 正在为每个任务编写详细内容、推荐资源和生成记忆卡片...'
                   : '写入数据库，准备展示...'}
                </p>
              </div>

              {/* Progress bar */}
              {!isOutlinePhase && progress && progress.total > 0 && (
                <div className="space-y-3">
                  <div className="relative">
                    <div className="w-full bg-gray-100 dark:bg-gray-700/50 rounded-full h-4 overflow-hidden shadow-inner">
                      <div className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                        style={{ width: `${Math.max(progressPercent, 4)}%` }}>
                        {/* Animated gradient */}
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-primary-500 to-purple-500 animate-flow"
                          style={{
                            backgroundSize: '200% 100%',
                            animation: 'flow 2s linear infinite',
                          }} />
                        {/* Shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                          style={{
                            backgroundSize: '50% 100%',
                            animation: 'shimmer 1.5s ease-in-out infinite',
                          }} />
                      </div>
                    </div>
                    {/* Percentage badge */}
                    <div className="absolute -top-3 right-0 bg-primary-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg transition-all duration-500"
                      style={{ transform: `translateX(-${100 - progressPercent}%)` }}>
                      {progressPercent}%
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-primary-400" />
                      {progress.current}/{progress.total} 阶段
                    </span>
                  </div>
                </div>
              )}

              {/* Fallback dots for outline phase */}
              {isOutlinePhase && (
                <div className="flex justify-center gap-2 mt-2">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-primary-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.2}s`, animationDuration: '1s' }} />
                  ))}
                </div>
              )}

              {/* Cancel button */}
              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    navigate('/');
                  }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  取消生成 · 返回首页后可稍后查看已生成部分
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
