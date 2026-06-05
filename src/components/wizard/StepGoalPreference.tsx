import type { FC } from 'react';
import { Clock, Zap, FolderGit2 } from 'lucide-react';
import {
  useCreateRoadmapWizardStore,
  GOAL_TEMPLATES,
  type Difficulty,
} from '../../stores/useCreateRoadmapWizardStore';
import WizardShell from './WizardShell';

const HOUR_PRESETS = [2, 4, 6, 10, 15];

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; desc: string }[] = [
  { value: '简单', label: '简单', desc: '概念讲解多,任务少' },
  { value: '适中', label: '适中', desc: '平衡理论与实操' },
  { value: '困难', label: '困难', desc: '高强度,大量练习' },
];

const StepGoalPreference: FC<{ step: 3 | 4 }> = ({ step }) => {
  const {
    goal, goalDetail, weeklyHours, difficulty, includeProject,
    setField,
  } = useCreateRoadmapWizardStore();

  if (step === 3) {
    const t = GOAL_TEMPLATES.find((g) => g.key === goal);
    return (
      <WizardShell
        title="你学这个的目标?"
        subtitle="选择最贴近你的目标,我会调整每个阶段的侧重点"
        aiHint="求职面试会偏重刷题和项目;项目实战会压缩理论;个人兴趣会保留探索空间。"
      >
        <div className="space-y-2">
          {GOAL_TEMPLATES.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setField('goal', g.key)}
              className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                goal === g.key
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    goal === g.key ? 'border-primary-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {goal === g.key && <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />}
                </div>
                <span className="font-medium text-gray-900 dark:text-white">{g.label}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            补充说明 {goal === 'custom' ? <span className="text-red-500">*</span> : <span className="text-gray-400">(可选)</span>}
          </label>
          <input
            type="text"
            value={goalDetail}
            onChange={(e) => setField('goalDetail', e.target.value)}
            placeholder={t?.placeholder}
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white"
          />
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell
      title="学习节奏与偏好"
      subtitle="帮 AI 估算每个阶段的时间与任务密度"
      aiHint="每周 4-6 小时是大多数学习者的舒适区;含项目会多花 20% 时间但更扎实。"
    >
      <div className="space-y-5">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            <Clock size={16} className="text-primary-500" />
            每周可投入时间
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {HOUR_PRESETS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setField('weeklyHours', h)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  weeklyHours === h
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {h} 小时
              </button>
            ))}
          </div>
          <input
            type="range"
            min={1}
            max={20}
            value={weeklyHours}
            onChange={(e) => setField('weeklyHours', Number(e.target.value))}
            className="w-full accent-primary-600"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            当前选择:每周 {weeklyHours} 小时
          </p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            <Zap size={16} className="text-primary-500" />
            难度偏好
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setField('difficulty', opt.value)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  difficulty === opt.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="font-medium text-sm text-gray-900 dark:text-white">{opt.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            <FolderGit2 size={16} className="text-primary-500" />
            是否包含项目实战
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setField('includeProject', true)}
              className={`p-3 rounded-xl border-2 transition-all ${
                includeProject
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="font-medium text-sm text-gray-900 dark:text-white">含项目</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">推荐 · 更扎实</div>
            </button>
            <button
              type="button"
              onClick={() => setField('includeProject', false)}
              className={`p-3 rounded-xl border-2 transition-all ${
                !includeProject
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="font-medium text-sm text-gray-900 dark:text-white">纯学习</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">只学概念和练习</div>
            </button>
          </div>
        </div>
      </div>
    </WizardShell>
  );
};

export default StepGoalPreference;
