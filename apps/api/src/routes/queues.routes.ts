import { Router } from "express";
import { prisma, JobStatus } from "@scheduler/database";
import { validate } from "../middleware/validate.middleware";
import { CreateQueueSchema, UpdateQueueSchema } from "../schemas/queue.schema";

const router = Router();

// GET /api/queues - List all queues with live job counts
router.get("/", async (_req, res, next) => {
  try {
    const queues = await prisma.queue.findMany({
      include: {
        _count: {
          select: {
            jobs: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Fetch status aggregations for each queue
    const queueStats = await Promise.all(
      queues.map(async (q) => {
        const counts = await prisma.job.groupBy({
          by: ["status"],
          where: { queueId: q.id },
          _count: true,
        });

        const statusMap = counts.reduce<Record<string, number>>((acc, curr) => {
          acc[curr.status] = curr._count;
          return acc;
        }, {});

        return {
          id: q.id,
          name: q.name,
          maxConcurrency: q.maxConcurrency,
          isPaused: q.isPaused,
          stats: {
            queued: statusMap[JobStatus.QUEUED] || 0,
            claimed: statusMap[JobStatus.CLAIMED] || 0,
            running: statusMap[JobStatus.RUNNING] || 0,
            completed: statusMap[JobStatus.COMPLETED] || 0,
            failed: statusMap[JobStatus.FAILED] || 0,
            dlq: statusMap[JobStatus.DLQ] || 0,
          },
        };
      })
    );

    res.json({ success: true, data: queueStats });
  } catch (err) {
    next(err);
  }
});

// POST /api/queues - Create a new queue
router.post("/", validate(CreateQueueSchema), async (req, res, next) => {
  try {
    const { name, maxConcurrency, rateLimitCount, rateLimitWindowMs } = req.body;

    const defaultProject = await prisma.project.findFirst();
    if (!defaultProject) {
      res.status(400).json({ success: false, error: { code: "NO_PROJECT", message: "Run seed script first" } });
      return;
    }

    const queue = await prisma.queue.create({
      data: {
        projectId: defaultProject.id,
        name,
        maxConcurrency,
        rateLimitCount,
        rateLimitWindowMs,
      },
    });

    res.status(201).json({ success: true, data: queue });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/queues/:id - Update concurrency or pause/resume
router.patch("/:id", validate(UpdateQueueSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const queue = await prisma.queue.update({
      where: { id },
      data: req.body,
    });

    res.json({ success: true, data: queue });
  } catch (err) {
    next(err);
  }
});

export default router;