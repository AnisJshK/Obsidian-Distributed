import type {
  JobStatus,
  BackoffType,
  WorkerStatus,
  UserRole,
  ScheduleType,
} from "@scheduler/database";

// Re-export DB enums for cross-app convenience
export type { JobStatus, BackoffType, WorkerStatus, UserRole, ScheduleType };

// ----------------------------------------------------
// 1. API INGESTION DTOs
// ----------------------------------------------------

export interface CreateJobDTO {
  queueName: string;
  payload: Record<string, unknown>;
  priority?: number;
  runAt?: string | Date;
  delayMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
  backoffType?: BackoffType;
  backoffDelayMs?: number;
  parentJobIds?: string[]; // For DAG dependency chaining
}

export interface CreateBatchDTO {
  name?: string;
  onCompleteUrl?: string;
  jobs: CreateJobDTO[];
}

export interface CreateRecurringScheduleDTO {
  queueName: string;
  name: string;
  type: ScheduleType;
  expression: string; // Cron syntax or millisecond interval
  timezone?: string;
  payload: Record<string, unknown>;
  priority?: number;
}

// ----------------------------------------------------
// 2. WORKER & RUNTIME TYPES
// ----------------------------------------------------

export interface WorkerHeartbeatPayload {
  workerId: string;
  hostname: string;
  pid: number;
  concurrency: number;
  activeJobs: number;
}

export interface JobExecutionResult {
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  logs?: string;
}

export type JobHandler = (
  payload: Record<string, unknown>,
  signal: AbortSignal
) => Promise<Record<string, unknown> | void>;

// ----------------------------------------------------
// 3. API RESPONSE CONTRACTS
// ----------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface QueueMetricsResponse {
  queueId: string;
  queueName: string;
  isPaused: boolean;
  maxConcurrency: number;
  stats: {
    queued: number;
    claimed: number;
    running: number;
    completed: number;
    failed: number;
    dlq: number;
  };
}

// ----------------------------------------------------
// 4. DAG & WORKFLOW PIPELINE DTOs
// ----------------------------------------------------

export type PriorityLevel = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export const PRIORITY_MAP: Record<PriorityLevel, number> = {
  LOW: 1,
  NORMAL: 5,
  HIGH: 10,
  CRITICAL: 20,
};

export interface WorkflowNodeInput {
  referenceId: string;
  queueName: string;
  payload: Record<string, unknown>;
  priority?: PriorityLevel | number;
  maxRetries?: number;
  timeoutMs?: number;
  dependsOn?: string[]; // Array of referenceIds that must complete first
}

export interface IngestWorkflowInput {
  projectId: string;
  workflowName: string;
  nodes: WorkflowNodeInput[];
}

export interface IngestWorkflowResponse {
  batchId: string;
  jobCount: number;
  rootJobIds: string[];
  jobMapping: Record<string, string>; // referenceId -> created jobId
}

// Export the DAG validator utility
export * from "./dag-validator";