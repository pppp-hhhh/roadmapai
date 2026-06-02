import { useEffect, useRef } from 'react';
import { Send, Trash2, Bot, User, Sparkles, BookOpen, Lightbulb, Code } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { useChatStore } from '../stores/useChatStore';

const suggestedPrompts = [
  { icon: BookOpen, text: '用通俗易懂的话解释一个概念', color: 'text-blue-500' },
  { icon: Lightbulb, text: '给我一些学习这个主题的建议', color: 'text-amber-500' },
  { icon: Code, text: '给我看一段代码示例', color: 'text-green-500' },
];

export default function AiTutorPage() {
  const { messages, isStreaming, error, sendMessage, clearMessages } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = inputRef.current;
    if (!input || !input.value.trim() || isStreaming) return;

    const message = input.value.trim();
    input.value = '';
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
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
                提问以获得个性化的学习帮助
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="flex items-center gap-2 px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200"
            >
              <Trash2 size={16} />
              <span className="text-sm font-medium">清空</span>
            </button>
          )}
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
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                开始一场对话
              </h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
                向我询问任何学习相关的问题，请求解释，或寻求练习方面的帮助。
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
                {suggestedPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (inputRef.current) {
                        inputRef.current.value = prompt.text;
                        inputRef.current.focus();
                      }
                    }}
                    className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all duration-200 text-left"
                  >
                    <prompt.icon size={20} className={prompt.color} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(message => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-primary-500/20">
                    <Bot size={16} className="text-white" />
                  </div>
                )}
                <div
                  className={`max-w-xl ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-2xl rounded-br-md px-5 py-3 shadow-lg shadow-primary-500/20'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl rounded-bl-md px-5 py-3 shadow-md border border-gray-100 dark:border-gray-700'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    message.content ? (
                      <div className="markdown-content prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : null
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
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
            <div className="flex gap-4 justify-center">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-5 py-3 text-red-600 dark:text-red-400 text-sm shadow-md">
                {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 p-5">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex gap-3"
        >
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              placeholder="请输入你的问题..."
              rows={1}
              onKeyDown={handleKeyDown}
              className="w-full px-5 py-3.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl resize-none outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 shadow-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isStreaming}
            className="px-5 py-3.5 bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-2xl font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-primary-500/20 hover:shadow-xl hover:shadow-primary-500/30 disabled:shadow-none"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
