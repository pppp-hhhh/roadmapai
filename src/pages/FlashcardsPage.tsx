import { useEffect, useState } from 'react';
import { Brain, RotateCcw, ChevronRight, Plus, X, ExternalLink, BookOpen, GraduationCap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useFlashcardStore } from '../stores/useFlashcardStore';
import { openExternalLink } from '../utils/links';
import { useRoadmapStore } from '../stores/useRoadmapStore';
import { roman } from '../components/manuscript/roman';

const qualityLabels: { value: number; label: string; tone: 'seal' | 'ink' | 'gilt'; tip: string }[] = [
  { value: 0, label: '重 来', tone: 'seal', tip: '完 全 忘 记,需 要 重 新 学 习' },
  { value: 1, label: '吃 力', tone: 'seal', tip: '答 案 不 对,但 有 点 印 象' },
  { value: 2, label: '较 难', tone: 'ink',  tip: '答 错 了,但 看 答 案 后 能 理 解' },
  { value: 3, label: '良 好', tone: 'ink',  tip: '答 对 了,但 有 些 犹 豫 和 困 难' },
  { value: 4, label: '简 单', tone: 'gilt', tip: '答 对 了,稍 微 思 考 了 一 下' },
  { value: 5, label: '完 美', tone: 'gilt', tip: '完 美 回 答,完 全 不 需 要 思 考' },
];

const toneClass = (tone: 'seal' | 'ink' | 'gilt') => {
  if (tone === 'seal') return 'border-2 border-seal-400 bg-paper dark:bg-night-200 text-seal-500 hover:bg-seal-50 dark:hover:bg-seal-700/15';
  if (tone === 'gilt') return 'border-2 border-gilt-500 bg-paper dark:bg-night-200 text-gilt-500 hover:bg-gilt-500/10';
  return 'border border-ink-300 dark:border-ink-600 bg-paper dark:bg-night-200 text-ink-600 dark:text-ink-200 hover:border-seal-400 hover:text-seal-500';
};

const inputClass = `w-full px-4 py-3 bg-paper-fold dark:bg-night-300
  border-b-2 border-ink-300 dark:border-ink-600
  focus:border-seal-400 outline-none resize-none
  font-display text-sm text-ink-700 dark:text-ink-100
  placeholder:text-ink-600 placeholder:dark:text-ink-soft
  placeholder:font-display placeholder:italic`;

