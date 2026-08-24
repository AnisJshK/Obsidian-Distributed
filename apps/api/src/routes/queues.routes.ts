import { Router } from "express";
import { prisma, JobStatus } from "@scheduler/database";
import { validate } from "../middleware/validate.middleware";
import { CreateQueueSchema, UpdateQueueSchema } from "../schemas/queue.schema";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

const queuesRouter = Router();

// GET /api/queues - List all queues with live job counts
queuesRouter.get("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.project) {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_PROJECT_CONTEXT", message: "A project context is required." },
      });
    }
    const queues = await prisma.queue.findMany({
      where: { projectId: req.project.id },
      include: {
        _count: {
          select: {
            jobs: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const counts = await prisma.job.groupBy({
      by: ["queueId", "status"],
      where: { queueId: { in: queues.map((queue) => queue.id) } },
      _count: true,
    });
    const countsByQueue = new Map<string, Record<string, number>>();
    for (const count of counts) {
      const statusMap = countsByQueue.get(count.queueId) || {};
      statusMap[count.status] = count._count;
      countsByQueue.set(count.queueId, statusMap);
    }

    const queueStats = queues.map((q) => {
      const statusMap = countsByQueue.get(q.id) || {};
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
    });

    res.json({ success: true, data: queueStats });
  } catch (err) {
    next(err);
  }
});

// POST /api/queues - Create a new queue
queuesRouter.post("/", validate(CreateQueueSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.project) {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_PROJECT_CONTEXT", message: "A project context is required." },
      });
    }
    const { name, maxConcurrency, rateLimitCount, rateLimitWindowMs } = req.body;

    const existing = await prisma.queue.findUnique({
      where: { projectId_name: { projectId: req.project.id, name } },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: "QUEUE_EXISTS", message: `Queue '${name}' already exists.` },
      });
    }

    const queue = await prisma.queue.create({
      data: {
        projectId: req.project.id,
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
queuesRouter.patch("/:id", validate(UpdateQueueSchema), async (req, res, next) => {
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

export default queuesRouter;