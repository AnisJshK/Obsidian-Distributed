// apps/api/src/routes/jobs.routes.ts
import { Router } from "express";
import { prisma, JobStatus, Prisma } from "@scheduler/database";
import { validate } from "../middleware/validate.middleware";
import { CreateJobSchema, CreateBatchJobSchema } from "../schemas/job.schema";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

const jobsRouter = Router();

// ============================================================================
// GET /api/jobs - List & Filter Jobs for Dashboard and Job Explorer
// ============================================================================
// GET /api/jobs - List & Filter Jobs for Dashboard and Job Explorer
jobsRouter.get("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const queueName = typeof req.query.queueName === "string" ? req.query.queueName : undefined;
    const statusParam = typeof req.query.status === "string" ? req.query.status : undefined;
    const limitParam = typeof req.query.limit === "string" ? req.query.limit : undefined;

    const whereClause: Prisma.JobWhereInput = {};

    // Filter by Project or Queue Name via Queue relation
    if (queueName && queueName !== "ALL") {
      whereClause.queue = {
        projectId: req.project!.id,
        ...(queueName && queueName !== "ALL" ? { name: queueName } : {}),
      };
    } else {
      whereClause.queue = { projectId: req.project!.id };
    }

    // Filter by Job Status
    if (statusParam && statusParam !== "ALL" && Object.values(JobStatus).includes(statusParam as JobStatus)) {
      whereClause.status = statusParam as JobStatus;
    }

    const takeLimit = Math.min(Number(limitParam) || 50, 200);

    const jobs = await prisma.job.findMany({
      where: whereClause,
      include: {
        queue: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: takeLimit,
    });

    res.json({
      success: true,
      data: jobs,
    });
  } catch (err) {
    next(err);
  }
});
// ============================================================================
// POST /api/jobs - Ingest single job (immediate or scheduled)
// ============================================================================
jobsRouter.post("/", validate(CreateJobSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const {
      name,
      queueName,
      payload,
      priority,
      delayMs,
      runAt,
      timeoutMs,
      maxRetries,
      backoffType,
      backoffDelayMs,
      parentJobIds,
    } = req.body;

    const queue = await prisma.queue.findFirst({ where: { name: queueName, projectId: req.project!.id } });
    if (!queue) {
      res.status(404).json({ success: false, error: { code: "QUEUE_NOT_FOUND", message: `Queue '${queueName}' not found` } });
      return;
    }

    // Determine target execution timestamp
    let scheduledRunAt = new Date();
    if (runAt) {
      scheduledRunAt = new Date(runAt);
    } else if (delayMs) {
      scheduledRunAt = new Date(Date.now() + delayMs);
    }

    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.job.create({
        data: {
          queueId: queue.id,
          payload: payload as Prisma.InputJsonValue,
          priority,
          runAt: scheduledRunAt,
          timeoutMs,
          maxRetries,
          backoffType,
          backoffDelayMs,
          status: JobStatus.QUEUED,
        },
        include: {
          queue: { select: { id: true, name: true } },
        },
      });

      // Handle DAG dependencies if provided
      if (parentJobIds && parentJobIds.length > 0) {
        await tx.jobDependency.createMany({
          data: parentJobIds.map((parentId: string) => ({
            parentJobId: parentId,
            childJobId: created.id,
          })),
        });
      }

      return created;
    });

    res.status(201).json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /api/jobs/batch - Atomic batch job ingestion
// ============================================================================
jobsRouter.post("/batch", validate(CreateBatchJobSchema), async (req, res, next) => {
  try {
    const { name, onCompleteUrl, jobs } = req.body;
    const defaultProject = await prisma.project.findFirst();

    if (!defaultProject) {
      res.status(400).json({ success: false, error: { code: "NO_PROJECT", message: "Run seed script first" } });
      return;
    }

    const createdBatch = await prisma.$transaction(async (tx) => {
      const batch = await tx.jobBatch.create({
        data: {
          projectId: defaultProject.id,
          name: name ?? "Batch ingestion",
          totalJobs: jobs.length,
          onCompleteUrl,
        },
      });

      for (const item of jobs) {
        const queue = await tx.queue.findFirst({ where: { name: item.queueName } });
        if (!queue) throw new Error(`Queue '${item.queueName}' does not exist.`);

        let scheduledRunAt = new Date();
        if (item.runAt) scheduledRunAt = new Date(item.runAt);
        else if (item.delayMs) scheduledRunAt = new Date(Date.now() + item.delayMs);

        await tx.job.create({
          data: {
            queueId: queue.id,
            batchId: batch.id,
            payload: item.payload as Prisma.InputJsonValue,
            priority: item.priority,
            runAt: scheduledRunAt,
            timeoutMs: item.timeoutMs,
            maxRetries: item.maxRetries,
            backoffType: item.backoffType,
            backoffDelayMs: item.backoffDelayMs,
          },
        });
      }

      return batch;
    });

    res.status(201).json({ success: true, data: createdBatch });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /api/jobs/:id - Inspect a single job and its execution history
// ============================================================================
jobsRouter.get("/:id", async (req, res, next) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        executions: { orderBy: { startedAt: "desc" } },
        dlqEntry: true,
        queue: { select: { name: true } },
      },
    });

    if (!job) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Job not found" } });
      return;
    }

    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /api/jobs/:id/cancel - Cancel a pending job
// ============================================================================
jobsRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    const job = await prisma.job.updateMany({
      where: {
        id: req.params.id,
        status: { in: [JobStatus.QUEUED, JobStatus.CLAIMED] },
      },
      data: {
        status: JobStatus.CANCELLED,
      },
    });

    if (job.count === 0) {
      res.status(400).json({ success: false, error: { code: "INVALID_STATE", message: "Cannot cancel running or finished job" } });
      return;
    }

    res.json({ success: true, message: "Job cancelled successfully" });
  } catch (err) {
    next(err);
  }
});

export default jobsRouter;