export default function FlashcardsPage() {
  const {
    dueCards, newCards, currentCardIndex, isReviewing, isLearning, isLoading,
    selectedCardDetail, fetchDueCards, fetchNewCards, createFlashcard, fetchFlashcardDetail,
    clearCardDetail, startReview, startLearning, reviewCard, learnCard, nextCard, endReview, reviewStats,
  } = useFlashcardStore();
  const { roadmaps, fetchRoadmaps } = useRoadmapStore();

  const [isFlipped, setIsFlipped] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCard, setNewCard] = useState({ roadmapId: '', question: '', answer: '' });
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    fetchDueCards(); fetchNewCards(); fetchRoadmaps();
  }, [fetchDueCards, fetchNewCards, fetchRoadmaps]);
  useEffect(() => { setIsFlipped(false); }, [currentCardIndex, isLearning, isReviewing]);

  const handleReview = async (quality: number) => {
    const card = dueCards[currentCardIndex];
    if (!card) return;
    await reviewCard(card.id, quality);
    await fetchDueCards();
    if (currentCardIndex < dueCards.length - 1) nextCard();
    else endReview();
  };

  const handleLearnNext = async () => {
    const card = newCards[currentCardIndex];
    if (!card) return;
    await learnCard(card.id);
    if (currentCardIndex < newCards.length - 1) nextCard();
    else endReview();
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newCard.roadmapId) { setCreateError('请 选 择 所 属 学 习 路 线'); return; }
    if (!newCard.question.trim()) { setCreateError('请 输 入 问 题'); return; }
    if (!newCard.answer.trim()) { setCreateError('请 输 入 答 案'); return; }
    try {
      await createFlashcard(newCard.roadmapId, newCard.question.trim(), newCard.answer.trim());
      setShowCreateModal(false);
      setNewCard({ roadmapId: '', question: '', answer: '' });
    } catch (e) {
      setCreateError(String(e));
    }
  };

  const handleCardClick = (cardId: string) => fetchFlashcardDetail(cardId);

  // Detail modal
  const detailModal = selectedCardDetail && (
    <div className="fixed inset-0 bg-ink-900/50 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={clearCardDetail}>
      <div className="manuscript-card max-w-2xl w-full max-h-[90vh] overflow-auto animate-ink-spread"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-ink-50/95 dark:bg-night-100/95 backdrop-blur
          border-b border-ink-200 dark:border-ink-700/40 px-7 py-5 flex items-center justify-between">
          <div>
            <div className="smallcaps">卡 片 详 情</div>
            <h2 className="font-display text-xl font-semibold text-ink-700 dark:text-ink-100 mt-1 tracking-tight">
              {selectedCardDetail.flashcard.question.length > 40
                ? selectedCardDetail.flashcard.question.slice(0, 40) + '…'
                : selectedCardDetail.flashcard.question}
            </h2>
            <p className="font-display italic text-xs text-ink-fade mt-1">{selectedCardDetail.roadmap.title}</p>
          </div>
          <button onClick={clearCardDetail} className="p-1.5 text-ink-fade hover:text-seal-500 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-7 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="border-l-2 border-seal-400 pl-4 py-2 bg-seal-50/40 dark:bg-seal-700/10">
              <div className="smallcaps text-seal-500 mb-1.5 text-[9px]">问 · QUESTION</div>
              <div className="font-display text-sm text-ink-700 dark:text-ink-100 leading-relaxed">
                {selectedCardDetail.flashcard.question}
              </div>
            </div>
            <div className="border-l-2 border-gilt-500 pl-4 py-2 bg-gilt-500/5">
              <div className="smallcaps text-gilt-500 mb-1.5 text-[9px]">答 · ANSWER</div>
              <div className="font-display text-sm text-ink-700 dark:text-ink-100 leading-relaxed">
                {selectedCardDetail.flashcard.answer}
              </div>
            </div>
          </div>
          {selectedCardDetail.resources.length > 0 && (
            <div>
              <h3 className="smallcaps mb-3 flex items-center gap-2 text-[9px]">
                <BookOpen size={11} />
                <span>相 关 学 习 资 源</span>
              </h3>
              <div className="space-y-2">
                {selectedCardDetail.resources.map((r, i) => (
                  <button onClick={() => openExternalLink(r.url)} key={i}
                    className="w-full flex items-start gap-3 p-3
                      bg-ink-50/60 dark:bg-night-200/40
                      border border-ink-200 dark:border-ink-700/40
                      hover:border-seal-400 transition-colors group text-left">
                    <ExternalLink size={14} className="text-ink-fade mt-0.5 shrink-0 group-hover:text-seal-500" />
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-sm font-medium text-ink-700 dark:text-ink-100 truncate">{r.title}</div>
                      {r.snippet && <div className="font-display italic text-xs text-ink-fade dark:text-ink-soft mt-1">{r.snippet}</div>}
                      <div className="font-mono text-[10px] text-seal-500 mt-1 truncate">{r.url}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedCardDetail.tasks.length > 0 && (
            <div>
              <h3 className="smallcaps mb-3 text-[9px]">关 联 学 习 任 务 · {selectedCardDetail.tasks.length} 个</h3>
              <div className="space-y-2">
                {selectedCardDetail.tasks.slice(0, 10).map(task => (
                  <div key={task.id} className="bg-ink-50/60 dark:bg-night-200/40
                    border border-ink-200 dark:border-ink-700/40 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="smallcaps text-[8px]">{task.task_type}</span>
                    </div>
                    <div className="font-display text-sm font-medium text-ink-700 dark:text-ink-100 mb-1">{task.title}</div>
                    <div className="font-display italic text-xs text-ink-fade dark:text-ink-soft line-clamp-3">{task.content}</div>
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
    <div className="fixed inset-0 bg-ink-900/50 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="manuscript-card max-w-lg w-full max-h-[90vh] overflow-auto animate-ink-spread">
        <div className="px-7 py-5 border-b border-ink-200 dark:border-ink-700/40 flex items-center justify-between">
          <div>
            <div className="smallcaps">制 · 新 卡</div>
            <h2 className="font-display text-xl font-semibold text-ink-700 dark:text-ink-100 mt-1 tracking-tight">创 建 记 忆 卡 片</h2>
          </div>
          <button onClick={() => { setShowCreateModal(false); setCreateError(''); setNewCard({ roadmapId: '', question: '', answer: '' }); }}
            className="p-1.5 text-ink-fade hover:text-seal-500 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleCreateCard} className="p-7 space-y-4">
          <div>
            <label className="smallcaps mb-2 block">所 属 学 习 路 线</label>
            <select value={newCard.roadmapId} onChange={e => setNewCard({ ...newCard, roadmapId: e.target.value })}
              className={inputClass}>
              <option value="">— — 请 选 择 路 线 — —</option>
              {roadmaps.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>
          <div>
            <label className="smallcaps mb-2 block">问 题</label>
            <textarea value={newCard.question} onChange={e => setNewCard({ ...newCard, question: e.target.value })}
              placeholder="输 入 你 要 记 忆 的 问 题 …" rows={3} className={inputClass} />
          </div>
          <div>
            <label className="smallcaps mb-2 block">答 案</label>
            <textarea value={newCard.answer} onChange={e => setNewCard({ ...newCard, answer: e.target.value })}
              placeholder="输 入 答 案 …" rows={3} className={inputClass} />
          </div>
          {createError && (
            <div className="border-l-2 border-seal-400 pl-3 py-2 bg-seal-50/40 dark:bg-seal-700/10
              font-display italic text-sm text-seal-500">
              {createError}
            </div>
          )}
          <button type="submit"
            className="w-full py-3 bg-seal-500 hover:bg-seal-400 text-ink-50
              transition-colors font-display text-sm border-2 border-seal-600">
            落 笔 · 制 卡
          </button>
        </form>
      </div>
    </div>
  );

  if (isLoading && newCards.length === 0 && dueCards.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="font-display italic text-ink-fade text-sm tracking-wider mb-3">墨 干 中</div>
          <div className="w-32 h-px bg-ink-200 dark:bg-ink-700 mx-auto overflow-hidden">
            <div className="h-full w-1/3 bg-seal-400 animate-flow" />
          </div>
        </div>
      </div>
    );
  }

  // LEARNING MODE
  if (isLearning && newCards.length > 0) {
    const card = newCards[currentCardIndex];
    return (
      <div className="h-full flex flex-col">
        {detailModal}
        <div className="flex-shrink-0 border-b border-ink-200 dark:border-ink-700/40
          bg-ink-50/60 dark:bg-night-100/60 px-8 py-4">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <span className="smallcaps flex items-center gap-2">
              <GraduationCap size={12} className="text-seal-500" />
              <span>学 习 中</span>
            </span>
            <span className="font-display text-sm text-ink-700 dark:text-ink-100 tabular-nums">
              第 {currentCardIndex + 1} / {newCards.length} 张
            </span>
          </div>
          <div className="flex gap-1 mt-2 max-w-lg mx-auto">
            {newCards.map((_, idx) => (
              <div key={idx} className={`flex-1 h-px transition-colors ${
                idx < currentCardIndex ? 'bg-gilt-500' : idx === currentCardIndex ? 'bg-seal-500' : 'bg-ink-200 dark:bg-ink-700'
              }`} />
            ))}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-lg">
            <div className="manuscript-card p-8 min-h-72 flex flex-col items-center justify-center">
              <div className="smallcaps mb-4 text-seal-500">新 卡 片 · 请 先 学 习</div>
              <div className="font-display text-xl font-medium text-ink-700 dark:text-ink-100 text-center mb-6">
                {card.question}
              </div>
              {isFlipped && (
                <div className="w-full border-t border-ink-200 dark:border-ink-700/40 pt-6 mt-4">
                  <div className="smallcaps text-gilt-500 mb-2 text-center">答 案</div>
                  <div className="markdown-content text-left text-ink-700 dark:text-ink-100">
                    <ReactMarkdown>{card.answer}</ReactMarkdown>
                  </div>
                </div>
              )}
              <button onClick={() => setIsFlipped(!isFlipped)}
                className="mt-6 font-display italic text-sm text-seal-500 hover:text-seal-600
                  border-b border-dotted border-seal-400/50 hover:border-seal-500">
                {isFlipped ? '收 起 答 案' : '展 答 案'}
              </button>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => handleCardClick(card.id)}
                className="flex-1 py-3 border border-ink-300 dark:border-ink-600
                  hover:border-seal-400 hover:text-seal-500 text-ink-600 dark:text-ink-200
                  transition-colors font-display text-sm bg-transparent">
                查 看 详 情
              </button>
              <button onClick={handleLearnNext}
                className="flex-1 py-3 bg-seal-500 hover:bg-seal-400 text-ink-50
                  transition-colors font-display text-sm border-2 border-seal-600">
                {currentCardIndex < newCards.length - 1 ? '已 学 会 · 续' : '完 成 学 习'}
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
        <div className="flex-shrink-0 border-b border-ink-200 dark:border-ink-700/40
          bg-ink-50/60 dark:bg-night-100/60 px-8 py-4">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <span className="font-display text-sm text-ink-fade">
              第 {currentCardIndex + 1} / {dueCards.length} 张 · 正 确 率 <span className="font-mono text-seal-500">{accuracy}%</span>
            </span>
            <div className="flex gap-1">
              {dueCards.map((_, idx) => (
                <div key={idx} className={`w-1.5 h-1.5 ${
                  idx === currentCardIndex ? 'bg-seal-500' : idx < currentCardIndex ? 'bg-gilt-500' : 'bg-ink-200 dark:bg-ink-700'
                }`} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-lg">
            <div className="relative min-h-80 cursor-pointer"
              onClick={() => setIsFlipped(!isFlipped)}
              style={{ perspective: '1000px' }}>
              <div className="absolute inset-0 transition-transform duration-500"
                style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                <div className="absolute inset-0 manuscript-card p-8 flex flex-col items-center justify-center"
                  style={{ backfaceVisibility: 'hidden' }}>
                  <div className="smallcaps text-seal-500 mb-4 text-[9px]">问 · QUESTION</div>
                  <div className="font-display text-xl font-medium text-ink-700 dark:text-ink-100 text-center">{card.question}</div>
                  <div className="mt-8 font-display italic text-xs text-ink-fade">点 击 翻 看 答 案</div>
                </div>
                <div className="absolute inset-0 manuscript-card p-8 flex flex-col items-center justify-center
                  border-seal-400 bg-seal-50/30 dark:bg-seal-700/10"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <div className="smallcaps text-seal-500 mb-4 text-[9px]">答 · ANSWER</div>
                  <div className="font-display text-lg font-medium text-ink-700 dark:text-ink-100 text-center whitespace-pre-wrap">{card.answer}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {isFlipped && (
          <div className="flex-shrink-0 border-t border-ink-200 dark:border-ink-700/40
            bg-ink-50/60 dark:bg-night-100/60 p-6">
            <div className="text-center font-display italic text-[10px] text-ink-fade mb-3">
              你 的 回 忆 程 度 如 何?← 越 往 右 越 熟 练 →
            </div>
            <div className="flex justify-center gap-2">
              <div className="flex gap-2 border-r border-ink-200 dark:border-ink-700/40 pr-3 mr-1">
                {qualityLabels.slice(0, 3).map(({ value, label, tone, tip }) => (
                  <button key={value} onClick={() => handleReview(value)} title={tip}
                    className={`px-3 py-2.5 hover:scale-105 active:scale-95
                      flex flex-col items-center w-16 transition-all ${toneClass(tone)}`}>
                    <span className="font-display italic text-sm mb-0.5">{roman(value + 1)}</span>
                    <span className="text-[10px] font-medium">{label}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {qualityLabels.slice(3, 6).map(({ value, label, tone, tip }) => (
                  <button key={value} onClick={() => handleReview(value)} title={tip}
                    className={`px-4 py-3 hover:scale-105 active:scale-95
                      flex flex-col items-center w-20 transition-all ${toneClass(tone)}`}>
                    <span className="font-display italic text-lg mb-0.5">{roman(value + 1)}</span>
                    <span className="text-[11px] font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Review complete
  if (reviewStats.total > 0 && !isReviewing) {
    const accuracy = Math.round((reviewStats.correct / reviewStats.total) * 100);
    return (
      <div className="h-full overflow-auto p-8">
        {showCreateModal && createModal}{detailModal}
        <div className="max-w-md mx-auto text-center py-16 animate-ink-spread">
          <div className="font-display italic text-6xl text-gilt-500/40 mb-6 select-none">❦</div>
          <div className="smallcaps mb-3 text-gilt-500">— 完 卷 —</div>
          <h2 className="font-display text-4xl font-semibold text-ink-700 dark:text-ink-100 mb-3 tracking-tight">
            复 习 完 毕
          </h2>
          <p className="font-display italic text-sm text-ink-fade dark:text-ink-soft mb-8">
            本 轮 {reviewStats.total} 张 · 正 确 率 <span className="font-mono text-seal-500">{accuracy}%</span>
          </p>
          <button onClick={() => { fetchDueCards(); fetchNewCards(); }}
            className="px-6 py-3 bg-seal-500 hover:bg-seal-400 text-ink-50
              transition-colors font-display text-sm border-2 border-seal-600
              inline-flex items-center gap-2">
            <RotateCcw size={16} />
            <span>续 复 习</span>
          </button>
        </div>
      </div>
    );
  }

  // IDLE / HOME
  return (
    <div className="h-full overflow-auto">
      {showCreateModal && createModal}{detailModal}
      <div className="max-w-2xl mx-auto px-12 py-10">
        <header className="text-center mb-10 animate-ink-spread">
          <div className="w-16 h-16 border-2 border-seal-400 bg-paper dark:bg-night-200
            flex items-center justify-center mx-auto mb-5 text-seal-500">
            <Brain size={28} />
          </div>
          <div className="smallcaps mb-3">第 七 章 · 温 故</div>
          <h1 className="font-display text-5xl font-semibold text-ink-700 dark:text-ink-100 tracking-tight leading-none">
            <span className="italic text-seal-500">记</span>忆 卡 片
          </h1>
          <p className="font-display italic text-base text-ink-fade dark:text-ink-soft mt-3">
            先 学 习 新 内 容,再 通 过 间 隔 重 复 强 化 记 忆。
          </p>
          <div className="rule-gilt mt-5 max-w-xs mx-auto" />
        </header>

        {/* Stats 双联 */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="manuscript-card p-6 relative overflow-hidden">
            <span aria-hidden className="absolute top-2 right-3 font-display italic text-2xl
              text-ink-200/60 dark:text-ink-700/60 select-none pointer-events-none">I</span>
            <div className="w-10 h-10 border-2 border-seal-400 bg-paper dark:bg-night-200
              flex items-center justify-center text-seal-500 mb-3">
              <GraduationCap size={18} />
            </div>
            <div className="smallcaps mb-1.5 text-[9px]">待 学 习</div>
            <div className="font-display text-4xl font-semibold text-ink-700 dark:text-ink-100 tabular-nums">{newCards.length}</div>
            <div className="font-mono text-[10px] text-ink-fade mt-1.5">张 新 卡 片 · 需 先 学 习</div>
          </div>
          <div className="manuscript-card p-6 relative overflow-hidden">
            <span aria-hidden className="absolute top-2 right-3 font-display italic text-2xl
              text-ink-200/60 dark:text-ink-700/60 select-none pointer-events-none">II</span>
            <div className="w-10 h-10 border-2 border-gilt-500 bg-paper dark:bg-night-200
              flex items-center justify-center text-gilt-500 mb-3">
              <RotateCcw size={18} />
            </div>
            <div className="smallcaps mb-1.5 text-[9px]">待 复 习</div>
            <div className="font-display text-4xl font-semibold text-ink-700 dark:text-ink-100 tabular-nums">{dueCards.length}</div>
            <div className="font-mono text-[10px] text-ink-fade mt-1.5">张 到 期 · 间 隔 重 复</div>
          </div>
        </div>

        {/* 主操作 */}
        <div className="space-y-3">
          {newCards.length > 0 && (
            <button onClick={startLearning}
              className="w-full flex items-center justify-between p-4
                bg-ink-50/60 dark:bg-night-200/40
                border border-ink-200 dark:border-ink-700/40
                hover:border-seal-400 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 border-2 border-seal-400 bg-paper dark:bg-night-200
                  flex items-center justify-center text-seal-500">
                  <GraduationCap size={18} />
                </div>
                <div className="text-left">
                  <div className="font-display text-base font-semibold text-ink-700 dark:text-ink-100">学 习 新 卡 片</div>
                  <div className="font-display italic text-[11px] text-ink-fade mt-0.5">逐 张 浏 览 · 已 学 会 入 复 习 队 列</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-ink-fade group-hover:text-seal-500 transition-colors" />
            </button>
          )}

          {dueCards.length > 0 && (
            <button onClick={startReview}
              className="w-full flex items-center justify-between p-4
                bg-ink-50/60 dark:bg-night-200/40
                border border-ink-200 dark:border-ink-700/40
                hover:border-gilt-500 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 border-2 border-gilt-500 bg-paper dark:bg-night-200
                  flex items-center justify-center text-gilt-500">
                  <RotateCcw size={18} />
                </div>
                <div className="text-left">
                  <div className="font-display text-base font-semibold text-ink-700 dark:text-ink-100">开 始 复 习</div>
                  <div className="font-display italic text-[11px] text-ink-fade mt-0.5">SM-2 间 隔 重 复 · {dueCards.length} 张 到 期</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-ink-fade group-hover:text-gilt-500 transition-colors" />
            </button>
          )}

          <button onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center gap-2 p-3
              border border-dashed border-ink-300 dark:border-ink-600
              hover:border-seal-400 hover:text-seal-500 text-ink-fade
              transition-colors font-display text-sm bg-transparent">
            <Plus size={16} />
            <span>手 动 制 卡</span>
          </button>
        </div>

        {/* 待学习列表 */}
        {newCards.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="smallcaps">待 学 习 列 表</div>
              <div className="flex-1 h-px bg-ink-200/60 dark:bg-ink-700/40" />
            </div>
            <div className="space-y-2">
              {newCards.map(card => (
                <div key={card.id} onClick={() => handleCardClick(card.id)}
                  className="manuscript-card p-3 cursor-pointer hover:border-seal-400 transition-colors">
                  <div className="font-display text-sm font-semibold text-ink-700 dark:text-ink-100 line-clamp-1">{card.question}</div>
                  <div className="font-display italic text-xs text-ink-fade dark:text-ink-soft line-clamp-1 mt-1">{card.answer}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {newCards.length === 0 && dueCards.length === 0 && (
          <div className="text-center py-12 manuscript-card mt-6">
            <div className="font-display italic text-5xl text-gilt-500/40 mb-3 select-none">❦</div>
            <div className="smallcaps mb-2 text-gilt-500">— 完 卷 —</div>
            <h3 className="font-display text-2xl font-semibold text-ink-700 dark:text-ink-100 mb-2 tracking-tight">
              已 无 卡 待 习
            </h3>
            <p className="font-display italic text-sm text-ink-fade dark:text-ink-soft mb-6">
              已 掌 握 所 有 内 容,或 创 建 新 路 线 以 生 成 卡 片
            </p>
            <button onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-seal-500 hover:bg-seal-400 text-ink-50
                transition-colors font-display text-sm border-2 border-seal-600
                inline-flex items-center gap-2">
              <Plus size={16} />
              <span>制 新 卡</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
