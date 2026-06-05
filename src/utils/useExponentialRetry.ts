import { useCallback, useEffect, useRef, useState } from 'react';

interface UseExponentialRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onError?: (error: unknown, attempt: number) => void;
}

interface UseExponentialRetryResult {
  retry: () => Promise<void>;
  reset: () => void;
  attempt: number;
  isRetrying: boolean;
  lastError: unknown;
}

/**
 * 指数退避重试 hook。
 * 用法：
 *   const { retry, isRetrying, attempt, reset } = useExponentialRetry(async () => {
 *     await invoke('xxx');
 *   }, { maxAttempts: 3 });
 *
 * 重试间隔：baseDelayMs * 2^(attempt-1)，封顶 maxDelayMs。
 */
export function useExponentialRetry(
  fn: () => Promise<unknown>,
  options: UseExponentialRetryOptions = {},
): UseExponentialRetryResult {
  const { maxAttempts = 3, baseDelayMs = 1000, maxDelayMs = 8000, onError } = options;

  const [attempt, setAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastError, setLastError] = useState<unknown>(null);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const reset = useCallback(() => {
    cancelledRef.current = true;
    clearTimer();
    setAttempt(0);
    setIsRetrying(false);
    setLastError(null);
  }, []);

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const retry = useCallback(async () => {
    cancelledRef.current = false;
    setIsRetrying(true);
    setLastError(null);

    let currentAttempt = 0;
    // 第一次执行不算 attempt
    while (currentAttempt <= maxAttempts) {
      if (cancelledRef.current) {
        setIsRetrying(false);
        return;
      }
      try {
        await fn();
        setAttempt(0);
        setIsRetrying(false);
        return;
      } catch (err) {
        currentAttempt += 1;
        setAttempt(currentAttempt);
        setLastError(err);
        onError?.(err, currentAttempt);

        if (currentAttempt >= maxAttempts) {
          setIsRetrying(false);
          throw err;
        }

        const delay = Math.min(baseDelayMs * 2 ** (currentAttempt - 1), maxDelayMs);
        await new Promise<void>((resolve) => {
          timerRef.current = setTimeout(resolve, delay);
        });
      }
    }
  }, [fn, maxAttempts, baseDelayMs, maxDelayMs, onError]);

  return { retry, reset, attempt, isRetrying, lastError };
}
