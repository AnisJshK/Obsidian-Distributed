// apps/api/src/server.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// Routers
import { authRouter } from "./routes/auth.routes";
import {projectsRouter}  from "./routes/projects.routes";
import {keysRouter} from "./routes/keys.routes"
import queuesRouter from "./routes/queues.routes";
import dlqRouter from "./routes/dlq.routes";
import jobsRouter from "./routes/jobs.routes";
import workersRouter from "./routes/workers.routes";
import { workflowsRouter } from "./routes/workflows.routes";
import { schedulesRouter } from "./routes/schedules.routes";

// Middlewares
import { requireUser, requireApiKey, requireProjectAuth } from "./middleware/auth.middleware";
import { errorHandler } from "./middleware/error.middleware";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin:"http://localhost:5173",
  credentials:true
}));
app.use(express.json());
app.use(cookieParser());

// Public Auth Provisioning
app.use("/api/auth", authRouter);

// Health Check (Public readiness probe)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Dashboard & Management Routes — Human session required (requireUser)
app.use("/api/projects", requireUser, projectsRouter);
app.use("/api/keys", requireUser, keysRouter);
app.use("/api/queues", requireUser, queuesRouter);
app.use("/api/dlq", requireUser, dlqRouter);
app.use("/api/workflows", requireUser, workflowsRouter);
app.use("/api/schedules", requireUser, schedulesRouter);

// Machine Routes — API key required (requireApiKey)
app.use("/api/v1/jobs", requireProjectAuth, jobsRouter);
app.use("/api/v1/worker", requireProjectAuth, workersRouter);

// Centralized error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🌐 REST API Server listening on http://localhost:${PORT}`);
});