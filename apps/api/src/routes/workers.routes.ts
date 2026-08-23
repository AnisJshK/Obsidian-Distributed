import { Router } from "express";
import { prisma } from "@scheduler/database";

const workersRouter = Router();

// GET /api/workers - Inspect all active & stalled worker nodes
workersRouter.get("/", async (_req, res, next) => {
  try {
    const workers = await prisma.worker.findMany({
      orderBy: { lastHeartbeat: "desc" },
    });

    res.json({ success: true, data: workers });
  } catch (err) {
    next(err);
  }
});

export default workersRouter;