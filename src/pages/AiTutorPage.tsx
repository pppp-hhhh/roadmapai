import { useEffect, useRef, useState } from 'react';
import { Send, Trash2, Bot, User, Sparkles, BookOpen, Lightbulb, Code, Layers, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { lowlight } from '../utils/markdown';
import { useChatStore } from '../stores/useChatStore';
import { useRoadmapStore } from '../stores/useRoadmapStore';
import {
  MessageActions,
  MessageToFlashcardDrawer,
  MessageToTaskDrawer,
  PENDING_KEY,
} from '../components/ai-loop';
import { ErrorState } from '../components/states';

const suggestedPrompts = [
  { icon: BookOpen, text: '用通俗易懂的话解释一个概念', color: 'text-blue-500' },
  { icon: Lightbulb, text: '给我一些学习这个主题的建议', color: 'text-amber-500' },
  { icon: Code, text: '给我看一段代码示例', color: 'text-green-500' },
];

export default function AiTutorPage() {
  const { messages, isStreaming, error, sendMessage, clearMessages } = useChatStore();
  const { roadmaps, currentRoadmap, fetchRoadmaps, fetchRoadmap } = useRoadmapStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string>('');
  const [showRoadmapDropdown, setShowRoadmapDropdown] = useState(false);

  // AI 闭环抽屉状态
  const [flashcardDrawerMsg, setFlashcardDrawerMsg] = useState<{ id: string; content: string } | null>(null);
  const [taskDrawerMsg, setTaskDrawerMsg] = useState<{ id: string; content: string } | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    fetchRoadmaps();
  }, [fetchRoadmaps]);

  useEffect(() => {
    if (selectedRoadmapId) {
      fetchRoadmap(selectedRoadmapId);
    }
  }, [selectedRoadmapId, fetchRoadmap]);

  // 读取 sessionStorage 中的待发消息(回路 ③ 跨页接续)
  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_KEY);
    if (pending && !isStreaming) {
      sessionStorage.removeItem(PENDING_KEY);
      // 给一个 tick 让 input 挂载
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.value = pending;
          // 触发 send
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
    // 附加上下文
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestedPrompt = (text: string) => {
    if (inputRef.current) {
      inputRef.current.value = text;
      inputRef.current.focus();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="flex-shrink-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 px-8 py-5">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Bot size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI 导师</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentRoadmap && selectedRoadmapId
                  ? `当前学习：${currentRoadmap.title}`
                  : '提问以获得个性化的学习帮助'}
              </p>
            </div>
          </div>

          {/* Roadmap selector */}
          <div className="flex items-center gap-2">
            {roadmaps.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowRoadmapDropdown(!showRoadmapDropdown)}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm transition-colors ${
                    selectedRoadmapId
                      ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'
                  }`}
                >
                  <Layers size={16} />
                  <span className="max-w-[120px] truncate">
                    {selectedRoadmapId ? currentRoadmap?.title || '选择路线' : '选择学习路线'}
                  </span>
                  <ChevronDown size={14} />
                </button>
                {showRoadmapDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowRoadmapDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                      <button
                        onClick={() => { setSelectedRoadmapId(''); setShowRoadmapDropdown(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        无特定路线（通用问答）
                      </button>
                      {roadmaps.map(r => (
                        <button
                          key={r.id}
                          onClick={() => { setSelectedRoadmapId(r.id); setShowRoadmapDropdown(false); }}
                          className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                            r.id === selectedRoadmapId
                              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {r.title}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {messages.length > 0 && (
              <button onClick={clearMessages}
                className="flex items-center gap-2 px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200">
                <Trash2 size={16} />
                <span className="text-sm font-medium">清空</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/40 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-500/10">
                <Sparkles size={32} className="text-primary-600 dark:text-primary-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">开始一场对话</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
                向我询问任何学习相关的问题，请求解释，或寻求练习方面的帮助。
                {roadmaps.length > 0 && !selectedRoadmapId && (
                  <span className="block mt-2 text-primary-500">💡 选择一个学习路线，AI 将自动关联上下文</span>
                )}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
                {suggestedPrompts.map((prompt, idx) => (
                  <button key={idx} onClick={() => handleSuggestedPrompt(prompt.text)}
                    className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all duration-200 text-left">
                    <prompt.icon size={20} className={prompt.color} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(message => (
              <div key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-primary-500/20">
                    <Bot size={16} className="text-white" />
                  </div>
                )}
                <div className={`max-w-xl ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-2xl rounded-br-md px-5 py-3 shadow-lg shadow-primary-500/20'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl rounded-bl-md px-5 py-3 shadow-md border border-gray-100 dark:border-gray-700'
                }`}>
                  {message.role === 'assistant' ? (
                    message.content ? (
                      <>
                        <div className="markdown-content prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { lowlight }]]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                        <MessageActions
                          content={message.content}
                          messageId={message.id}
                          onOpenFlashcardDrawer={() =>
                            setFlashcardDrawerMsg({ id: message.id, content: message.content })
                          }
                          onOpenTaskDrawer={() =>
                            setTaskDrawerMsg({ id: message.id, content: message.content })
                          }
                        />
                      </>
                    ) : null
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{message.content.replace(/\n\n$/, '')}</p>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 dark:from-gray-500 dark:to-gray-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                    <User size={16} className="text-white" />
                  </div>
                )}
              </div>
            ))
          )}
          {isStreaming && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-primary-500/20">
                <Bot size={16} className="text-white" />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-bl-md px-5 py-4 shadow-md border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-center">
              <ErrorState
                variant="card"
                level="api"
                error={error}
                onRetry={() => sendMessage(messages[messages.length - 1]?.content ?? '')}
              />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 p-5">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-3">
          <div className="flex-1 relative">
            <textarea ref={inputRef} placeholder="请输入你的问题..." rows={1}
              onKeyDown={handleKeyDown}
              className="w-full px-5 py-3.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl resize-none outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 shadow-sm" />
          </div>
          <button type="submit" disabled={isStreaming}
            className="px-5 py-3.5 bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-2xl font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-primary-500/20 hover:shadow-xl hover:shadow-primary-500/30 disabled:shadow-none">
            <Send size={20} />
          </button>
        </form>
      </div>

      {/* AI 闭环抽屉 */}
      {flashcardDrawerMsg && (
        <MessageToFlashcardDrawer
          isOpen={!!flashcardDrawerMsg}
          onClose={() => setFlashcardDrawerMsg(null)}
          content={flashcardDrawerMsg.content}
        />
      )}
      {taskDrawerMsg && (
        <MessageToTaskDrawer
          isOpen={!!taskDrawerMsg}
          onClose={() => setTaskDrawerMsg(null)}
          content={taskDrawerMsg.content}
        />
      )}
    </div>
  );
}
