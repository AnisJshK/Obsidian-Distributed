// apps/api/src/server.ts
import express from "express";
import cors from "cors";
import queuesRouter from "./routes/queues.routes";
import jobsRouter from "./routes/jobs.routes";
import dlqRouter from "./routes/dlq.routes";
import { workflowsRouter } from "./routes/workflows.routes";
import workersRouter from "./routes/workers.routes";
import { errorHandler } from "./middleware/error.middleware";
import { schedulesRouter } from "./routes/schedules.routes";
import { authRouter } from "./routes/auth.routes";
import { requireApiKey } from "./middleware/auth.middleware";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Public Auth Provisioning (Must remain open to generate keys)
app.use("/api/auth", authRouter);

// Health Check (Public readiness probe)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Protected Platform Endpoints (All require X-API-Key header)
app.use("/api/queues", requireApiKey, queuesRouter);
app.use("/api/jobs", requireApiKey, jobsRouter);
app.use("/api/workflows", requireApiKey, workflowsRouter);
app.use("/api/schedules", requireApiKey, schedulesRouter);
app.use("/api/dlq", requireApiKey, dlqRouter);
app.use("/api/workers", requireApiKey, workersRouter);

// Centralized error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🌐 REST API Server listening on http://localhost:${PORT}`);
});