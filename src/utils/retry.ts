import { RateLimitError, NetworkError } from '../errors.js';

export interface RetryOptions {
  /** Total attempts including the first call. Default 3. */
  attempts?: number;
  /** Delay before the first retry; doubles each subsequent retry. Default 1000ms. */
  baseDelayMs?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Retries transient AI-provider failures (rate limits, network/5xx errors)
 * with exponential backoff. Everything else — auth, parse, programming
 * errors — is rethrown immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 1000;
  const sleep = opts.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable = error instanceof RateLimitError || error instanceof NetworkError;
      if (!retryable || attempt === attempts) throw error;
      await sleep(base * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
