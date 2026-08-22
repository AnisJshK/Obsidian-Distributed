// apps/worker/src/webhook.ts
import { prisma } from "@scheduler/database";

export interface BatchWebhookPayload {
  event: "batch.completed" | "batch.failed";
  batchId: string;
  name: string | null;
  projectId: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  completedAt: string;
}

export class WebhookDispatcher {
  /**
   * Evaluates if a batch has finished all tasks and dispatches its onCompleteUrl webhook.
   */
  static async checkAndDispatchBatchWebhook(batchId: string): Promise<void> {
    try {
      const batch = await prisma.jobBatch.findUnique({
        where: { id: batchId },
      });

      if (!batch || !batch.onCompleteUrl) return;

      const isFinished = batch.completedJobs + batch.failedJobs >= batch.totalJobs;
      if (!isFinished) return;

      const payload: BatchWebhookPayload = {
        event: batch.failedJobs > 0 ? "batch.failed" : "batch.completed",
        batchId: batch.id,
        name: batch.name,
        projectId: batch.projectId,
        totalJobs: batch.totalJobs,
        completedJobs: batch.completedJobs,
        failedJobs: batch.failedJobs,
        completedAt: new Date().toISOString(),
      };

      // Dispatch webhook asynchronously in background with retry backoff
      this.sendWithBackoff(batch.onCompleteUrl, payload, 3).catch((err) => {
        console.error(
          `[WebhookDispatcher] Final failure sending webhook to ${batch.onCompleteUrl} for batch ${batchId}:`,
          err
        );
      });
    } catch (err) {
      console.error(`[WebhookDispatcher] Error checking batch webhook for batch ${batchId}:`, err);
    }
  }

  private static async sendWithBackoff(
    url: string,
    payload: BatchWebhookPayload,
    maxRetries = 3,
    attempt = 1
  ): Promise<void> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Distributed-Job-Scheduler-Webhook/1.0",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10-second timeout per attempt
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(
        `[WebhookDispatcher] Successfully delivered batch webhook to ${url} (Batch: ${payload.batchId}, Event: ${payload.event})`
      );
    } catch (error: any) {
      console.warn(
        `[WebhookDispatcher] Attempt ${attempt}/${maxRetries} failed for ${url}: ${error.message}`
      );

      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return this.sendWithBackoff(url, payload, maxRetries, attempt + 1);
      }
      throw error;
    }
  }
}