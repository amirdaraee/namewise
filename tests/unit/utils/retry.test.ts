import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../../src/utils/retry.js';
import { RateLimitError, NetworkError, AuthError, ParseError } from '../../../src/errors.js';

const noSleep = async () => {};

describe('withRetry', () => {
  it('returns the result on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, { sleep: noSleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries RateLimitError and succeeds on a later attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimitError('429'))
      .mockRejectedValueOnce(new RateLimitError('429'))
      .mockResolvedValue('ok');
    await expect(withRetry(fn, { sleep: noSleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries NetworkError', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new NetworkError('503'))
      .mockResolvedValue('ok');
    await expect(withRetry(fn, { sleep: noSleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rethrows after exhausting all attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new RateLimitError('429'));
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toBeInstanceOf(RateLimitError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-transient errors', async () => {
    for (const error of [new AuthError('401'), new ParseError('bad file'), new Error('boom')]) {
      const fn = vi.fn().mockRejectedValue(error);
      await expect(withRetry(fn, { sleep: noSleep })).rejects.toBe(error);
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it('backs off exponentially between attempts', async () => {
    const delays: number[] = [];
    const fn = vi.fn().mockRejectedValue(new NetworkError('503'));
    await expect(withRetry(fn, { sleep: async ms => { delays.push(ms); }, baseDelayMs: 100 }))
      .rejects.toBeInstanceOf(NetworkError);
    expect(delays).toEqual([100, 200]);
  });

  it('respects a custom attempt count', async () => {
    const fn = vi.fn().mockRejectedValue(new NetworkError('503'));
    await expect(withRetry(fn, { sleep: noSleep, attempts: 5 })).rejects.toBeInstanceOf(NetworkError);
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('uses real timers by default', async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn()
        .mockRejectedValueOnce(new NetworkError('503'))
        .mockResolvedValue('ok');
      const promise = withRetry(fn, { baseDelayMs: 10 });
      await vi.advanceTimersByTimeAsync(10);
      await expect(promise).resolves.toBe('ok');
    } finally {
      vi.useRealTimers();
    }
  });
});
