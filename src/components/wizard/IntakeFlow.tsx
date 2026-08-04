import { useState, type FC } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  MessageCircleQuestion,
  PenLine,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  INTAKE_SUMMARY_ROUND,
  useIntakeStore,
} from '../../stores/useIntakeStore';
import { validateTopic } from '../../stores/useCreateRoadmapWizardStore';
import type { RoadmapRequest } from '../../types';
import { roman } from '../manuscript/roman';

interface IntakeFlowProps {
  onConfirm: (params: RoadmapRequest) => void | Promise<void>;
  compact?: boolean;
  generating?: boolean;
}

const LEVELS = ['入门', '进阶', '高级'];
const DIFFICULTIES = ['简单', '适中', '困难'];

const inputClass = `w-full px-4 py-3 bg-paper-fold dark:bg-night-300
  border-b-2 border-ink-300 dark:border-ink-600
  focus:border-seal-400 outline-none
  font-display text-base text-ink-700 dark:text-ink-100
  placeholder:text-ink-600 placeholder:dark:text-ink-soft
  placeholder:font-display placeholder:italic`;

const textareaClass = `w-full px-4 py-3 bg-paper-fold dark:bg-night-300
  border-b-2 border-ink-300 dark:border-ink-600
  focus:border-seal-400 outline-none resize-y
  font-display text-sm text-ink-700 dark:text-ink-100
  placeholder:text-ink-600 placeholder:dark:text-ink-soft
  placeholder:font-display placeholder:italic`;

