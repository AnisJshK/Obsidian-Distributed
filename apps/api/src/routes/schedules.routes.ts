// apps/api/src/routes/schedules.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { prisma, ScheduleType, Prisma } from "@scheduler/database";
import { validate } from "../middleware/validate.middleware";
import { CreateRecurringScheduleSchema } from "../schemas/schedule.schema";
import CronExpressionParser from "cron-parser";

export const schedulesRouter = Router();

// ----------------------------------------------------
// 1. Create a Recurring Schedule
// ----------------------------------------------------
schedulesRouter.post(
  "/",
  validate(CreateRecurringScheduleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body;
      let initialNextRun: Date;
      const now = new Date();

      if (body.type === "CRON") {
        try {
          const parsed = CronExpressionParser.parse(body.expression, {
            currentDate: now,
            tz: body.timezone || "UTC",
          });
          initialNextRun = parsed.next().toDate();
        } catch (e: any) {
          return res.status(400).json({
            success: false,
            error: {
              code: "INVALID_CRON_EXPRESSION",
              message: `Invalid cron expression "${body.expression}": ${e.message}`,
            },
          });
        }
      } else {
        const intervalMs = Number.parseInt(body.expression, 10);
        if (!Number.isFinite(intervalMs) || intervalMs < 1000) {
          return res.status(400).json({
            success: false,
            error: {
              code: "INVALID_INTERVAL",
              message: "Interval must be an integer >= 1000 milliseconds.",
            },
          });
        }
        initialNextRun = new Date(now.getTime() + intervalMs);
      }

      // Resolve Queue within project
      const queue = await prisma.queue.findFirst({
        where: {
          name: body.queueName,
          projectId: body.projectId,
        },
      });

      if (!queue) {
        return res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Queue "${body.queueName}" does not exist in project "${body.projectId}".`,
          },
        });
      }

      const schedule = await prisma.recurringSchedule.create({
        data: {
          projectId: body.projectId,
          queueId: queue.id,
          name: body.name,
          type: body.type as ScheduleType,
          expression: body.expression,
          timezone: body.timezone || "UTC",
          payload: body.payload as Prisma.InputJsonValue,
          priority: body.priority,
          isActive: true,
          nextRunAt: initialNextRun,
        },
      });

      res.status(201).json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ----------------------------------------------------
// 2. List Schedules for a Project
// ----------------------------------------------------
schedulesRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_PARAM", message: "projectId query param is required." },
      });
    }

    const schedules = await prisma.recurringSchedule.findMany({
      where: { projectId },
      include: { queue: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    next(error);
  }
});