import { useState, useEffect, useCallback } from 'react';
import { Timer, Play, Pause, RotateCcw, X } from 'lucide-react';

const STORAGE_KEY = 'study-timer-state';
const DEFAULT_MINUTES = 25;

interface TimerState {
  endTime: number | null;
  pausedAt: number | null;
  totalSeconds: number;
  elapsedSeconds: number;
}

function loadState(): TimerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { endTime: null, pausedAt: null, totalSeconds: DEFAULT_MINUTES * 60, elapsedSeconds: 0 };
}

function saveState(s: TimerState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export default function StudyTimer() {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<TimerState>(loadState);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getRemaining = useCallback(() => {
    if (state.endTime && !state.pausedAt) {
      return Math.max(0, Math.ceil((state.endTime - now) / 1000));
    }
    if (state.pausedAt !== null) {
      return state.totalSeconds - state.elapsedSeconds;
    }
    return state.totalSeconds;
  }, [state, now]);

  const remaining = getRemaining();
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = 1 - remaining / state.totalSeconds;

  useEffect(() => {
    if (state.endTime && !state.pausedAt) saveState(state);
  }, [state.endTime, state.pausedAt]);

  const handleStart = () => {
    const newState: TimerState = {
      endTime: Date.now() + (state.totalSeconds - state.elapsedSeconds) * 1000,
      pausedAt: null,
      totalSeconds: state.totalSeconds,
      elapsedSeconds: state.elapsedSeconds,
    };
    setState(newState);
    saveState(newState);
  };

  const handlePause = () => {
    const elapsed = state.endTime
      ? state.totalSeconds - Math.max(0, Math.ceil((state.endTime - now) / 1000))
      : state.elapsedSeconds;
    const newState: TimerState = {
      endTime: null,
      pausedAt: Date.now(),
      totalSeconds: state.totalSeconds,
      elapsedSeconds: elapsed,
    };
    setState(newState);
    saveState(newState);
  };

  const handleReset = () => {
    const newState: TimerState = {
      endTime: null,
      pausedAt: null,
      totalSeconds: state.totalSeconds,
      elapsedSeconds: 0,
    };
    setState(newState);
    saveState(newState);
  };

  const handleSetMinutes = (mins: number) => {
    const s: TimerState = {
      endTime: null,
      pausedAt: null,
      totalSeconds: mins * 60,
      elapsedSeconds: 0,
    };
    setState(s);
    saveState(s);
  };

  const isRunning = state.endTime !== null && state.pausedAt === null;
  const isDone = remaining <= 0 && state.endTime !== null;

  const size = 48;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - progress);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Panel — manuscript-card(墨边浅金边阴影,无圆角) */}
      {expanded && (
        <div className="manuscript-card p-4 w-64">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">
              {[15, 25, 45, 60].map(m => (
                <button
                  key={m}
                  onClick={() => handleSetMinutes(m)}
                  disabled={isRunning}
                  className={`text-[10px] px-2 py-1 font-mono tabular-nums transition-colors border
                    ${state.totalSeconds === m * 60
                      ? 'border-seal-400 bg-seal-50 dark:bg-seal-700/20 text-seal-500'
                      : 'border-ink-300 dark:border-ink-600 text-ink-500 dark:text-ink-200 hover:border-seal-400 hover:text-seal-500'
                    } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {m} min
                </button>
              ))}
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="p-1 text-ink-fade hover:text-seal-500 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Timer display */}
          <div className="text-center mb-4">
            <div className={`font-mono font-bold text-4xl tabular-nums leading-none
              ${isDone ? 'text-seal-500' : 'text-ink-700 dark:text-ink-50'}`}>
              {isDone ? '完 卷' : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
            </div>
            <div className="smallcaps mt-2 text-[9px]">
              {isDone ? <span className="text-gilt-500">— 于 时 光 之 末 —</span> :
                isRunning ? <span className="text-seal-500 animate-flame">研 习 中</span> :
                state.pausedAt !== null ? <span className="text-ink-fade">已 暂 停 · 关 闭 应 用 后 计 时 仍 留</span> :
                <span className="text-ink-fade">专 注 学 习 计 时 · 数 据 自 动 存</span>}
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-2 pt-3 border-t border-dashed border-ink-200/60 dark:border-ink-700/40">
            {!isRunning ? (
              <button
                onClick={handleStart}
                className="flex items-center gap-1.5 px-4 py-2
                  bg-seal-500 hover:bg-seal-400 text-ink-50
                  transition-colors font-display text-sm
                  border-2 border-seal-600 min-w-[5rem] justify-center"
              >
                <Play size={14} />
                <span>{state.elapsedSeconds > 0 ? '续 笔' : '开 卷'}</span>
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="flex items-center gap-1.5 px-4 py-2
                  border-2 border-gilt-500 bg-gilt-500/10 text-gilt-500
                  hover:bg-gilt-500/20 transition-colors font-display text-sm
                  min-w-[5rem] justify-center"
              >
                <Pause size={14} />
                <span>停 笔</span>
              </button>
            )}
            <button
              onClick={handleReset}
              disabled={!isRunning && state.elapsedSeconds === 0}
              className="p-2 border border-ink-300 dark:border-ink-600
                text-ink-500 dark:text-ink-200 hover:border-seal-400 hover:text-seal-500
                disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="重 置"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Floating button — 方形 56px(不是圆)+ 手稿边框 + gilt-500 阴影 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-14 h-14 flex items-center justify-center transition-all
          ${isRunning
            ? 'bg-seal-500 text-ink-50 shadow-seal animate-flame'
            : isDone
              ? 'bg-gilt-500 text-ink-50 shadow-candle'
              : 'bg-paper dark:bg-night-200 text-ink-700 dark:text-ink-100 border-2 border-ink-700 dark:border-gilt-500 hover:border-seal-400'
          }`}
        title="学习计时器"
      >
        {isRunning ? (
          <div className="relative w-10 h-10">
            <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} opacity={0.35} />
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-bold">{minutes}</span>
          </div>
        ) : (
          <Timer size={22} />
        )}
      </button>
    </div>
  );
}
