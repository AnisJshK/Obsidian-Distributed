import { prisma, JobStatus, WorkerStatus } from "@scheduler/database";
import { calculateBackoff } from "./retry";

export class DeadWorkerReaper {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private thresholdSec: number = 15,
    private intervalMs: number = 10000
  ) {}

  public start(): void {
    this.timer = setInterval(() => this.reap(), this.intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async reap(): Promise<void> {
    const cutoff = new Date(Date.now() - this.thresholdSec * 1000);

    const deadWorkers = await prisma.worker.findMany({
      where: {
        status: WorkerStatus.ACTIVE,
        lastHeartbeat: { lt: cutoff },
      },
      select: { id: true },
    });

    if (deadWorkers.length === 0) return;
    const deadWorkerIds = deadWorkers.map((w) => w.id);

    console.warn(`[Reaper] Flagged dead workers: ${deadWorkerIds.join(", ")}`);

    await prisma.worker.updateMany({
      where: { id: { in: deadWorkerIds } },
      data: { status: WorkerStatus.STALLED },
    });

    const orphanedJobs = await prisma.job.findMany({
      where: {
        claimedById: { in: deadWorkerIds },
        status: { in: [JobStatus.CLAIMED, JobStatus.RUNNING] },
      },
    });

    for (const job of orphanedJobs) {
      const nextRetry = job.retryCount + 1;

      if (nextRetry > job.maxRetries) {
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.DLQ,
            claimedById: null,
            errorDetails: `Orphaned: worker died past threshold (${this.thresholdSec}s)`,
          },
        });
      } else {
        const delayMs = calculateBackoff(job.backoffType, job.backoffDelayMs, nextRetry);
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.QUEUED,
            claimedById: null,
            retryCount: nextRetry,
            runAt: new Date(Date.now() + delayMs),
            errorDetails: "Requeued by reaper: assigned worker stalled",
          },
        });
      }
    }
  }
}