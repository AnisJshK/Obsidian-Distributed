// apps/api/src/routes/workflows.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@scheduler/database";
import { validate } from "../middleware/validate.middleware";
import { ingestWorkflow } from "../services/workflow.service";

const IngestWorkflowSchema = z.object({
  projectId: z.string().uuid(),
  workflowName: z.string().min(1).max(100),
  onCompleteUrl: z.string().url().optional(), // <-- Added support for webhook URL
  nodes: z
    .array(
      z.object({
        referenceId: z.string().min(1),
        queueName: z.string().min(1),
        payload: z.record(z.any()),
        priority: z.union([z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]), z.number().int()]).optional(),
        maxRetries: z.number().int().min(0).max(10).optional(),
        timeoutMs: z.number().int().positive().optional(),
        dependsOn: z.array(z.string()).optional(),
      })
    )
    .min(1),
});

export const workflowsRouter = Router();

// ----------------------------------------------------
// 1. Ingest a Workflow DAG Pipeline
// ----------------------------------------------------
workflowsRouter.post(
  "/",
  validate(IngestWorkflowSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ingestWorkflow(req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ----------------------------------------------------
// 2. Query Workflow Progress & DAG Execution Graph
// ----------------------------------------------------
workflowsRouter.get(
  "/:batchId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { batchId } = req.params;

      const batch = await prisma.jobBatch.findUnique({
        where: { id: batchId },
        include: {
          jobs: {
            select: {
              id: true,
              status: true,
              priority: true,
              retryCount: true,
              maxRetries: true,
              runAt: true,
              startedAt: true,
              finishedAt: true,
              errorDetails: true,
              queue: { select: { name: true } },
              dependencies: { select: { parentJobId: true } },
              dependents: { select: { childJobId: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!batch) {
        return res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Workflow batch ${batchId} not found.`,
          },
        });
      }

      const totalProcessed = batch.completedJobs + batch.failedJobs;
      const isCompleted = totalProcessed >= batch.totalJobs;
      const status =
        batch.failedJobs > 0 && isCompleted
          ? "FAILED"
          : isCompleted
          ? "COMPLETED"
          : "PROCESSING";

      res.status(200).json({
        success: true,
        data: {
          batchId: batch.id,
          name: batch.name,
          onCompleteUrl: batch.onCompleteUrl,
          status,
          progress: {
            total: batch.totalJobs,
            completed: batch.completedJobs,
            failed: batch.failedJobs,
            percentage:
              batch.totalJobs > 0
                ? Math.round((totalProcessed / batch.totalJobs) * 100)
                : 0,
          },
          jobs: batch.jobs.map((job) => ({
            id: job.id,
            queue: job.queue.name,
            status: job.status,
            priority: job.priority,
            retryCount: job.retryCount,
            maxRetries: job.maxRetries,
            runAt: job.runAt,
            startedAt: job.startedAt,
            finishedAt: job.finishedAt,
            dependsOn: job.dependencies.map((d) => d.parentJobId),
            unblocks: job.dependents.map((d) => d.childJobId),
            error: job.errorDetails,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);