import type { ClaimedJob } from "./poller";
import { markJobRunning, markJobCompleted, markJobFailed } from "./lifecycle";

async function executeTaskPayload(
  payload: Record<string, unknown>,
  signal: AbortSignal
): Promise<Record<string, unknown>> {
  if (signal.aborted) {
    throw new Error("Job execution aborted due to timeout");
  }

  // Simulated worker processing task with abort listener
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 300);

    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("Job execution aborted due to timeout"));
    });
  });

  return { processed: true, completedAt: new Date().toISOString() };
}

export async function executeJob(
  job: ClaimedJob,
  workerId: string
): Promise<void> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), job.timeoutMs);

  try {
    await markJobRunning(job.id);

    const payload = (job.payload as Record<string, unknown>) ?? {};
    const result = await executeTaskPayload(payload, controller.signal);

    clearTimeout(timer);
    const duration = Date.now() - startTime;
    await markJobCompleted(job.id, workerId, job.retryCount + 1, duration, result);
  } catch (err: unknown) {
    clearTimeout(timer);
    const duration = Date.now() - startTime;
    const error = err instanceof Error ? err : new Error(String(err));
    await markJobFailed(job.id, workerId, job.retryCount + 1, duration, error);
  }
}