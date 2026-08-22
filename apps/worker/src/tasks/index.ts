// apps/worker/src/tasks/index.ts
type TaskHandler = (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;

const taskHandlers: Record<string, TaskHandler> = {
  "send-email": async (payload) => {
    // Simulate an email send — replace with real provider call if you have one
    await new Promise((r) => setTimeout(r, 200));
    return { sent: true, to: payload.to ?? "unknown", subject: payload.subject ?? null };
  },

  "resize-image": async (payload) => {
    await new Promise((r) => setTimeout(r, 400));
    return { resized: true, width: payload.width ?? 800, height: payload.height ?? 600 };
  },

  "flaky-task": async () => {
    // Intentionally fails ~40% of the time — useful for demoing retries/backoff/DLQ live
    await new Promise((r) => setTimeout(r, 150));
    if (Math.random() < 0.4) {
      throw new Error("Simulated transient failure in flaky-task");
    }
    return { processed: true };
  },

  default: async (payload) => {
    await new Promise((r) => setTimeout(r, 300));
    return { processed: true, note: "No handler registered for this task type", payload };
  },
};

export async function runTask(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const taskName = typeof payload.task === "string" ? payload.task : "default";
  const handler = taskHandlers[taskName] ?? taskHandlers.default;
  return handler(payload);
}