// apps/worker/src/dag.ts
import { prisma, JobStatus } from "@scheduler/database";
import { WebhookDispatcher } from "./webhook";

export class DagDependencyEngine {
  /**
   * Called when a parent job reaches COMPLETED status.
   * Increments batch counters, unblocks ready child jobs, and fires batch webhooks if done.
   */
  static async onJobCompleted(completedJobId: string): Promise<string[]> {
    // 1. Fetch parent job details to check for batch association
    const job = await prisma.job.findUnique({
      where: { id: completedJobId },
      select: { batchId: true },
    });

    // 2. Increment completedJobs counter and check for batch webhook dispatch
    if (job?.batchId) {
      await prisma.jobBatch.update({
        where: { id: job.batchId },
        data: { completedJobs: { increment: 1 } },
      });

      // Fire webhook evaluation if batch finished
      await WebhookDispatcher.checkAndDispatchBatchWebhook(job.batchId);
    }

    // 3. Fetch direct dependent child jobs
    const downstreamDeps = await prisma.jobDependency.findMany({
      where: { parentJobId: completedJobId },
      select: { childJobId: true },
    });

    if (downstreamDeps.length === 0) return [];

    const childJobIds = downstreamDeps.map((d) => d.childJobId);
    const unblockedJobIds: string[] = [];

    for (const childId of childJobIds) {
      // 4. Verify if all parent dependencies for this child are COMPLETED
      const allParentDeps = await prisma.jobDependency.findMany({
        where: { childJobId: childId },
        include: { parentJob: { select: { status: true } } },
      });

      const allParentsSatisfied = allParentDeps.every(
        (dep) => dep.parentJob.status === JobStatus.COMPLETED
      );

      // 5. Unblock child by setting runAt to NOW so the poller picks it up
      if (allParentsSatisfied) {
        const updated = await prisma.job.updateMany({
          where: {
            id: childId,
            status: JobStatus.QUEUED,
          },
          data: {
            runAt: new Date(),
            updatedAt: new Date(),
          },
        });

        if (updated.count > 0) {
          unblockedJobIds.push(childId);
        }
      }
    }

    return unblockedJobIds;
  }

  /**
   * Called when a job fails permanently (enters DLQ).
   * Cascades the failure down the DAG tree and fires batch webhooks if done.
   */
  static async onJobFailedPermanently(failedJobId: string, errorReason: string): Promise<void> {
    // 1. Fetch failed job details
    const job = await prisma.job.findUnique({
      where: { id: failedJobId },
      select: { batchId: true },
    });

    // 2. Increment failedJobs for the failing job itself
    if (job?.batchId) {
      await prisma.jobBatch.update({
        where: { id: job.batchId },
        data: { failedJobs: { increment: 1 } },
      });
    }

    // 3. Find all transitive downstream dependents using recursive CTE
    const affectedChildren = await prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE downstream AS (
        SELECT "childJobId" AS id
        FROM "JobDependency"
        WHERE "parentJobId" = ${failedJobId}
        UNION
        SELECT jd."childJobId" AS id
        FROM "JobDependency" jd
        INNER JOIN downstream d ON jd."parentJobId" = d.id
      )
      SELECT DISTINCT id FROM downstream;
    `;

    const ids = affectedChildren.map((c) => c.id);
    const now = new Date();

    let cascadeCount = 0;

    if (ids.length > 0) {
      // 4. Mark all blocked downstream children as DLQ/failed
      const updated = await prisma.job.updateMany({
        where: {
          id: { in: ids },
          status: JobStatus.QUEUED,
        },
        data: {
          status: JobStatus.DLQ,
          errorDetails: `Dependency failed: Upstream parent ${failedJobId} entered DLQ (${errorReason})`,
          finishedAt: now,
          updatedAt: now,
        },
      });

      cascadeCount = updated.count;

      // 5. Increment failedJobs counter for all cancelled downstream dependents
      if (job?.batchId && cascadeCount > 0) {
        await prisma.jobBatch.update({
          where: { id: job.batchId },
          data: { failedJobs: { increment: cascadeCount } },
        });
      }
    }

    // 6. Check if batch is completed and dispatch webhook if configured
    if (job?.batchId) {
      await WebhookDispatcher.checkAndDispatchBatchWebhook(job.batchId);
    }
  }
}