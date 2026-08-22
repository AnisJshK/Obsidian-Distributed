import "dotenv/config";
import { prisma, UserRole } from "../src/index";

async function main() {
  console.log("🌱 Starting database seed with Prisma PG adapter...\n");

  // 1. Create Default Admin & Operator Users
  console.log("Creating default users...");
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@scheduler.local" },
    update: {},
    create: {
      email: "admin@scheduler.local",
      name: "System Admin",
      passwordHash: "$2a$12$e8YQ3P5R9T7V1X4Z0B2N4eGHIJKLMNOPQRST", // Placeholder bcrypt hash
      role: UserRole.ADMIN,
    },
  });

  const operatorUser = await prisma.user.upsert({
    where: { email: "operator@scheduler.local" },
    update: {},
    create: {
      email: "operator@scheduler.local",
      name: "Default Operator",
      passwordHash: "$2a$12$e8YQ3P5R9T7V1X4Z0B2N4eGHIJKLMNOPQRST",
      role: UserRole.OPERATOR,
    },
  });

  // 2. Create Default Workspace / Project
  console.log("Creating default project...");
  const defaultProject = await prisma.project.upsert({
    where: { slug: "production-system" },
    update: {},
    create: {
      name: "Production System",
      slug: "production-system",
      description: "Default workspace for core scheduling workflows",
      ownerId: adminUser.id,
    },
  });

  // 3. Create Default Queues under the Project
  console.log("Creating default queues...");
  const queueDefinitions = [
    { name: "default", maxConcurrency: 10 },
    { name: "notifications", maxConcurrency: 20 },
    { name: "billing", maxConcurrency: 5 },
    { name: "webhooks", maxConcurrency: 15 },
  ];

  for (const q of queueDefinitions) {
    const queue = await prisma.queue.upsert({
      where: {
        projectId_name: {
          projectId: defaultProject.id,
          name: q.name,
        },
      },
      update: { maxConcurrency: q.maxConcurrency },
      create: {
        projectId: defaultProject.id,
        name: q.name,
        maxConcurrency: q.maxConcurrency,
        isPaused: false,
      },
    });

    console.log(`  ✓ Queue: ${queue.name} (Concurrency: ${queue.maxConcurrency})`);
  }

  // 4. Create an Initial Sample Recurring Schedule (Every hour)
  console.log("Creating sample cron schedule...");
  const notificationsQueue = await prisma.queue.findUnique({
    where: {
      projectId_name: {
        projectId: defaultProject.id,
        name: "notifications",
      },
    },
  });

  if (notificationsQueue) {
    await prisma.recurringSchedule.upsert({
      where: { id: "sample-digest-schedule" },
      update: {},
      create: {
        id: "sample-digest-schedule",
        projectId: defaultProject.id,
        queueId: notificationsQueue.id,
        name: "Send Hourly Digest",
        expression: "0 * * * *",
        timezone: "UTC",
        payload: { task: "aggregate_metrics_digest", channel: "slack" },
        priority: 2,
        isActive: true,
        nextRunAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  }

  console.log("\n✅ Database seeded successfully with relational hierarchy.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });