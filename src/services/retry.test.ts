import { describe, expect, it, vi } from 'vitest';
import {
  HttpError,
  backoffDelay,
  fetchWithRetry,
  isRetryableError,
  sleep,
  withRetry,
} from './retry';

const noSleep = vi.fn(async () => {});

describe('backoffDelay', () => {
  it('doubles deterministically and caps at maxDelayMs', () => {
    expect([1, 2, 3, 4].map((n) => backoffDelay(n, 100, 500))).toEqual([100, 200, 400, 500]);
    expect(backoffDelay(1)).toBe(300);
  });
});

describe('isRetryableError', () => {
  it('retries network errors, 5xx and 429 only', () => {
    expect(isRetryableError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isRetryableError(new HttpError(503))).toBe(true);
    expect(isRetryableError(new HttpError(500))).toBe(true);
    expect(isRetryableError(new HttpError(429))).toBe(true);
    expect(isRetryableError(new HttpError(404))).toBe(false);
    expect(isRetryableError(new HttpError(400))).toBe(false);
    expect(isRetryableError(new Error('boom'))).toBe(false);
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    expect(isRetryableError(abort)).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns immediately on success', async () => {
    const task = vi.fn(async () => 'ok');
    await expect(withRetry(task, { sleep: noSleep })).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('retries retryable errors with exponential delays then succeeds', async () => {
    const waits: number[] = [];
    const task = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockRejectedValueOnce(new HttpError(502))
      .mockResolvedValueOnce('done');
    const result = await withRetry(task, {
      maxAttempts: 4,
      baseDelayMs: 50,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    expect(result).toBe('done');
    expect(task).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([50, 100]);
  });

  it('gives up after maxAttempts and rethrows the last error', async () => {
    const task = vi.fn(async () => {
      throw new HttpError(500);
    });
    await expect(withRetry(task, { maxAttempts: 3, sleep: noSleep })).rejects.toMatchObject({
      status: 500,
    });
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable errors', async () => {
    const task = vi.fn(async () => {
      throw new HttpError(404);
    });
    await expect(withRetry(task, { sleep: noSleep })).rejects.toBeInstanceOf(HttpError);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('stops when aborted during the backoff delay', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const task = vi.fn(async () => {
        throw new TypeError('network');
      });
      const promise = withRetry(task, { signal: controller.signal, baseDelayMs: 1000 });
      const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
      await vi.advanceTimersByTimeAsync(10);
      controller.abort();
      await assertion;
      expect(task).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not start when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const task = vi.fn(async () => 'x');
    await expect(withRetry(task, { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(task).not.toHaveBeenCalled();
  });
});

describe('sleep', () => {
  it('rejects with the abort reason', async () => {
    const controller = new AbortController();
    const p = sleep(10_000, controller.signal);
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('fetchWithRetry', () => {
  const res = (status: number) => new Response(null, { status });

  it('retries 5xx/429 and resolves with the ok response', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(429))
      .mockResolvedValueOnce(res(200));
    const out = await fetchWithRetry('/api', {}, { fetchImpl, sleep: noSleep });
    expect(out.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('throws HttpError without retrying 4xx', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(res(401));
    await expect(fetchWithRetry('/api', {}, { fetchImpl, sleep: noSleep })).rejects.toMatchObject({
      name: 'HttpError',
      status: 401,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('passes the request signal through to fetch', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(res(200));
    await fetchWithRetry('/api', { signal: controller.signal }, { fetchImpl });
    expect(fetchImpl.mock.calls[0][1]?.signal).toBe(controller.signal);
  });
});