const IntakeFlow: FC<IntakeFlowProps> = ({ onConfirm, compact = false, generating = false }) => {
  const {
    status,
    conversation,
    supplementary,
    round,
    question,
    error,
    errorAction,
    summary,
    setBaseline,
    askNext,
    submitAnswer,
    backToQuestion,
    setSupplementary,
    summarize,
    setSummary,
  } = useIntakeStore();

  const [baselineTopic, setBaselineTopic] = useState('');
  const [baselineGoal, setBaselineGoal] = useState('');
  const [answer, setAnswer] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [baselineError, setBaselineError] = useState<string | null>(null);

  const heading = compact ? 'text-2xl' : 'text-[40px]';
  const subheading = compact ? 'text-sm' : 'text-base';

  const handleStart = async () => {
    const v = validateTopic(baselineTopic);
    if (!v.valid || v.error) {
      setBaselineError(v.error || '主题太短,至少 2 个字');
      return;
    }
    if (!baselineGoal.trim()) {
      setBaselineError('请 简 述 你 的 学 习 目 标');
      return;
    }
    setBaselineError(null);
    setBaseline(baselineTopic, baselineGoal);
    await askNext();
  };

  const handleAnswer = async () => {
    if (!answer.trim()) return;
    submitAnswer(answer);
    setAnswer('');
    await askNext();
  };

  const handleConfirm = async () => {
    if (!summary || confirming || generating) return;
    setConfirming(true);
    try {
      await onConfirm({
        topic: summary.topic,
        level: summary.level,
        goal: summary.goal,
        difficulty: summary.difficulty,
        profile: [summary.profile.trim(), supplementary.trim()].filter(Boolean).join('\n\n'),
      });
    } catch {
      // 父页面负责展示生成错误
    } finally {
      setConfirming(false);
    }
  };

  const answeredRounds = Math.floor(conversation.length / 2);

  const renderRoundHeader = () => (
    <div className="flex items-center gap-3 mb-6">
      <MessageCircleQuestion size={15} className="text-seal-500" />
      <span className="smallcaps text-[9px]">AI 访 谈 · 第 {roman(round)} 问</span>
      <span className="font-mono text-[9px] text-ink-fade tabular-nums">
        已 收 集 {String(answeredRounds).padStart(2, '0')} 轮
      </span>
      <div className="flex-1 h-px bg-ink-200 dark:bg-ink-700/50" />
      <div className="flex gap-1">
        {Array.from({ length: INTAKE_SUMMARY_ROUND }).map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 ${i < Math.min(answeredRounds, INTAKE_SUMMARY_ROUND) ? 'bg-seal-400' : 'bg-ink-200 dark:bg-ink-700'}`}
          />
        ))}
      </div>
    </div>
  );

  // ===== 基线:主题 + 目标 =====
  if (status === 'baseline') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className={`text-center mb-8 ${compact ? '' : 'animate-ink-spread'}`}>
          <div className="smallcaps mb-3">第 二 章 · 访 谈</div>
          <h2 className={`font-display font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-tight mb-2 ${heading}`}>
            让 AI 先 <span className="italic text-seal-500">认 识</span> 你
          </h2>
          <p className={`font-display italic text-ink-fade ${subheading}`}>
            先写下主题与目标,AI 会通过几轮追问,为你描出一幅学习画像。
          </p>
          <div className="rule-gilt mt-5 max-w-xs mx-auto" />
        </div>

        <div className="manuscript-card p-7 space-y-6">
          <div>
            <label className="smallcaps mb-2 flex items-center gap-2 text-[10px]">
              <PenLine size={11} className="text-seal-500" />
              <span>学 习 主 题</span>
            </label>
            <input
              type="text"
              value={baselineTopic}
              onChange={(e) => {
                setBaselineTopic(e.target.value);
                setBaselineError(null);
              }}
              placeholder="例:机器学习、日语 N2、摄影构图"
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className="smallcaps mb-2 flex items-center gap-2 text-[10px]">
              <Sparkles size={11} className="text-gilt-500" />
              <span>学 习 目 标</span>
            </label>
            <textarea
              value={baselineGoal}
              onChange={(e) => {
                setBaselineGoal(e.target.value);
                setBaselineError(null);
              }}
              placeholder="如:系统掌握原理并能独立完成项目,或 3 个月内通过考试"
              rows={3}
              className={textareaClass}
            />
          </div>

          {baselineError && (
            <p className="flex items-center gap-1.5 font-display italic text-sm text-seal-500">
              <AlertCircle size={13} />
              {baselineError}
            </p>
          )}

          <button
            type="button"
            onClick={handleStart}
            disabled={!baselineTopic.trim() || !baselineGoal.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3
              bg-seal-500 hover:bg-seal-400 text-ink-50
              transition-colors font-display text-sm border-2 border-seal-600
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>开 始 访 谈</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ===== 追问中 =====
  if (status === 'asking') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="manuscript-card p-10 flex flex-col items-center justify-center gap-4 min-h-[260px]">
          <Loader2 size={26} className="text-seal-500 animate-spin" />
          <div className="font-display italic text-sm text-ink-fade">AI 正 在 推 敲 下 一 问…</div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 bg-seal-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ===== 展示问题,等待回答 =====
  if (status === 'question') {
    return (
      <div className="max-w-2xl mx-auto">
        {renderRoundHeader()}
        {answeredRounds >= INTAKE_SUMMARY_ROUND && (
          <div className="mb-5 border-2 border-dashed border-gilt-500/70 bg-gilt-500/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="smallcaps text-[9px] text-gilt-500 mb-1">
                已 收 集 {answeredRounds} 轮 对 话
              </div>
              <p className="font-display italic text-sm text-ink-700 dark:text-ink-100 leading-relaxed">
                可以生成总结,也可以继续回答本题,没有轮数上限。
              </p>
            </div>
            <button
              type="button"
              onClick={() => summarize()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 flex-shrink-0
                bg-seal-500 hover:bg-seal-400 text-ink-50
                transition-colors font-display text-sm border-2 border-seal-600"
            >
              <Wand2 size={15} />
              <span>生 成 总 结</span>
            </button>
          </div>
        )}
        <div className="manuscript-card p-7">
          <div className="smallcaps mb-2 text-[9px] text-gilt-500">— AI 的 一 问 —</div>
          <p className="font-display text-lg text-ink-700 dark:text-ink-100 leading-relaxed mb-6 min-h-[44px]">
            {question}
          </p>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAnswer();
            }}
            placeholder="答 案 可 长 可 短,越 具 体 越 好;⌘+Enter 提 交"
            rows={4}
            className={textareaClass}
            autoFocus
          />
          <button
            type="button"
            onClick={handleAnswer}
            disabled={!answer.trim()}
            className="mt-5 w-full flex items-center justify-center gap-2 px-6 py-3
              bg-ink-700 dark:bg-seal-500 hover:bg-seal-500 dark:hover:bg-seal-400
              text-ink-50 transition-colors font-display text-sm
              border-2 border-ink-800 dark:border-seal-600
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>提 交 并 继 续</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ===== 汇总中 =====
  if (status === 'summarizing') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="manuscript-card p-10 flex flex-col items-center justify-center gap-4 min-h-[260px]">
          <Loader2 size={26} className="text-seal-500 animate-spin" />
          <div className="font-display italic text-sm text-ink-fade">AI 正 在 研 墨 汇 总 学 习 画 像…</div>
        </div>
      </div>
    );
  }

  // ===== 汇总与确认 =====
  if (status === 'summary' && summary) {
    const busy = confirming || generating;
    return (
      <div className="max-w-2xl mx-auto">
        <div className="smallcaps mb-3 text-[9px]">最 后 一 页 · 学 习 画 像</div>
        <div className="manuscript-card p-7 space-y-6">
          <div>
            <div className="flex items-baseline gap-3 mb-1">
              <h3 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight">
                拟 纲 已 备
              </h3>
              <span className="font-mono text-[9px] text-ink-fade">{answeredRounds} 轮 访 谈</span>
            </div>
            <p className="font-display italic text-sm text-ink-fade leading-relaxed">
              确认以下画像后即可落笔;若想继续访谈,可退出总结回到刚才那道未回答的问题。
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="border border-ink-200 dark:border-ink-700/40 p-4">
              <div className="smallcaps text-[8px] mb-1.5 text-seal-500">主 题</div>
              <div className="font-display text-sm font-semibold text-ink-700 dark:text-ink-100">{summary.topic}</div>
            </div>
            <div className="border border-ink-200 dark:border-ink-700/40 p-4">
              <div className="smallcaps text-[8px] mb-1.5 text-seal-500">目 标</div>
              <div className="font-display text-sm text-ink-700 dark:text-ink-100 leading-snug">{summary.goal}</div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="smallcaps mb-2 block text-[9px]">当 前 水 平 · 可 修 改</label>
              <div className="grid grid-cols-3 gap-1.5">
                {LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSummary({ level })}
                    className={`px-2 py-2 font-display text-xs transition-colors border
                      ${summary.level === level
                        ? 'bg-seal-50/60 dark:bg-seal-700/15 border-seal-400 text-seal-500'
                        : 'bg-paper/50 dark:bg-night-200/40 border-ink-200 dark:border-ink-700/40 text-ink-600 dark:text-ink-200'
                      }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="smallcaps mb-2 block text-[9px]">难 度 · 可 修 改</label>
              <div className="grid grid-cols-3 gap-1.5">
                {DIFFICULTIES.map((difficulty) => (
                  <button
                    key={difficulty}
                    type="button"
                    onClick={() => setSummary({ difficulty })}
                    className={`px-2 py-2 font-display text-xs transition-colors border
                      ${summary.difficulty === difficulty
                        ? 'bg-gilt-500/10 border-gilt-500 text-gilt-500'
                        : 'bg-paper/50 dark:bg-night-200/40 border-ink-200 dark:border-ink-700/40 text-ink-600 dark:text-ink-200'
                      }`}
                  >
                    {difficulty}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="smallcaps mb-2 block text-[9px]">AI 生 成 的 学 习 画 像</label>
            <div className="border-l-2 border-seal-400 pl-4 py-3 bg-seal-50/40 dark:bg-seal-700/10">
              <p className="font-display text-sm text-ink-700 dark:text-ink-100 leading-relaxed whitespace-pre-line">
                {summary.profile}
              </p>
            </div>
          </div>

          <div>
            <label className="smallcaps mb-2 block text-[9px]">补 充 反 馈 · 可 修 改</label>
            <textarea
              value={supplementary}
              onChange={(e) => setSupplementary(e.target.value)}
              placeholder="如需补充或修正,写在这里;生成时会一并纳入"
              rows={3}
              className={textareaClass}
            />
          </div>

          <div className="grid sm:grid-cols-[1fr_auto] gap-3">
            <button
              type="button"
              onClick={backToQuestion}
              disabled={busy}
              className="flex items-center justify-center gap-2 px-6 py-3.5
                font-display text-sm text-ink-fade hover:text-seal-500
                transition-colors border border-ink-200 dark:border-ink-700/40
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowRight size={15} className="rotate-180" />
              <span>退 出 总 结 · 回 到 未 完 成 的 一 问</span>
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className="flex items-center justify-center gap-2 px-6 py-3.5
                bg-seal-500 hover:bg-seal-400 text-ink-50
                transition-colors font-display text-sm border-2 border-seal-600
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
              <span>{busy ? 'AI 落 墨 中…' : '确 认 生 成'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== 错误 =====
  if (status === 'error') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="manuscript-card p-7 border-l-3 border-seal-400">
          <div className="smallcaps mb-3 text-seal-500">访 谈 受 阻</div>
          <p className="font-display italic text-sm text-ink-fade leading-relaxed mb-2">
            与 AI 的连线暂时中断,请重试或返回。
          </p>
          {error && <p className="font-mono text-[10px] text-seal-500 mb-5 break-all">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => (errorAction === 'ask' ? askNext() : summarize())}
              className="flex items-center gap-2 px-5 py-2.5 bg-seal-500 hover:bg-seal-400 text-ink-50
                font-display text-sm transition-colors border-2 border-seal-600"
            >
              <ArrowRight size={14} />
              <span>重 试</span>
            </button>
            {errorAction === 'summarize' && (
              <button
                type="button"
                onClick={backToQuestion}
                className="px-5 py-2.5 font-display text-sm text-ink-fade hover:text-seal-500 transition-colors"
              >
                返 回
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default IntakeFlow;
