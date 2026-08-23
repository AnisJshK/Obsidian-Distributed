import { Router } from "express";
import { prisma, JobStatus } from "@scheduler/database";

const dlqRouter = Router();

// GET /api/dlq - List all dead-letter jobs with failure traces
dlqRouter.get("/", async (_req, res, next) => {
  try {
    const dlqEntries = await prisma.dlqEntry.findMany({
      include: {
        job: {
          include: {
            queue: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: dlqEntries });
  } catch (err) {
    next(err);
  }
});

// POST /api/dlq/:jobId/replay - Replay a failed dead-letter job
dlqRouter.post("/:jobId/replay", async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { dlqEntry: true },
    });

    if (!job || job.status !== JobStatus.DLQ) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_STATE", message: "Job is not in DLQ status" },
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Re-queue the job with reset retries and immediate runAt
      await tx.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.QUEUED,
          retryCount: 0,
          runAt: new Date(),
          claimedById: null,
          claimedAt: null,
          startedAt: null,
          finishedAt: null,
          errorDetails: null,
        },
      });

      // Update DLQ audit marker
      await tx.dlqEntry.update({
        where: { jobId },
        data: {
          replayedAt: new Date(),
          replayedBy: "manual_api_action",
        },
      });
    });

    res.json({ success: true, message: "Job re-queued successfully for execution" });
  } catch (err) {
    next(err);
  }
});

export default dlqRouter;