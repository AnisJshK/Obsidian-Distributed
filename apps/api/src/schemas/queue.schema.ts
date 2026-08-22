import { z } from "zod";

export const CreateQueueSchema = z.object({
  name: z.string().min(1, "Queue name is required").regex(/^[a-zA-Z0-9_-]+$/, "Alphanumeric, dash, or underscore only"),
  maxConcurrency: z.number().int().positive().default(10),
  rateLimitCount: z.number().int().positive().optional(),
  rateLimitWindowMs: z.number().int().positive().optional(),
});

export const UpdateQueueSchema = z.object({
  maxConcurrency: z.number().int().positive().optional(),
  isPaused: z.boolean().optional(),
  rateLimitCount: z.number().int().positive().nullable().optional(),
  rateLimitWindowMs: z.number().int().positive().nullable().optional(),
});