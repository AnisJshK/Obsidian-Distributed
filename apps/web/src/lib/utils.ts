// apps/web/src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeAgo(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "Never";
  const date = new Date(dateInput);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

// apps/web/src/lib/utils.ts
// apps/web/src/lib/utils.ts

export function resolveJobName(job: {
  id: string;
  name?: string | null;
  queue?: { name: string } | string | null;
  payload?: Record<string, unknown> | null;
}): string {
  // 1. Explicit name if provided
  if (job.name && job.name.trim() && job.name !== "standard_task") {
    return job.name;
  }

  // 2. Specific key in payload if named meaningfully
  if (job.payload && typeof job.payload === "object") {
    const p = job.payload as Record<string, any>;
    if (typeof p.action === "string") return p.action;
    if (typeof p.jobName === "string") return p.jobName;
    if (typeof p.name === "string") return p.name;
    if (typeof p.type === "string") return p.type;
  }

  // 3. Clean queue-based identifier: e.g. "email-outbound #3a2b1c" or "job_9f8e7d"
  const queueName = typeof job.queue === "string" ? job.queue : job.queue?.name;
  if (queueName && queueName !== "default") {
    return `${queueName} #${job.id.slice(0, 6)}`;
  }

  // 4. Default design format from screenshots: "job_9f8e7d"
  return `job_${job.id.slice(0, 8)}`;
}