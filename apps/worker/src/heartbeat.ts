import { prisma, WorkerStatus } from "@scheduler/database";

export class HeartbeatManager {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private workerId: string,
    private getActiveJobCount: () => number,
    private intervalMs: number = 5000
  ) {}

  public start(): void {
    this.timer = setInterval(async () => {
      try {
        await prisma.worker.update({
          where: { id: this.workerId },
          data: {
            lastHeartbeat: new Date(),
            activeJobs: this.getActiveJobCount(),
            status: WorkerStatus.ACTIVE,
          },
        });
      } catch (err) {
        console.error(`[Worker ${this.workerId}] Heartbeat ping failed:`, err);
      }
    }, this.intervalMs);
  }

  public async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}