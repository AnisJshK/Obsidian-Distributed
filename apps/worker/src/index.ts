import "dotenv/config";
import os from "node:os";
import { prisma, JobStatus, WorkerStatus } from "@scheduler/database";
import { claimNextJobs } from "./poller";
import { executeJob } from "./executor";
import { HeartbeatManager } from "./heartbeat";
import { DeadWorkerReaper } from "./reaper";
import { RecurringScheduleEvaluator } from "./cron";

Bun.serve({
  port: Number(process.env.PORT) || 3001,
  fetch() {
    return new Response("worker alive");
  },
});
console.log("🌐 Health server listening on port", process.env.PORT || 3001);

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "5", 10);
const POLL_INTERVAL_MS = 1000;

let isShuttingDown = false;
let activeJobCount = 0;

async function bootstrap() {
  console.log("🚀 Initializing worker node...");

  const worker = await prisma.worker.create({
    data: {
      hostname: os.hostname(),
      pid: process.pid,
      concurrency: CONCURRENCY,
      status: WorkerStatus.ACTIVE,
      activeJobs: 0,
    },
  });

  console.log(`✓ Registered worker ${worker.id} (PID: ${process.pid})`);

  const heartbeat = new HeartbeatManager(worker.id, () => activeJobCount);
  heartbeat.start();

  const reaper = new DeadWorkerReaper();
  reaper.start();

   const cronEvaluator = new RecurringScheduleEvaluator(); // ADD THIS
  cronEvaluator.start();   

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n🛑 Received ${signal}. Draining active tasks (${activeJobCount} remaining)...`);

    await heartbeat.stop();
    reaper.stop();

    await prisma.worker.update({
      where: { id: worker.id },
      data: { status: WorkerStatus.DRAINING },
    });

    const drainStart = Date.now();
    while (activeJobCount > 0 && Date.now() - drainStart < 15000) {
      await new Promise((r) => setTimeout(r, 200));
    }

    await prisma.job.updateMany({
      where: {
        claimedById: worker.id,
        status: { in: [JobStatus.CLAIMED, JobStatus.RUNNING] },
      },
      data: {
        status: JobStatus.QUEUED,
        claimedById: null,
        runAt: new Date(),
        errorDetails: "Requeued: worker force-terminated during shutdown",
      },
    });

    await prisma.worker.update({
      where: { id: worker.id },
      data: { status: WorkerStatus.TERMINATED },
    });

    console.log("👋 Worker cleanly terminated.");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  while (!isShuttingDown) {
    try {
      const availableSlots = CONCURRENCY - activeJobCount;

      if (availableSlots > 0) {
        const jobs = await claimNextJobs(worker.id, availableSlots);

        for (const job of jobs) {
          activeJobCount++;
          await prisma.worker.update({
            where: { id: worker.id },
            data: { activeJobs: { increment: 1 } },
          });

          executeJob(job, worker.id).finally(() => {
            activeJobCount = Math.max(0, activeJobCount - 1);
          });
        }
      }
    } catch (err) {
      console.error("[Worker Loop Error]:", err);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

bootstrap().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
