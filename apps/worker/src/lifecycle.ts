import { prisma, JobStatus, Prisma } from "@scheduler/database";
import { calculateBackoff } from "./retry";
import { DagDependencyEngine } from "./dag";

export async function markJobRunning(jobId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: JobStatus.RUNNING,
      startedAt: new Date(),
    },
  });
}

export async function markJobCompleted(
  jobId: string,
  workerId: string,
  attempt: number,
  durationMs: number,
  result?: Record<string, unknown>,
  logs?: string
): Promise<void> {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.COMPLETED,
        finishedAt: now,
        result: result ? (result as Prisma.InputJsonValue) : Prisma.JsonNull,
        errorDetails: null,
      },
    });

    await tx.jobExecution.create({
      data: {
        jobId,
        workerId,
        attempt,
        status: JobStatus.COMPLETED,
        durationMs,
        logs: logs ?? null,
      },
    });

    await tx.worker.update({
      where: { id: workerId },
      data: { activeJobs: { decrement: 1 } },
    });
  });

  // Resolve dependent child tasks in the workflow
  await DagDependencyEngine.onJobCompleted(jobId);
}

export async function markJobFailed(
  jobId: string,
  workerId: string,
  attempt: number,
  durationMs: number,
  error: Error,
  logs?: string
): Promise<void> {
  const now = new Date();
  const errorMessage = error.message || "Unknown execution error";
  const stackTrace = error.stack || null;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) return;

  const nextRetry = job.retryCount + 1;
  const isDLQ = nextRetry > job.maxRetries;

  await prisma.$transaction(async (tx) => {
    await tx.jobExecution.create({
      data: {
        jobId,
        workerId,
        attempt,
        status: isDLQ ? JobStatus.DLQ : JobStatus.FAILED,
        durationMs,
        error: errorMessage,
        logs: logs ?? null,
      },
    });

    if (isDLQ) {
      await tx.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.DLQ,
          finishedAt: now,
          errorDetails: errorMessage,
        },
      });

      await tx.dlqEntry.upsert({
        where: { jobId },
        update: {
          failedReason: errorMessage,
          stackTrace,
        },
        create: {
          jobId,
          failedReason: errorMessage,
          stackTrace,
        },
      });
    } else {
      const delayMs = calculateBackoff(
        job.backoffType,
        job.backoffDelayMs,
        nextRetry
      );
      const nextRunAt = new Date(Date.now() + delayMs);

      await tx.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.QUEUED,
          retryCount: nextRetry,
          runAt: nextRunAt,
          claimedById: null,
          claimedAt: null,
          errorDetails: `Attempt ${attempt} failed: ${errorMessage}`,
        },
      });
    }

    await tx.worker.update({
      where: { id: workerId },
      data: { activeJobs: { decrement: 1 } },
    });
  });

  // If permanent failure / DLQ, cascade cancellation down the workflow DAG
  if (isDLQ) {
    await DagDependencyEngine.onJobFailedPermanently(jobId, errorMessage);
  }
}