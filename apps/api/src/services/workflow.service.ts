// apps/api/src/services/workflow.service.ts
import { prisma, JobStatus, Prisma } from "@scheduler/database";
import {
  validateAndSortDag,
  IngestWorkflowInput,
  IngestWorkflowResponse,
  PRIORITY_MAP,
  PriorityLevel,
} from "@scheduler/types";
import { randomUUID } from "node:crypto";

const FAR_FUTURE_DATE = new Date("9999-12-31T23:59:59.999Z");

function resolvePriority(priority?: PriorityLevel | number): number {
  if (typeof priority === "number") return priority;
  if (priority && priority in PRIORITY_MAP) return PRIORITY_MAP[priority as PriorityLevel];
  return PRIORITY_MAP.NORMAL;
}

export async function ingestWorkflow(
  input: IngestWorkflowInput & { onCompleteUrl?: string }
): Promise<IngestWorkflowResponse> {
  // 1. Validate DAG and guarantee zero cycles before touching DB
  validateAndSortDag(input.nodes);

  // 2. Resolve Queues for this Project
  const queueNames = Array.from(new Set(input.nodes.map((n) => n.queueName)));
  const queues = await prisma.queue.findMany({
    where: {
      name: { in: queueNames },
      projectId: input.projectId,
    },
  });

  const queueMap = new Map(queues.map((q) => [q.name, q.id]));
  for (const name of queueNames) {
    if (!queueMap.has(name)) {
      throw new Error(`Queue "${name}" does not exist for project "${input.projectId}".`);
    }
  }

  // 3. Pre-generate IDs
  const batchId = randomUUID();
  const refToJobId: Record<string, string> = {};
  const rootJobIds: string[] = [];
  const now = new Date();

  for (const node of input.nodes) {
    const jobId = randomUUID();
    refToJobId[node.referenceId] = jobId;
    if (!node.dependsOn || node.dependsOn.length === 0) {
      rootJobIds.push(jobId);
    }
  }

  const jobRows = input.nodes.map((node) => {
    const isRoot = !node.dependsOn || node.dependsOn.length === 0;
    return {
      id: refToJobId[node.referenceId],
      queueId: queueMap.get(node.queueName)!,
      batchId: batchId,
      payload: (node.payload ?? {}) as Prisma.InputJsonValue,
      priority: resolvePriority(node.priority),
      maxRetries: node.maxRetries ?? 3,
      timeoutMs: node.timeoutMs ?? 30000,
      status: JobStatus.QUEUED,
      runAt: isRoot ? now : FAR_FUTURE_DATE,
    };
  });

  const dependencyRows: { parentJobId: string; childJobId: string }[] = [];
  for (const node of input.nodes) {
    if (node.dependsOn && node.dependsOn.length > 0) {
      const childJobId = refToJobId[node.referenceId];
      for (const parentRef of node.dependsOn) {
        const parentJobId = refToJobId[parentRef];
        dependencyRows.push({ parentJobId, childJobId });
      }
    }
  }

  // 4. Insert Batch with onCompleteUrl, Jobs, and DAG Dependencies
  try {
    await prisma.jobBatch.create({
      data: {
        id: batchId,
        projectId: input.projectId,
        name: input.workflowName,
        totalJobs: input.nodes.length,
        completedJobs: 0,
        failedJobs: 0,
        onCompleteUrl: input.onCompleteUrl ?? null, // <-- Saved to database
      },
    });

    await prisma.job.createMany({
      data: jobRows,
    });

    if (dependencyRows.length > 0) {
      await prisma.jobDependency.createMany({
        data: dependencyRows,
      });
    }
  } catch (error) {
    await prisma.jobBatch.delete({ where: { id: batchId } }).catch(() => {});
    throw error;
  }

  return {
    batchId,
    jobCount: input.nodes.length,
    rootJobIds,
    jobMapping: refToJobId,
  };
}