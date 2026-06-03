import { useState, useEffect, useCallback } from 'react';
import { Timer, Play, Pause, RotateCcw, X } from 'lucide-react';

const STORAGE_KEY = 'study-timer-state';
const DEFAULT_MINUTES = 25;

interface TimerState {
  endTime: number | null;  // timestamp when timer ends (null = not running)
  pausedAt: number | null; // timestamp when paused (null = running)
  totalSeconds: number;    // total seconds for this session
  elapsedSeconds: number;  // elapsed seconds when paused
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

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate remaining seconds
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

  // Save state on mount if running
  useEffect(() => {
    if (state.endTime && !state.pausedAt) {
      saveState(state);
    }
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

  // Ring dimensions
  const size = 80;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - progress);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Panel */}
      {expanded && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 w-64">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">
              {[15, 25, 45, 60].map(m => (
                <button
                  key={m}
                  onClick={() => handleSetMinutes(m)}
                  disabled={isRunning}
                  className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                    state.totalSeconds === m * 60
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  } disabled:opacity-50`}
                >
                  {m}min
                </button>
              ))}
            </div>
            <button onClick={() => setExpanded(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <X size={16} className="text-gray-400" />
            </button>
          </div>

          {/* Timer display */}
          <div className="text-center mb-3">
            <div className={`text-3xl font-mono font-bold ${isDone ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>
              {isDone ? '✅ 完成!' : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
            </div>
            {isRunning && (
              <div className="text-xs text-primary-500 mt-1 animate-pulse">学习中...</div>
            )}
            {state.pausedAt !== null && remaining < state.totalSeconds && (
              <div className="text-xs text-gray-400 mt-1">已暂停 · 关闭应用后计时将保留</div>
            )}
            {!isRunning && state.elapsedSeconds === 0 && (
              <div className="text-xs text-gray-400 mt-1">专注学习计时器 · 数据自动保存</div>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-2">
            {!isRunning ? (
              <button onClick={handleStart} className="flex items-center gap-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm transition-colors">
                <Play size={16} />{state.elapsedSeconds > 0 ? '继续' : '开始'}
              </button>
            ) : (
              <button onClick={handlePause} className="flex items-center gap-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-sm transition-colors">
                <Pause size={16} />暂停
              </button>
            )}
            <button onClick={handleReset} disabled={!isRunning && state.elapsedSeconds === 0}
              className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 transition-colors">
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110
          ${isRunning
            ? 'bg-primary-600 text-white animate-pulse'
            : isDone
            ? 'bg-green-500 text-white'
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
          }`}
        title="学习计时器"
      >
        {isRunning ? (
          <div className="relative w-12 h-12">
            <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} opacity={0.3} />
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{minutes}</span>
          </div>
        ) : (
          <Timer size={24} />
        )}
      </button>
    </div>
  );
}
