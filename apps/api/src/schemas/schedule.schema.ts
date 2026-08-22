// apps/api/src/schemas/schedule.schema.ts
import { z } from "zod";

export const CreateRecurringScheduleSchema = z.object({
  projectId: z.string().uuid(),
  queueName: z.string().min(1),
  name: z.string().min(1).max(100),
  type: z.enum(["CRON", "INTERVAL"]),
  expression: z.string().min(1),
  timezone: z.string().optional().default("UTC"),
  payload: z.record(z.any()),
  priority: z.number().int().min(1).max(20).optional().default(5),
});