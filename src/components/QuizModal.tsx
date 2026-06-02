import { useState } from 'react';
import { CheckCircle, AlertCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Quiz, QuizResult } from '../types';

interface QuizModalProps {
  stage: {
    id: string;
    name: string;
    quiz?: Quiz;
  };
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (answers: number[]) => Promise<QuizResult>;
}

export default function QuizModal({ stage, isOpen, onClose, onSubmit }: QuizModalProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !stage.quiz) return null;

  const quiz = stage.quiz;
  const question = quiz.questions[currentQuestion];

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const quizResult = await onSubmit(answers.filter((a): a is number => a !== null));
      setResult(quizResult);
    } catch (error) {
      console.error('Failed to submit quiz:', error);
    }
    setIsSubmitting(false);
  };

  const handleClose = () => {
    setResult(null);
    setCurrentQuestion(0);
    setAnswers([]);
    onClose();
  };

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-auto">
          <div className="text-center">
            {result.passed ? (
              <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
            ) : (
              <AlertCircle size={64} className="mx-auto text-red-500 mb-4" />
            )}
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
              {result.passed ? '恭喜过关!' : '需要再接再厉'}
            </h2>
            <p className="text-gray-500 mb-4">
              得分: {Math.round(result.score * 100)}%
              ({result.correctCount}/{result.totalQuestions})
            </p>

            {/* Show question feedback */}
            <div className="space-y-3 max-h-64 overflow-auto text-left">
              {result.feedback.map((fb, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg ${
                    fb.correct
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-red-50 dark:bg-red-900/20'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {fb.correct ? '✓ 正确' : '✗ 错误'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {fb.explanation}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={handleClose}
              className="mt-6 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors"
            >
              {result.passed ? '继续下一关' : '返回复习'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {stage.name} - 过关测验
            </h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
          <div className="mt-4 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {currentQuestion + 1} / {quiz.questions.length}
          </p>
        </div>

        {/* Question */}
        <div className="p-6 flex-1 overflow-auto">
          <p className="text-lg mb-6 text-gray-900 dark:text-white">{question.question}</p>
          <div className="space-y-3">
            {question.options.map((option, i) => (
              <button
                key={i}
                onClick={() => {
                  const newAnswers = [...answers];
                  newAnswers[currentQuestion] = i;
                  setAnswers(newAnswers);
                }}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  answers[currentQuestion] === i
                    ? 'bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-500'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <span className="font-medium mr-3 text-gray-900 dark:text-white">
                  {String.fromCharCode(65 + i)}.
                </span>
                <span className="text-gray-700 dark:text-gray-300">{option}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
            disabled={currentQuestion === 0}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <ChevronLeft size={18} />
            上一题
          </button>
          {currentQuestion < quiz.questions.length - 1 ? (
            <button
              onClick={() => setCurrentQuestion(currentQuestion + 1)}
              disabled={answers[currentQuestion] === null}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              下一题
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={answers.includes(null) || isSubmitting}
              className="px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? '提交中...' : '提交测验'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
