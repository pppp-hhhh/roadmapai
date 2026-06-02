import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Circle, ExternalLink, BookOpen,
  Video, Code, FileText, HelpCircle, X, Lock, Play,
  ChevronDown, ChevronRight, AlertTriangle, Pencil, Trash2, Plus, Save,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { useRoadmapStore } from '../stores/useRoadmapStore';
import QuizModal from '../components/QuizModal';
import { openExternalLink } from '../utils/links';
import type { Task, Stage, Resource } from '../types';

const taskTypeIcons: Record<string, typeof BookOpen> = {
  reading: BookOpen, video: Video, exercise: Code, project: FileText, quiz: HelpCircle,
};
const taskTypeColors: Record<string, string> = {
  reading: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
  video: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30',
  exercise: 'text-green-500 bg-green-100 dark:bg-green-900/30',
  project: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30',
  quiz: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30',
};

export default function RoadmapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRoadmap, isLoading, fetchRoadmap, markTaskCompleted, submitQuiz, addResource, updateResource, deleteResource } = useRoadmapStore();
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [showStageModal, setShowStageModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [quizStage, setQuizStage] = useState<Stage | null>(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [editingResource, setEditingResource] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', url: '', snippet: '', resource_type: 'article' });
  const [addingToTask, setAddingToTask] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ title: '', url: '', snippet: '', resource_type: 'article' });

  useEffect(() => { if (id) fetchRoadmap(id); }, [id, fetchRoadmap]);

  const handleStageClick = (stage: Stage) => {
    if (stage.isLocked) return;
    setSelectedStage(stage); setShowStageModal(true); setExpandedTasks(new Set());
  };

  const toggleExpandTask = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  const handleTaskToggle = async (taskId: string, completed: boolean) => {
    await markTaskCompleted(taskId, completed);
    if (selectedStage && showStageModal) {
      setSelectedStage(prev => {
        if (!prev) return null;
        return { ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, is_completed: completed } : t) };
      });
    }
  };

  const handleStartQuiz = (stage: Stage) => { setShowStageModal(false); setQuizStage(stage); setShowQuizModal(true); };
  const handleQuizSubmit = async (answers: number[]) => {
    if (!quizStage) return { passed: false, score: 0, correctCount: 0, totalQuestions: 0, feedback: [] };
    const result = await submitQuiz(quizStage.id, answers);
    if (result.passed && currentRoadmap) fetchRoadmap(currentRoadmap.id);
    return result;
  };

  const handleEditResource = (r: Resource) => {
    setEditingResource(r.id);
    setEditForm({ title: r.title, url: r.url, snippet: r.snippet || '', resource_type: r.resource_type });
  };

  const handleSaveResource = async () => {
    if (!editingResource || !editForm.title || !editForm.url) return;
    await updateResource(editingResource, editForm.title, editForm.url, editForm.snippet, editForm.resource_type);
    setEditingResource(null);
    if (currentRoadmap) fetchRoadmap(currentRoadmap.id);
  };

  const handleDeleteResource = async (resourceId: string) => {
    await deleteResource(resourceId);
    if (currentRoadmap) fetchRoadmap(currentRoadmap.id);
  };

  const handleAddResource = async () => {
    if (!addingToTask || !addForm.title || !addForm.url) return;
    await addResource(addingToTask, addForm.title, addForm.url, addForm.snippet, addForm.resource_type);
    setAddingToTask(null);
    setAddForm({ title: '', url: '', snippet: '', resource_type: 'article' });
    if (currentRoadmap) fetchRoadmap(currentRoadmap.id);
  };

  const getCompletedTaskCount = (stage: Stage) => stage.tasks.filter(t => t.is_completed).length;
  const getStageProgress = (stage: Stage) => stage.tasks.length === 0 ? 0 : Math.round((getCompletedTaskCount(stage) / stage.tasks.length) * 100);
  const canTakeQuiz = (stage: Stage) => {
    if (stage.isLocked || stage.stageType === 'quiz') return false;
    return stage.tasks.length > 0 && getCompletedTaskCount(stage) === stage.tasks.length;
  };

  const renderResourceCard = (r: Resource) => (
    <div key={r.id} className="shrink-0 w-56 bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700 group relative">
      {editingResource === r.id ? (
        <div className="space-y-2">
          <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })}
            placeholder="标题" className="w-full text-xs px-2 py-1 border rounded bg-gray-50 dark:bg-gray-700 dark:text-white" />
          <input value={editForm.url} onChange={e => setEditForm({ ...editForm, url: e.target.value })}
            placeholder="URL" className="w-full text-xs px-2 py-1 border rounded bg-gray-50 dark:bg-gray-700 dark:text-white" />
          <input value={editForm.snippet} onChange={e => setEditForm({ ...editForm, snippet: e.target.value })}
            placeholder="推荐理由" className="w-full text-xs px-2 py-1 border rounded bg-gray-50 dark:bg-gray-700 dark:text-white" />
          <select value={editForm.resource_type} onChange={e => setEditForm({ ...editForm, resource_type: e.target.value })}
            className="w-full text-xs px-2 py-1 border rounded bg-gray-50 dark:bg-gray-700 dark:text-white">
            <option value="article">文章</option><option value="video">视频</option><option value="course">课程</option><option value="documentation">文档</option>
          </select>
          <div className="flex gap-2">
            <button onClick={handleSaveResource} className="flex-1 py-1 bg-primary-500 text-white rounded text-xs"><Save size={12} className="inline mr-1" />保存</button>
            <button onClick={() => setEditingResource(null)} className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs">取消</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-primary-500 font-medium">
              {r.resource_type === 'video' ? '视频' : r.resource_type === 'course' ? '课程' : r.resource_type === 'article' ? '文章' : '文档'}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={(e) => { e.stopPropagation(); handleEditResource(r); }} className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"><Pencil size={12} /></button>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteResource(r.id); }} className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"><Trash2 size={12} /></button>
            </div>
          </div>
          <button onClick={() => openExternalLink(r.url)} className="w-full text-left">
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-1 line-clamp-2 hover:text-primary-600 dark:hover:text-primary-400">{r.title}</div>
            {r.snippet && <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{r.snippet}</div>}
            <div className="flex items-center gap-1 mt-2 text-xs text-primary-500"><ExternalLink size={12} /><span>打开</span></div>
          </button>
        </>
      )}
    </div>
  );

  const renderAddResourceButton = (taskId: string) => (
    <div className="shrink-0 w-56">
      {addingToTask === taskId ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800 space-y-2">
          <input value={addForm.title} onChange={e => setAddForm({ ...addForm, title: e.target.value })}
            placeholder="标题" className="w-full text-xs px-2 py-1 border rounded bg-white dark:bg-gray-700 dark:text-white" />
          <input value={addForm.url} onChange={e => setAddForm({ ...addForm, url: e.target.value })}
            placeholder="URL" className="w-full text-xs px-2 py-1 border rounded bg-white dark:bg-gray-700 dark:text-white" />
          <input value={addForm.snippet} onChange={e => setAddForm({ ...addForm, snippet: e.target.value })}
            placeholder="推荐理由" className="w-full text-xs px-2 py-1 border rounded bg-white dark:bg-gray-700 dark:text-white" />
          <select value={addForm.resource_type} onChange={e => setAddForm({ ...addForm, resource_type: e.target.value })}
            className="w-full text-xs px-2 py-1 border rounded bg-white dark:bg-gray-700 dark:text-white">
            <option value="article">文章</option><option value="video">视频</option><option value="course">课程</option><option value="documentation">文档</option>
          </select>
          <div className="flex gap-2">
            <button onClick={handleAddResource} className="flex-1 py-1 bg-primary-500 text-white rounded text-xs"><Plus size={12} className="inline mr-1" />添加</button>
            <button onClick={() => { setAddingToTask(null); setAddForm({ title: '', url: '', snippet: '', resource_type: 'article' }); }} className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs">取消</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingToTask(taskId)} className="w-full h-full min-h-[80px] flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 transition-colors text-gray-400 hover:text-primary-500">
          <Plus size={20} />
        </button>
      )}
    </div>
  );

  if (isLoading || !currentRoadmap) {
    return <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  }

  let totalTasks = 0, completedTasks = 0;
  currentRoadmap.stages.forEach(stage => {
    if (stage.stageType !== 'quiz') stage.tasks.forEach(task => { totalTasks++; if (task.is_completed) completedTasks++; });
  });
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const radius = 45, circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-8 py-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"><ArrowLeft size={20} /><span>返回首页</span></button>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{currentRoadmap.title}</h1>
              <p className="text-gray-500 dark:text-gray-400">{currentRoadmap.description}</p>
            </div>
            <div className="relative w-28 h-28 ml-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="none" className="text-gray-200 dark:text-gray-700" />
                <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="none" strokeLinecap="round" className="text-primary-500" style={{ strokeDasharray: circumference, strokeDashoffset }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{Math.round(progress)}%</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">完成度</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
            {currentRoadmap.stages.map((stage, index) => (
              <div key={stage.id} className="relative pl-16 pb-8 last:pb-0">
                <button onClick={() => handleStageClick(stage)} disabled={stage.isLocked}
                  className={`absolute left-0 w-12 h-12 rounded-full flex items-center justify-center transition-all z-10 ${
                    stage.isLocked ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed' :
                    stage.stageType === 'quiz' ? 'bg-yellow-100 dark:bg-yellow-900/50 cursor-pointer hover:bg-yellow-200 hover:scale-110' :
                    'bg-primary-100 dark:bg-primary-900/50 cursor-pointer hover:bg-primary-200 hover:scale-110'
                  }`}>
                  {stage.isLocked ? <Lock size={20} className="text-gray-400" /> :
                   stage.stageType === 'quiz' ? <HelpCircle size={20} className="text-yellow-500" /> :
                   <span className="text-primary-600 dark:text-primary-300 font-bold">{index + 1}</span>}
                </button>
                <button onClick={() => handleStageClick(stage)} disabled={stage.isLocked}
                  className={`w-full text-left bg-gray-50 dark:bg-gray-800/60 rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                    stage.isLocked ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed' :
                    'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/60 hover:border-primary-400 hover:shadow-lg'
                  }`}>
                  <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">第{stage.order}关</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${stage.stageType === 'quiz' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' : stage.stageType === 'project' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}>
                      {stage.stageType === 'learning' ? '学习' : stage.stageType === 'quiz' ? '测验' : '项目'}</span>
                    {stage.isFallback && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center gap-1"><AlertTriangle size={10} />AI生成失败</span>}
                  </div><span className="text-sm text-gray-400">{stage.estimated_hours} 小时</span></div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{stage.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{stage.objective}</p>
                  {(stage.stageType === 'learning' || stage.stageType === 'project') && stage.tasks.length > 0 && (
                    <div className="mt-3"><div className="flex justify-between text-xs text-gray-400 mb-1"><span>{getCompletedTaskCount(stage)}/{stage.tasks.length} 任务</span><span>{getStageProgress(stage)}%</span></div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-primary-500 rounded-full" style={{ width: `${getStageProgress(stage)}%` }} /></div></div>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showStageModal && selectedStage && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowStageModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto z-10">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-gray-500">第{selectedStage.order}关</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${selectedStage.stageType === 'quiz' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' : selectedStage.stageType === 'project' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}>
                    {selectedStage.stageType === 'learning' ? '学习' : selectedStage.stageType === 'quiz' ? '测验' : '项目'}</span>
                  <span className="text-sm text-gray-400">{selectedStage.estimated_hours} 小时</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedStage.name}</h2>
              </div>
              <button onClick={() => setShowStageModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-6">
              {selectedStage.isFallback && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle size={20} className="text-yellow-600 shrink-0 mt-0.5" />
                  <div><div className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">AI 暂时无法生成此阶段的详细内容</div>
                  <div className="text-xs text-yellow-700 dark:text-yellow-400">已使用占位内容。建议在首页重新生成整条路线，或参考下方学习建议自行补充内容。</div></div>
                </div>
              )}
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">阶段目标</h3>
                <p className="text-gray-600 dark:text-gray-400">{selectedStage.objective}</p>
                {(selectedStage.stageType === 'learning' || selectedStage.stageType === 'project') && selectedStage.tasks.length > 0 && (
                  <div className="mt-4"><div className="flex justify-between text-xs text-gray-400 mb-1"><span>{getCompletedTaskCount(selectedStage)}/{selectedStage.tasks.length} 任务</span><span>{getStageProgress(selectedStage)}%</span></div>
                  <div className="h-2.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden"><div className="h-full bg-primary-500 rounded-full" style={{ width: `${getStageProgress(selectedStage)}%` }} /></div></div>
                )}
              </div>
              {selectedStage.tasks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">学习任务 ({selectedStage.tasks.length})</h3>
                  <div className="space-y-3">
                    {selectedStage.tasks.map(task => {
                      const Icon = taskTypeIcons[task.task_type] || BookOpen;
                      const isExpanded = expandedTasks.has(task.id);
                      return (
                        <div key={task.id} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl overflow-hidden">
                          <div className="p-4 flex items-center gap-3">
                            <button onClick={() => handleTaskToggle(task.id, !task.is_completed)} className="shrink-0">
                              {task.is_completed ? <CheckCircle2 size={20} className="text-green-500" /> : <Circle size={20} className="text-gray-400" />}
                            </button>
                            <button onClick={() => toggleExpandTask(task.id)} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${taskTypeColors[task.task_type]}`}><Icon size={16} /></button>
                            <button onClick={() => toggleExpandTask(task.id)} className="flex-1 text-left"><div className={`text-sm font-medium ${task.is_completed ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{task.title}</div></button>
                            <button onClick={() => toggleExpandTask(task.id)} className="p-1 text-gray-400">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                          </div>
                          {isExpanded && (
                            <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 space-y-4">
                              <div className="markdown-content text-sm"><ReactMarkdown rehypePlugins={[rehypeHighlight]}>{task.content}</ReactMarkdown></div>
                              <button onClick={() => { setSelectedTask(task); setShowTaskModal(true); }} className="text-xs text-primary-500 hover:text-primary-600">在新窗口查看完整内容 →</button>
                              {task.code_example && <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto text-sm"><code>{task.code_example}</code></pre>}
                              {task.exercise && <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-4"><div className="text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">练习</div><p className="text-sm text-primary-900 dark:text-primary-100">{task.exercise}</p></div>}
                              <div>
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">学习资源（可编辑）</div>
                                <div className="flex gap-3 overflow-x-auto pb-2">
                                  {task.resources.map(r => renderResourceCard(r))}
                                  {renderAddResourceButton(task.id)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {canTakeQuiz(selectedStage) && (
                <button onClick={() => handleStartQuiz(selectedStage)} className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"><Play size={16} />参加过关测验</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showTaskModal && selectedTask && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-12 px-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowTaskModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-auto z-10">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${taskTypeColors[selectedTask.task_type]}`}>{React.createElement(taskTypeIcons[selectedTask.task_type] || BookOpen, { size: 20 })}</div><div><h2 className="font-semibold text-gray-900 dark:text-white">{selectedTask.title}</h2><p className="text-sm text-gray-500">{selectedTask.task_type === 'reading' ? '阅读' : selectedTask.task_type === 'video' ? '视频' : selectedTask.task_type === 'exercise' ? '练习' : selectedTask.task_type === 'project' ? '项目' : '测验'}</p></div></div>
              <button onClick={() => setShowTaskModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="markdown-content"><ReactMarkdown rehypePlugins={[rehypeHighlight]}>{selectedTask.content}</ReactMarkdown></div>
              {selectedTask.code_example && <div><h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">代码示例</h3><pre className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto text-sm"><code>{selectedTask.code_example}</code></pre></div>}
              {selectedTask.exercise && <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-4"><h3 className="text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">练习</h3><p className="text-primary-900 dark:text-primary-100">{selectedTask.exercise}</p></div>}
              {selectedTask.resources.length > 0 && <div><h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">学习资源</h3><div className="flex gap-4 overflow-x-auto pb-2">{selectedTask.resources.map(r => renderResourceCard(r))}{renderAddResourceButton(selectedTask.id)}</div></div>}
            </div>
          </div>
        </div>
      )}

      <QuizModal stage={quizStage as Stage} isOpen={showQuizModal} onClose={() => { setShowQuizModal(false); setQuizStage(null); }} onSubmit={handleQuizSubmit} />
    </div>
  );
}
