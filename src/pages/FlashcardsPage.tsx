import { useEffect, useState } from 'react';
import { Brain, RotateCcw, ChevronRight, PartyPopper, Plus, X, ExternalLink, BookOpen, GraduationCap } from 'lucide-react';
import { useFlashcardStore } from '../stores/useFlashcardStore';
import { openExternalLink } from '../utils/links';
import { useRoadmapStore } from '../stores/useRoadmapStore';

const qualityLabels = [
  { value: 0, label: '重来', color: 'bg-red-500 hover:bg-red-600', emoji: '😢' },
  { value: 1, label: '吃力', color: 'bg-orange-500 hover:bg-orange-600', emoji: '😓' },
  { value: 2, label: '较难', color: 'bg-yellow-500 hover:bg-yellow-600', emoji: '😐' },
  { value: 3, label: '良好', color: 'bg-lime-500 hover:bg-lime-600', emoji: '🙂' },
  { value: 4, label: '简单', color: 'bg-green-500 hover:bg-green-600', emoji: '😊' },
  { value: 5, label: '完美', color: 'bg-emerald-500 hover:bg-emerald-600', emoji: '🤩' },
];

export default function FlashcardsPage() {
  const {
    dueCards,
    newCards,
    currentCardIndex,
    isReviewing,
    isLearning,
    isLoading,
    selectedCardDetail,
    fetchDueCards,
    fetchNewCards,
    createFlashcard,
    fetchFlashcardDetail,
    clearCardDetail,
    startReview,
    startLearning,
    reviewCard,
    learnCard,
    nextCard,
    endReview,
    reviewStats,
  } = useFlashcardStore();

  const { roadmaps, fetchRoadmaps } = useRoadmapStore();

  const [isFlipped, setIsFlipped] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCard, setNewCard] = useState({ roadmapId: '', question: '', answer: '' });
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    fetchDueCards();
    fetchNewCards();
    fetchRoadmaps();
  }, [fetchDueCards, fetchNewCards, fetchRoadmaps]);

  useEffect(() => {
    setIsFlipped(false);
  }, [currentCardIndex, isLearning, isReviewing]);

  const handleReview = async (quality: number) => {
    const card = dueCards[currentCardIndex];
    if (!card) return;
    await reviewCard(card.id, quality);
    await fetchDueCards();
    if (currentCardIndex < dueCards.length - 1) {
      nextCard();
    } else {
      endReview();
    }
  };

  const handleLearnNext = async () => {
    const card = newCards[currentCardIndex];
    if (!card) return;
    await learnCard(card.id);
    if (currentCardIndex < newCards.length - 1) {
      nextCard();
    } else {
      endReview();
    }
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newCard.roadmapId) { setCreateError('请选择所属学习路线'); return; }
    if (!newCard.question.trim()) { setCreateError('请输入问题'); return; }
    if (!newCard.answer.trim()) { setCreateError('请输入答案'); return; }
    try {
      await createFlashcard(newCard.roadmapId, newCard.question.trim(), newCard.answer.trim());
      setShowCreateModal(false);
      setNewCard({ roadmapId: '', question: '', answer: '' });
    } catch (e) {
      setCreateError(String(e));
    }
  };

  const handleCardClick = (cardId: string) => {
    fetchFlashcardDetail(cardId);
  };

  // Detail modal
  const detailModal = selectedCardDetail && (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={clearCardDetail}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">卡片详情</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedCardDetail.roadmap.title}</p>
          </div>
          <button onClick={clearCardDetail} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">问题</div>
              <div className="text-sm text-gray-900 dark:text-white">{selectedCardDetail.flashcard.question}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">答案</div>
              <div className="text-sm text-gray-900 dark:text-white">{selectedCardDetail.flashcard.answer}</div>
            </div>
          </div>
          {selectedCardDetail.resources.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <BookOpen size={16} />相关学习资源
              </h3>
              <div className="space-y-2">
                {selectedCardDetail.resources.map((r, i) => (
                  <button onClick={() => openExternalLink(r.url)} key={i} 
                    className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group">
                    <ExternalLink size={16} className="text-gray-400 mt-0.5 shrink-0 group-hover:text-primary-500" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.title}</div>
                      {r.snippet && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{r.snippet}</div>}
                      <div className="text-xs text-primary-500 mt-1 truncate">{r.url}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedCardDetail.tasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">关联学习任务（{selectedCardDetail.tasks.length} 个）</h3>
              <div className="space-y-3">
                {selectedCardDetail.tasks.slice(0, 10).map(task => (
                  <div key={task.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded">{task.task_type}</span>
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">{task.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3">{task.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Create modal
  const createModal = (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">创建记忆卡片</h2>
          <button onClick={() => { setShowCreateModal(false); setCreateError(''); setNewCard({ roadmapId: '', question: '', answer: '' }); }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleCreateCard} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">所属学习路线</label>
            <select value={newCard.roadmapId} onChange={e => setNewCard({ ...newCard, roadmapId: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">-- 请选择路线 --</option>
              {roadmaps.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">问题</label>
            <textarea value={newCard.question} onChange={e => setNewCard({ ...newCard, question: e.target.value })}
              placeholder="输入你要记忆的问题..." rows={3}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">答案</label>
            <textarea value={newCard.answer} onChange={e => setNewCard({ ...newCard, answer: e.target.value })}
              placeholder="输入答案..." rows={3}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          {createError && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 text-sm">{createError}</div>}
          <button type="submit" className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium">创建卡片</button>
        </form>
      </div>
    </div>
  );

  if (isLoading && newCards.length === 0 && dueCards.length === 0) {
    return <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  }

  // LEARNING MODE: walk through new cards one by one
  if (isLearning && newCards.length > 0) {
    const card = newCards[currentCardIndex];
    return (
      <div className="h-full flex flex-col">
        {detailModal}
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-4">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <GraduationCap size={16} className="text-blue-500" />学习中
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              第 {currentCardIndex + 1} / {newCards.length} 张
            </span>
          </div>
          <div className="flex gap-1 mt-2 max-w-lg mx-auto">
            {newCards.map((_, idx) => (
              <div key={idx} className={`flex-1 h-1 rounded-full transition-colors ${
                idx < currentCardIndex ? 'bg-green-500' : idx === currentCardIndex ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
              }`} />
            ))}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-lg">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 min-h-72 flex flex-col items-center justify-center">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">新卡片 · 请先学习</div>
              <div className="text-xl font-medium text-gray-900 dark:text-white text-center mb-6">
                {card.question}
              </div>
              {isFlipped && (
                <div className="w-full border-t border-gray-100 dark:border-gray-700 pt-6 mt-4">
                  <div className="text-sm text-primary-600 dark:text-primary-400 mb-2 text-center">答案</div>
                  <div className="text-lg text-gray-900 dark:text-white text-center whitespace-pre-wrap">
                    {card.answer}
                  </div>
                </div>
              )}
              <button onClick={() => setIsFlipped(!isFlipped)}
                className="mt-6 text-sm text-primary-500 hover:text-primary-600">
                {isFlipped ? '隐藏答案' : '显示答案'}
              </button>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => handleCardClick(card.id)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600">
                查看详情/资源
              </button>
              <button onClick={handleLearnNext}
                className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium">
                {currentCardIndex < newCards.length - 1 ? '已学会，下一张 →' : '完成学习'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // REVIEWING MODE
  if (isReviewing && dueCards.length > 0) {
    const card = dueCards[currentCardIndex];
    const accuracy = reviewStats.total > 0 ? Math.round((reviewStats.correct / reviewStats.total) * 100) : 0;

    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-4">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <span className="text-sm text-gray-500 dark:text-gray-400">第 {currentCardIndex + 1} / {dueCards.length} 张 · 正确率 {accuracy}%</span>
            <div className="flex gap-1">
              {dueCards.map((_, idx) => (
                <div key={idx} className={`w-2 h-2 rounded-full ${
                  idx === currentCardIndex ? 'bg-primary-500' : idx < currentCardIndex ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-lg">
            <div className="relative min-h-80 cursor-pointer" onClick={() => setIsFlipped(!isFlipped)} style={{ perspective: '1000px' }}>
              <div className="absolute inset-0 transition-transform duration-500"
                style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                <div className="absolute inset-0 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center justify-center"
                  style={{ backfaceVisibility: 'hidden' }}>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">问题</div>
                  <div className="text-xl font-medium text-gray-900 dark:text-white text-center">{card.question}</div>
                  <div className="mt-8 text-sm text-gray-400">点击查看答案</div>
                </div>
                <div className="absolute inset-0 bg-primary-50 dark:bg-primary-900/20 rounded-2xl shadow-lg border border-primary-200 dark:border-primary-800 p-8 flex flex-col items-center justify-center"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <div className="text-sm text-primary-600 dark:text-primary-400 mb-4">答案</div>
                  <div className="text-lg font-medium text-gray-900 dark:text-white text-center whitespace-pre-wrap">{card.answer}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {isFlipped && (
          <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6">
            <div className="flex justify-center gap-3">
              {qualityLabels.map(({ value, label, color, emoji }) => (
                <button key={value} onClick={() => handleReview(value)}
                  className={`${color} text-white px-4 py-3 rounded-xl hover:scale-105 active:scale-95 flex flex-col items-center min-w-20`}>
                  <span className="text-xl mb-1">{emoji}</span>
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Review complete screen
  if (reviewStats.total > 0 && !isReviewing) {
    const accuracy = Math.round((reviewStats.correct / reviewStats.total) * 100);
    return (
      <div className="h-full overflow-auto p-8">
        {showCreateModal && createModal}{detailModal}
        <div className="max-w-md mx-auto text-center py-16">
          <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <PartyPopper size={48} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">复习完成！</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">本轮复习 {reviewStats.total} 张 · 正确率 {accuracy}%</p>
          <button onClick={() => { fetchDueCards(); fetchNewCards(); }}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl">
            <RotateCcw size={20} className="inline mr-2" />继续
          </button>
        </div>
      </div>
    );
  }

  // IDLE / HOME SCREEN — show stats and entry points
  return (
    <div className="h-full overflow-auto p-8">
      {showCreateModal && createModal}{detailModal}
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Brain size={40} className="text-primary-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">记忆卡片</h1>
          <p className="text-gray-500 dark:text-gray-400">先学习新内容，再通过间隔重复强化记忆</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap size={20} className="text-blue-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">待学习</span>
            </div>
            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">{newCards.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">张新卡片</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <RotateCcw size={20} className="text-orange-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">待复习</span>
            </div>
            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">{dueCards.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">张到期卡片</div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {newCards.length > 0 && (
            <button onClick={startLearning}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl transition-colors">
              <div className="flex items-center gap-3">
                <GraduationCap size={24} />
                <div className="text-left">
                  <div className="font-semibold">学习新卡片</div>
                  <div className="text-xs opacity-90">先读懂并记忆 {newCards.length} 张新内容</div>
                </div>
              </div>
              <ChevronRight size={20} />
            </button>
          )}

          {dueCards.length > 0 && (
            <button onClick={startReview}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-2xl transition-colors">
              <div className="flex items-center gap-3">
                <RotateCcw size={24} />
                <div className="text-left">
                  <div className="font-semibold">开始复习</div>
                  <div className="text-xs opacity-90">用 SM-2 算法巩固 {dueCards.length} 张已学内容</div>
                </div>
              </div>
              <ChevronRight size={20} />
            </button>
          )}

          <button onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700">
            <Plus size={20} />手动创建卡片
          </button>
        </div>

        {/* New cards preview */}
        {newCards.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">待学习列表</h3>
            <div className="space-y-2">
              {newCards.map(card => (
                <div key={card.id} onClick={() => handleCardClick(card.id)}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:border-primary-400 transition-colors">
                  <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{card.question}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-1">{card.answer}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {newCards.length === 0 && dueCards.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">没有需要学习的卡片</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">已掌握所有内容，或创建一条新学习路线以生成卡片</p>
            <button onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl">
              <Plus size={20} className="inline mr-2" />创建新卡片
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
