import { BackoffType } from "@scheduler/database";

export function calculateBackoff(
  type: BackoffType,
  baseDelayMs: number,
  attempt: number,
  applyJitter = true
): number {
  let delay = baseDelayMs;

  switch (type) {
    case BackoffType.FIXED:
      delay = baseDelayMs;
      break;
    case BackoffType.LINEAR:
      delay = baseDelayMs * attempt;
      break;
    case BackoffType.EXPONENTIAL:
      delay = baseDelayMs * Math.pow(2, attempt - 1);
      break;
  }

  // Cap maximum backoff delay to 1 hour
  const maxDelay = 3600 * 1000;
  delay = Math.min(delay, maxDelay);

  if (applyJitter) {
    // Full Jitter: Uniform random value between 0 and delay
    delay = Math.floor(Math.random() * delay);
  }

  return delay;
}