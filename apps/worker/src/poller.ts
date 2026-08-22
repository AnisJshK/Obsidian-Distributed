import { prisma, Prisma, BackoffType } from "@scheduler/database";

export interface ClaimedJob {
  id: string;
  queueId: string;
  payload: unknown;
  timeoutMs: number;
  maxRetries: number;
  retryCount: number;
  backoffType: BackoffType;
  backoffDelayMs: number;
}

export async function claimNextJobs(
  workerId: string,
  limit: number
): Promise<ClaimedJob[]> {
  if (limit <= 0) return [];

  const now = new Date();

  // Single atomic CTE query: checks pause state + concurrency limit + locks row with SKIP LOCKED
  const claimSql = Prisma.sql`
    WITH active_queue_counts AS (
      SELECT "queueId", COUNT(*)::int AS running_count
      FROM "Job"
      WHERE status IN ('CLAIMED', 'RUNNING')
      GROUP BY "queueId"
    ),
    candidate_jobs AS (
      SELECT j.id
      FROM "Job" j
      INNER JOIN "Queue" q ON j."queueId" = q.id
      LEFT JOIN active_queue_counts aqc ON q.id = aqc."queueId"
      WHERE j.status = 'QUEUED'
        AND j."runAt" <= ${now}
        AND q."isPaused" = FALSE
        AND (COALESCE(aqc.running_count, 0) < q."maxConcurrency")
      ORDER BY j.priority DESC, j."runAt" ASC
      LIMIT ${limit}
      FOR UPDATE OF j SKIP LOCKED
    )
    UPDATE "Job" j
    SET 
      status = 'CLAIMED',
      "claimedById" = ${workerId},
      "claimedAt" = ${now},
      "updatedAt" = ${now}
    FROM candidate_jobs cj
    WHERE j.id = cj.id
    RETURNING 
      j.id, 
      j."queueId", 
      j.payload, 
      j."timeoutMs", 
      j."maxRetries", 
      j."retryCount", 
      j."backoffType", 
      j."backoffDelayMs";
  `;

  const claimed = await prisma.$queryRaw<ClaimedJob[]>(claimSql);
  return claimed;
}