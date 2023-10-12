import ms from "ms";

import log from "../log";

/** A function that can be retried and may return temporary or permanent errors. */
export type Retryable<T, E> = () => Promise<Attempt<T, E>>;
/** The result of an attempt for a retryable function. */
export type Attempt<T, E> =
  | { state: "done"; data: T }
  | { state: "retry"; error: E }
  | { state: "error"; error: E };
/** The result of a series of retries for a function. */
export type Result<T, E> =
  | { success: true; data: T; errors: E[] }
  | { success: false; errors: E[] };

/** Options for retrying a function. */
export type RetryOptions = {
  /** Spend at most this long on attempts */
  maxDurationMs: number;
  /** The maximum duration we will wait on the first retryable failure */
  initialDelayMs: number;
  /** Retry at most this number of times */
  maxAttempts: number;
};

const DEFAULT_BACKOFF_OPTIONS: RetryOptions = {
  maxDurationMs: ms("1m"),
  initialDelayMs: ms("0.1s"),
  maxAttempts: Infinity,
};

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

/**
 * Retry a function until it succeeds or we run out of attempts or time.
 * @param desc a description of the task
 * @param fn the function to retry
 * @returns the result of attempting this function
 */
export async function retry<T, E>(
  desc: string,
  fn: () => Promise<Attempt<T, E>>,
  _?: any
): Promise<Result<T, E>>;
/**
 * Retry a function until it succeeds or we run out of attempts or time.
 * @param desc a description of the task
 * @param opts options for retrying this function
 * @param fn the function to retry
 * @returns the result of attempting this function
 */
export async function retry<T, E>(
  desc: string,
  opts: Partial<RetryOptions>,
  fn: Retryable<T, E>
): Promise<Result<T, E>>;
/** */
export async function retry<T, E>(
  a: any,
  b: any,
  c: any
): Promise<Result<T, E>> {
  const args = c ? [a, b, c] : [a, DEFAULT_BACKOFF_OPTIONS, b];
  const desc: string = args[0];
  const opts: Partial<RetryOptions> = args[1];
  const fn: Retryable<T, E> = args[2];

  const fullOpts: RetryOptions = { ...DEFAULT_BACKOFF_OPTIONS, ...opts };
  const { maxAttempts, maxDurationMs } = fullOpts;
  let delay = fullOpts.initialDelayMs;

  const rlog = log.child({ desc, maxAttempts, maxDurationMs });

  const errors: E[] = [];
  const start = Date.now();
  for (let att = 0; att < maxAttempts; att++) {
    const duration = Date.now() - start;
    const alog = rlog.child({
      duration,
      attempt: att + 1,
      nextMaxDelay: delay,
    });

    // eslint-disable-next-line no-await-in-loop
    const outcome = await fn();
    if (outcome.state === "done") {
      return { success: true, data: outcome.data, errors };
    }

    if (outcome.state === "error") {
      alog.debug("retry: got error");
      errors.push(outcome.error);
      return { success: false, errors };
    }

    errors.push(outcome.error);
    if (duration > maxDurationMs) {
      alog.debug("retry: exceeded max duration");
      return { success: false, errors };
    }

    const toSleep = Math.min(
      Math.random() * delay, // full jitter
      maxDurationMs - (Date.now() - start) // one last try
    );
    // eslint-disable-next-line no-await-in-loop
    await sleep(toSleep);
    delay *= 2; // exponential backoff
  }

  rlog.debug("retry: exceeded max attempts");
  return { success: false, errors };
}
