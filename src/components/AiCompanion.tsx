import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bot, Maximize2, MapPin, Minimize2, Send, Trash2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { lowlight, sanitizeMarkdown } from '../utils/markdown';
import { useAiCompanionStore } from '../stores/useAiCompanionStore';
import { useChatStore } from '../stores/useChatStore';
import { useRoadmapStore } from '../stores/useRoadmapStore';

const COLLAPSED_SIZE = 56;
const PANEL_WIDTH = 340;
const EXPANDED_WIDTH = 440;
const BOTTOM_OFFSET = 24;
const SIDE_OFFSET = 96;
const MAX_HEIGHT = 560;

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
}

export default function AiCompanion() {
  const { isOpen, isExpanded, position, context, closeCompanion, toggleOpen, setExpanded, setPosition } =
    useAiCompanionStore();
  const { messages, isStreaming, error, sendMessage, clearMessages } = useChatStore();
  const currentRoadmap = useRoadmapStore((s) => s.currentRoadmap);
  const [draft, setDraft] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const width = isOpen ? (isExpanded ? EXPANDED_WIDTH : PANEL_WIDTH) : COLLAPSED_SIZE;
  const height = isOpen
    ? Math.min(MAX_HEIGHT, Math.max(320, window.innerHeight - BOTTOM_OFFSET * 2))
    : COLLAPSED_SIZE;
  const x = position?.x ?? Math.max(12, window.innerWidth - SIDE_OFFSET - width);
  const y = position?.y ?? Math.max(12, window.innerHeight - BOTTOM_OFFSET - height);
  const clampedX = Math.max(8, Math.min(x, window.innerWidth - width - 8));
  const clampedY = Math.max(8, Math.min(y, window.innerHeight - height - 8));

  const locationLabel = useMemo(() => {
    if (!context?.stageId && !context?.taskId) return null;
    const stage = currentRoadmap?.stages.find((s) => s.id === context.stageId) ?? null;
    const task = stage?.tasks.find((t) => t.id === context.taskId) ?? null;
    if (task) return `${stage?.name ?? '当前阶段'} · ${task.title}`;
    if (stage) return stage.name;
    return '当前位置';
  }, [context, currentRoadmap]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isStreaming]);

  const beginDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: clampedX,
      originY: clampedY,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button, textarea, input, select, a')) return;
    beginDrag(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    const nextX = Math.max(0, Math.min(drag.originX + dx, window.innerWidth - width));
    const nextY = Math.max(0, Math.min(drag.originY + dy, window.innerHeight - height));
    setPosition(nextX, nextY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* capture already released */
    }
  };

  const handleCollapsedClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    toggleOpen();
  };

  const sendOptions = () =>
    context?.stageId || context?.taskId
      ? { stageId: context?.stageId ?? null, taskId: context?.taskId ?? null }
      : undefined;

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || isStreaming) return;
    setDraft('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    await sendMessage(content, sendOptions());
  };

  const handleRetry = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    await sendMessage(lastUser.content, sendOptions());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(96, e.target.scrollHeight)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div
      className="fixed z-50 select-none"
      style={{ left: clampedX, top: clampedY, width, height }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {!isOpen ? (
        <button
          onPointerDown={beginDrag}
          onClick={handleCollapsedClick}
          title="打 开 AI 陪 读"
          className={`w-14 h-14 rounded-full flex items-center justify-center
            border-2 border-seal-500 bg-paper dark:bg-night-200
            text-seal-500 hover:bg-seal-500 hover:text-ink-50
            shadow-ink-2 transition-colors
            ${dragging ? 'cursor-grabbing' : 'cursor-move'}`}
        >
          <Bot size={22} />
        </button>
      ) : (
        <div
          className={`flex flex-col manuscript-card overflow-hidden h-full
            ${dragging ? 'cursor-grabbing' : ''}`}
        >
          {/* 头部 — 可拖动 */}
          <div
            onPointerDown={handleHeaderPointerDown}
            className={`flex items-center gap-2 px-3 py-2.5 cursor-move
              border-b border-ink-200 dark:border-ink-700/40
              bg-ink-50/80 dark:bg-night-100/80
              ${dragging ? 'opacity-80' : ''}`}
          >
            <div className="w-8 h-8 border-2 border-seal-400 bg-paper dark:bg-night-200
              flex items-center justify-center text-seal-500 flex-shrink-0">
              <Bot size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="smallcaps text-[9px] leading-none">AI 陪 读 · COMPANION</div>
              <div className="font-display text-[13px] font-semibold text-ink-700 dark:text-ink-100
                truncate mt-1 leading-none">
                随 身 问 学
              </div>
            </div>
            {locationLabel && (
              <span
                title={locationLabel}
                className="flex items-center gap-1 border border-seal-400/60
                  bg-seal-50/60 dark:bg-seal-700/15 text-seal-500
                  px-2 py-1 min-w-0 max-w-[110px]"
              >
                <MapPin size={11} className="flex-shrink-0" />
                <span className="smallcaps text-[8px] truncate">当前位置</span>
              </span>
            )}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => setExpanded(!isExpanded)}
                title={isExpanded ? '收 窄' : '展 宽'}
                className="p-1.5 text-ink-fade hover:text-seal-500 transition-colors"
              >
                {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onClick={closeCompanion}
                title="收 起"
                className="p-1.5 text-ink-fade hover:text-seal-500 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* 消息区 */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-3
              bg-ink-50/30 dark:bg-night-100/30"
          >
            {messages.length === 0 && !isStreaming && (
              <div className="text-center py-6">
                <div className="font-display italic text-3xl text-seal-500/30 dark:text-seal-400/20 mb-3 select-none">
                  ✦
                </div>
                <p className="font-display text-[13px] font-semibold text-ink-700 dark:text-ink-100">
                  可 随 时 求 教
                </p>
                <p className="font-display italic text-[11px] text-ink-fade mt-1.5 leading-relaxed">
                  随 手 一 问,随 处 一 答。
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] border px-3 py-2
                    ${message.role === 'user'
                      ? 'bg-seal-50 dark:bg-seal-700/15 text-seal-600 dark:text-seal-200 border-seal-400/50'
                      : 'bg-paper dark:bg-night-200 text-ink-700 dark:text-ink-100 border-ink-200 dark:border-ink-700/40'
                    }`}
                  style={{ borderRadius: 2 }}
                >
                  {message.role === 'assistant' ? (
                    <div className="markdown-content prose prose-sm dark:prose-invert max-w-none text-[12px] leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[[rehypeHighlight, { lowlight }]]}
                      >
                        {sanitizeMarkdown(message.content)}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap font-display text-[12px] leading-relaxed">
                      {message.content}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {isStreaming && (
              <div className="flex justify-start">
                <div className="bg-paper dark:bg-night-200 border border-ink-200 dark:border-ink-700/40 px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-seal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-seal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-seal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="border-l-2 border-seal-400 bg-seal-50/40 dark:bg-seal-700/10 px-3 py-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={13} className="text-seal-500 mt-0.5 flex-shrink-0" />
                  <p className="font-display text-[11px] text-ink-600 dark:text-ink-200 leading-relaxed break-words">
                    {error}
                  </p>
                  <button
                    onClick={() => void handleRetry()}
                    className="ml-auto text-[10px] smallcaps text-seal-500 hover:underline flex-shrink-0"
                  >
                    重 试
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 输入区 */}
          <div className="border-t border-ink-200 dark:border-ink-700/40
            bg-ink-50/80 dark:bg-night-100/80 p-3">
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="mb-2 flex items-center gap-1 text-[10px] smallcaps text-ink-fade
                  hover:text-seal-500 transition-colors"
              >
                <Trash2 size={11} />
                清 空 对 话
              </button>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={draft}
                rows={1}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="请 问 ..."
                className="flex-1 px-3 py-2 bg-paper-fold dark:bg-night-300
                  border border-ink-300 dark:border-ink-600
                  focus:border-seal-400 outline-none resize-none
                  font-display text-xs text-ink-700 dark:text-ink-100
                  placeholder:text-ink-600 placeholder:dark:text-ink-soft
                  placeholder:font-display placeholder:italic"
              />
              <button
                onClick={() => void handleSend()}
                disabled={!draft.trim() || isStreaming}
                title="送 问"
                className="w-9 h-9 flex items-center justify-center flex-shrink-0
                  bg-seal-500 hover:bg-seal-400 text-ink-50
                  border-2 border-seal-600 transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
