// apps/worker/src/cron.ts
import { prisma, JobStatus, ScheduleType, Prisma } from "@scheduler/database";
import CronExpressionParser from "cron-parser";

/**
 * Generates a stable 64-bit integer hash from a string ID
 * for use as a Postgres advisory lock key.
 */
function hashToBigInt(str: string): bigint {
  let hash = 0n;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31n + BigInt(str.charCodeAt(i))) & 0x7fffffffffffffffn;
  }
  return hash;
}

export class RecurringScheduleEvaluator {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs: number;

  constructor(pollIntervalMs = 5000) {
    this.pollIntervalMs = pollIntervalMs;
  }

  /**
   * Start the recurring evaluation loop
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[CronEvaluator] Recurring schedule engine started (poll interval: ${this.pollIntervalMs}ms)`);
    this.tick();
  }

  /**
   * Stop the recurring evaluation loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log("[CronEvaluator] Recurring schedule engine stopped");
  }

  private async tick(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.evaluateSchedules();
    } catch (err) {
      console.error("[CronEvaluator] Error evaluating recurring schedules:", err);
    } finally {
      if (this.isRunning) {
        this.timer = setTimeout(() => this.tick(), this.pollIntervalMs);
      }
    }
  }

  /**
   * Evaluates all active schedules eligible for execution
   */
// Inside apps/worker/src/cron.ts

  async evaluateSchedules(): Promise<void> {
    const now = new Date();

    // Query active schedules that are due for execution
    const schedules = await prisma.recurringSchedule.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
      include: {
        queue: true,
      },
      take: 50,
    });

    if (schedules.length === 0) return;

    for (const schedule of schedules) {
      await this.processScheduleWithLock(schedule, now);
    }
  }

  /**
   * Uses a Postgres transaction-level advisory lock so only ONE worker
   * in a multi-node cluster emits a job for any given schedule tick.
   */
  private async processScheduleWithLock(
    schedule: {
      id: string;
      projectId: string;
      queueId: string;
      name: string;
      type: ScheduleType;
      expression: string;
      timezone: string | null;
      payload: Prisma.JsonValue;
      priority: number;
      lastRunAt: Date | null;
      nextRunAt: Date | null;
    },
    now: Date
  ): Promise<void> {
    const lockKey = hashToBigInt(schedule.id);

    try {
      await prisma.$transaction(
        async (tx) => {
          // 1. Attempt non-blocking transaction advisory lock
          const lockResult = await tx.$queryRaw<{ acquired: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(${lockKey}) AS acquired;
          `;

          const acquired = lockResult[0]?.acquired ?? false;
          if (!acquired) {
            return; // Another worker claimed this schedule tick
          }

          // 2. Re-verify the schedule state inside the locked transaction
          const current = await tx.recurringSchedule.findUnique({
            where: { id: schedule.id },
          });

          if (!current || !current.isActive) return;
          if (current.nextRunAt && current.nextRunAt > now) {
            return; // Already advanced by a concurrent worker
          }

          // 3. Compute next execution timestamp
          const nextRun = this.calculateNextRun(
            current.type,
            current.expression,
            current.timezone,
            now
          );

          // 4. Ingest new Job into the target queue
          await tx.job.create({
            data: {
              queueId: current.queueId,
              payload: current.payload as Prisma.InputJsonValue,
              priority: current.priority ?? 5,
              status: JobStatus.QUEUED,
              runAt: now,
              maxRetries: 3,
              timeoutMs: 30000,
            },
          });

          // 5. Advance schedule timestamps
          await tx.recurringSchedule.update({
            where: { id: current.id },
            data: {
              lastRunAt: now,
              nextRunAt: nextRun,
              updatedAt: now,
            },
          });

          console.log(
            `[CronEvaluator] Emitted job for schedule "${current.name}" (${current.id}). Next tick: ${nextRun.toISOString()}`
          );
        },
        {
          maxWait: 5000,
          timeout: 10000,
        }
      );
    } catch (err) {
      console.error(`[CronEvaluator] Failed processing schedule ${schedule.id}:`, err);
    }
  }

  /**
   * Calculates the next execution timestamp based on Cron or Interval expressions.
   */
  private calculateNextRun(
    type: ScheduleType,
    expression: string,
    timezone: string | null,
    fromDate: Date
  ): Date {
    if (type === "CRON") {
      // In cron-parser v4+, CronExpressionParser.parse is the primary method
      const interval = CronExpressionParser.parse(expression, {
        currentDate: fromDate,
        tz: timezone || "UTC",
      });
      return interval.next().toDate();
    }

    // Interval mode (milliseconds)
    const intervalMs = Number.parseInt(expression, 10);
    const validInterval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 60000;
    return new Date(fromDate.getTime() + validInterval);
  }
}