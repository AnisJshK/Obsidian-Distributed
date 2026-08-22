import { z } from "zod";
import { BackoffType } from "@scheduler/database";

export const CreateJobSchema = z.object({
  queueName: z.string().min(1, "queueName is required"),
  payload: z.record(z.unknown()).default({}),
  priority: z.number().int().default(0),
  delayMs: z.number().int().nonnegative().optional(),
  runAt: z.string().datetime().optional(),
  timeoutMs: z.number().int().positive().default(30000),
  maxRetries: z.number().int().nonnegative().default(3),
  backoffType: z.nativeEnum(BackoffType).default(BackoffType.EXPONENTIAL),
  backoffDelayMs: z.number().int().positive().default(1000),
  parentJobIds: z.array(z.string().uuid()).optional(),
});

export const CreateBatchJobSchema = z.object({
  name: z.string().optional(),
  onCompleteUrl: z.string().url().optional(),
  jobs: z.array(CreateJobSchema).min(1, "Batch must contain at least one job"),
});

export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type CreateBatchInput = z.infer<typeof CreateBatchJobSchema>;