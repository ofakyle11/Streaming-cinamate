/**
 * Retry with deterministic exponential backoff (no jitter, so tests and
 * behaviour are predictable). Only transient failures are retried:
 *   - network errors (fetch rejects with a TypeError)
 *   - HTTP 5xx and 429
 * Anything else (4xx, NotConfiguredError, AbortError, ...) fails fast.
 *
 * Live adapters that talk to the network should call `fetchWithRetry` instead
 * of `fetch`. Mock adapters never touch this module.
 */

export interface RetryOptions {
  /** Total attempts including the first one. Default 3. */
  maxAttempts?: number;
  /** Delay before the 2nd attempt in ms; doubles each retry. Default 300. */
  baseDelayMs?: number;
  /** Upper bound for a single delay in ms. Default 5000. */
  maxDelayMs?: number;
  /** Aborts the pending attempt/delay and stops retrying. */
  signal?: AbortSignal;
  /** Override which errors are retried. Default: `isRetryableError`. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Injected for tests; defaults to a setTimeout-based abortable sleep. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/** Thrown by `fetchWithRetry` when the final response is not ok. */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, statusText = '') {
    super(`HTTP ${status}${statusText ? ` ${statusText}` : ''}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export const isRetryableStatus = (status: number): boolean => status === 429 || status >= 500;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function isRetryableError(error: unknown): boolean {
  if (isAbortError(error)) return false;
  if (error instanceof HttpError) return isRetryableStatus(error.status);
  // fetch() rejects with a TypeError on network failure (offline, DNS, CORS).
  return error instanceof TypeError;
}

/** Delay before retry number `retry` (1-based): base * 2^(retry-1), capped. */
export function backoffDelay(retry: number, baseDelayMs = 300, maxDelayMs = 5000): number {
  return Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, retry - 1));
}

function abortReason(signal: AbortSignal): unknown {
  if (signal.reason !== undefined) return signal.reason;
  const err = new Error('The operation was aborted.');
  err.name = 'AbortError';
  return err;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal as AbortSignal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Runs `task` until it succeeds, a non-retryable error occurs, or attempts run out. */
export async function withRetry<T>(
  task: (attempt: number, signal?: AbortSignal) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 300,
    maxDelayMs = 5000,
    signal,
    shouldRetry = isRetryableError,
    sleep: wait = sleep,
  } = options;
  const attempts = Math.max(1, Math.floor(maxAttempts));

  for (let attempt = 1; ; attempt++) {
    if (signal?.aborted) throw abortReason(signal);
    try {
      return await task(attempt, signal);
    } catch (error) {
      if (signal?.aborted) throw abortReason(signal);
      if (attempt >= attempts || !shouldRetry(error, attempt)) throw error;
      await wait(backoffDelay(attempt, baseDelayMs, maxDelayMs), signal);
    }
  }
}

/**
 * `fetch` with retries. Resolves with the ok Response; throws `HttpError` for a
 * non-ok final response (after retrying 5xx/429) and rethrows network errors.
 */
export function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: Omit<RetryOptions, 'signal'> & { fetchImpl?: typeof fetch } = {},
): Promise<Response> {
  const { fetchImpl = fetch, ...retryOptions } = options;
  const signal = init.signal ?? undefined;
  return withRetry(
    async () => {
      const res = await fetchImpl(input, init);
      if (!res.ok) throw new HttpError(res.status, res.statusText);
      return res;
    },
    { ...retryOptions, signal },
  );
}
