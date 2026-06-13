import { useEffect, useRef, useState } from 'react';
import { Send, Trash2, Bot, User, BookOpen, Lightbulb, Code, Layers, ChevronDown, Feather } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { lowlight, sanitizeMarkdown } from '../utils/markdown';
import { useChatStore } from '../stores/useChatStore';
import { useRoadmapStore } from '../stores/useRoadmapStore';
import {
  MessageActions,
  MessageToFlashcardDrawer,
  MessageToTaskDrawer,
  PENDING_KEY,
} from '../components/ai-loop';
import { ErrorState } from '../components/states';
import { roman } from '../components/manuscript/roman';

const suggestedPrompts = [
  { icon: BookOpen,  text: '用 通 俗 易 懂 的 话 解 释 一 个 概 念' },
  { icon: Lightbulb, text: '给 我 一 些 学 习 这 个 主 题 的 建 议' },
  { icon: Code,      text: '给 我 看 一 段 代 码 示 例' },
];

export default function AiTutorPage() {
  const { messages, isStreaming, error, sendMessage, clearMessages } = useChatStore();
  const { roadmaps, currentRoadmap, fetchRoadmaps, fetchRoadmap } = useRoadmapStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string>('');
  const [showRoadmapDropdown, setShowRoadmapDropdown] = useState(false);

  const [flashcardDrawerMsg, setFlashcardDrawerMsg] = useState<{ id: string; content: string } | null>(null);
  const [taskDrawerMsg, setTaskDrawerMsg] = useState<{ id: string; content: string } | null>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { fetchRoadmaps(); }, [fetchRoadmaps]);
  useEffect(() => { if (selectedRoadmapId) fetchRoadmap(selectedRoadmapId); }, [selectedRoadmapId, fetchRoadmap]);

  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_KEY);
    if (pending && !isStreaming) {
      sessionStorage.removeItem(PENDING_KEY);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.value = pending;
          const ev = new Event('submit', { bubbles: true, cancelable: true });
          (inputRef.current.form as HTMLFormElement | null)?.dispatchEvent(ev);
        }
      }, 0);
    }
  }, [isStreaming]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = inputRef.current;
    if (!input || !input.value.trim() || isStreaming) return;
    let message = input.value.trim();
    if (currentRoadmap && selectedRoadmapId) {
      const unlockedStage = currentRoadmap.stages.find(s => !s.isLocked);
      const context = unlockedStage
        ? `（背景：我正在学习「${currentRoadmap.title}」，当前阶段「${unlockedStage.name}」，请围绕此上下文回答）\n\n${message}`
        : `（背景：我正在学习「${currentRoadmap.title}」，请围绕此上下文回答）\n\n${message}`;
      message = context;
    }
    input.value = '';
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  };

  const handleSuggestedPrompt = (text: string) => {
    if (inputRef.current) {
      inputRef.current.value = text;
      inputRef.current.focus();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <header className="flex-shrink-0 border-b border-ink-200 dark:border-ink-700/40
        bg-gradient-to-b from-ink-50 to-transparent dark:from-night-100 dark:to-transparent">
        <div className="flex items-center justify-between max-w-3xl mx-auto px-12 pt-7 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 border-2 border-seal-400 bg-paper dark:bg-night-200 flex items-center justify-center text-seal-500">
              <Feather size={22} />
            </div>
            <div>
              <div className="smallcaps mb-1">第 四 章 · 问 学</div>
              <h1 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-none">
                AI 导 师
              </h1>
              <p className="font-display italic text-sm text-ink-fade dark:text-ink-soft mt-1">
                {currentRoadmap && selectedRoadmapId
                  ? `正 在 学 习 · ${currentRoadmap.title}`
                  : '提 问 以 获 得 个 性 化 的 学 习 帮 助'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {roadmaps.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowRoadmapDropdown(!showRoadmapDropdown)}
                  className="flex items-center gap-2 px-3 py-2
                    bg-ink-50/60 dark:bg-night-200/40
                    border border-ink-300 dark:border-ink-600
                    hover:border-seal-400 transition-colors
                    font-display text-sm text-ink-700 dark:text-ink-100"
                >
                  <Layers size={14} className="text-seal-500" />
                  <span className="max-w-[140px] truncate">
                    {selectedRoadmapId ? currentRoadmap?.title || '选择路线' : '选 择 学 习 路 线'}
                  </span>
                  <ChevronDown size={14} className={`text-ink-fade transition-transform ${showRoadmapDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showRoadmapDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowRoadmapDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-60 manuscript-card p-1 shadow-ink-2 animate-ink-spread">
                      <button
                        onClick={() => { setSelectedRoadmapId(''); setShowRoadmapDropdown(false); }}
                        className="w-full text-left px-3 py-2 font-display text-sm text-ink-fade
                          hover:bg-ink-100/50 dark:hover:bg-night-300/50 transition-colors"
                      >
                        无特定路线（通用问答）
                      </button>
                      {roadmaps.map((r, i) => (
                        <button
                          key={r.id}
                          onClick={() => { setSelectedRoadmapId(r.id); setShowRoadmapDropdown(false); }}
                          className={`w-full text-left px-3 py-2 font-display text-sm transition-colors flex items-center gap-2
                            ${r.id === selectedRoadmapId
                              ? 'bg-seal-50/60 dark:bg-seal-700/15 text-seal-500'
                              : 'text-ink-700 dark:text-ink-200 hover:bg-ink-100/50 dark:hover:bg-night-300/50'
                            }`}
                        >
                          <span className="font-display italic text-[10px] text-ink-fade w-4 tabular-nums">{roman(i + 1)}</span>
                          <span className="truncate">{r.title}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {messages.length > 0 && (
              <button onClick={clearMessages}
                className="flex items-center gap-2 px-3 py-2 font-display text-sm
                  text-ink-fade hover:text-seal-500 hover:bg-ink-100/50 dark:hover:bg-night-300/50 transition-colors">
                <Trash2 size={14} />
                <span>清 空</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 消息区 */}
      <div className="flex-1 overflow-auto px-12 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-10 animate-ink-spread">
              <div className="font-display italic text-6xl text-seal-500/30 dark:text-seal-400/20 mb-6 select-none">
                ✦
              </div>
              <h2 className="font-display text-3xl font-semibold text-ink-700 dark:text-ink-100 mb-3 tracking-tight">
                开 始 一 场 对 话
              </h2>
              <p className="font-display italic text-base text-ink-fade dark:text-ink-soft max-w-md mx-auto leading-relaxed mb-2">
                向 我 询 问 任 何 学 习 相 关 的 问 题,请 求 解 释,或 寻 求 练 习 方 面 的 帮 助。
              </p>
              {roadmaps.length > 0 && !selectedRoadmapId && (
                <p className="font-display italic text-sm text-seal-500 max-w-md mx-auto mb-8">
                  💡 选 择 一 个 学 习 路 线,AI 将 自 动 关 联 上 下 文
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto mt-8">
                {suggestedPrompts.map((prompt, idx) => (
                  <button key={idx} onClick={() => handleSuggestedPrompt(prompt.text)}
                    className="flex items-center gap-3 p-4 text-left
                      bg-ink-50/60 dark:bg-night-200/40
                      border border-ink-200 dark:border-ink-700/40
                      hover:border-seal-400 hover:bg-ink-50 dark:hover:bg-night-100/60
                      transition-all group"
                  >
                    <span className="font-display italic text-xs text-ink-fade/70 w-5 tabular-nums">{roman(idx + 1)}</span>
                    <prompt.icon size={18} className="text-seal-500 flex-shrink-0" />
                    <span className="font-display text-[13px] text-ink-700 dark:text-ink-100 leading-relaxed">
                      {prompt.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(message => (
              <div key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && (
                  <div className="w-9 h-9 border-2 border-seal-400 bg-paper dark:bg-night-200 flex items-center justify-center flex-shrink-0">
                    <Bot size={16} className="text-seal-500" />
                  </div>
                )}
                <div className={`max-w-xl border
                  ${message.role === 'user'
                    ? 'bg-seal-50 dark:bg-seal-700/15 text-seal-600 dark:text-seal-200 border-seal-400/50'
                    : 'bg-paper dark:bg-night-200 text-ink-700 dark:text-ink-100 border-ink-200 dark:border-ink-700/40'
                  }`}
                  style={{ borderRadius: '2px 2px 2px 0' }}
                >
                  {message.role === 'assistant' ? (
                    message.content ? (
                      <>
                        <div className="markdown-content prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { lowlight }]]}>
                            {sanitizeMarkdown(message.content)}
                          </ReactMarkdown>
                        </div>
                        <MessageActions
                          content={message.content}
                          messageId={message.id}
                          onOpenFlashcardDrawer={() => setFlashcardDrawerMsg({ id: message.id, content: message.content })}
                          onOpenTaskDrawer={() => setTaskDrawerMsg({ id: message.id, content: message.content })}
                        />
                      </>
                    ) : null
                  ) : (
                    <p className="whitespace-pre-wrap text-sm font-display leading-relaxed">{message.content.replace(/\n\n$/, '')}</p>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="w-9 h-9 border-2 border-ink-300 dark:border-ink-600 bg-ink-50 dark:bg-night-200 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-ink-500 dark:text-ink-200" />
                  </div>
                )}
              </div>
            ))
          )}
          {isStreaming && (
            <div className="flex gap-3 justify-start">
              <div className="w-9 h-9 border-2 border-seal-400 bg-paper dark:bg-night-200 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-seal-500" />
              </div>
              <div className="bg-paper dark:bg-night-200 border border-ink-200 dark:border-ink-700/40 px-5 py-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-seal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-seal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-seal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-center">
              <ErrorState variant="card" level="api" error={error}
                onRetry={() => sendMessage(messages[messages.length - 1]?.content ?? '')} />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区 */}
      <footer className="flex-shrink-0 border-t border-ink-200 dark:border-ink-700/40
        bg-ink-50/60 dark:bg-night-100/60 p-5">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-3">
          <div className="flex-1 relative">
            <textarea ref={inputRef} placeholder="请 输 入 你 的 问 题 ..." rows={1}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 bg-paper-fold dark:bg-night-300
                border border-ink-300 dark:border-ink-600
                focus:border-seal-400 outline-none resize-none
                font-display text-sm text-ink-700 dark:text-ink-100
                placeholder:text-ink-600 placeholder:dark:text-ink-soft
                placeholder:font-display placeholder:italic" />
          </div>
          <button type="submit" disabled={isStreaming}
            className="px-4 py-3 bg-seal-500 hover:bg-seal-400 text-ink-50
              transition-colors border-2 border-seal-600
              disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center gap-2 font-display text-sm"
          >
            <Send size={18} />
            <span>送 问</span>
          </button>
        </form>
      </footer>

      {flashcardDrawerMsg && (
        <MessageToFlashcardDrawer isOpen={!!flashcardDrawerMsg} onClose={() => setFlashcardDrawerMsg(null)} content={flashcardDrawerMsg.content} />
      )}
      {taskDrawerMsg && (
        <MessageToTaskDrawer isOpen={!!taskDrawerMsg} onClose={() => setTaskDrawerMsg(null)} content={taskDrawerMsg.content} />
      )}
    </div>
  );
}
