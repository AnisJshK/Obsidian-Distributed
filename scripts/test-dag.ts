// scripts/test-dag.ts
const API_URL = process.env.API_URL;

// Set this to your actual API key, or pass it via env: API_KEY="djs_live_..." bun run scripts/test-dag.ts
const API_KEY = process.env.API_KEY || "djs_live_YOUR_KEY_HERE";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      ...(options.headers || {}),
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`[${res.status}] ${body?.error?.message || JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  console.log("==================================================");
  console.log("🧪 OBSIDIAN DISTRIBUTED: DAG DEPENDENCY TEST SUITE");
  console.log("==================================================");

  // 1. Resolve Session & Project Context
  console.log("\n[1/5] Resolving session context...");
  const sessionRes = await request("/auth/session");
  const project = sessionRes.data?.project;
  if (!project?.id) {
    throw new Error("Failed to resolve project from API key.");
  }
  console.log(`✓ Authenticated to Project: "${project.name}" (${project.id})`);

  // 2. Enqueue Parent Job (Job A)
  console.log("\n[2/5] Enqueueing Root Task (Job A)...");
  const jobARes = await request("/jobs", {
    method: "POST",
    body: JSON.stringify({
      projectId: project.id,
      queueName: "default",
      payload: { task: "send-email", step: "Root Job A", to: "dev@example.com" },
      priority: 10,
    }),
  });
  const jobA = jobARes.data;
  console.log(`✓ Job A created: ${jobA.id} (Initial Status: ${jobA.status})`);

  // 3. Enqueue Dependent Task (Job B depends on Job A)
  console.log("\n[3/5] Enqueueing Intermediate Task (Job B -> depends on Job A)...");
  const jobBRes = await request("/jobs", {
    method: "POST",
    body: JSON.stringify({
      projectId: project.id,
      queueName: "default",
      payload: { task: "resize-image", step: "Job B (Dependent)", width: 800 },
      parentJobIds: [jobA.id],
      priority: 5,
    }),
  });
  const jobB = jobBRes.data;
  console.log(`✓ Job B created: ${jobB.id} (Initial Status: ${jobB.status})`);

  // 4. Enqueue Leaf Task (Job C depends on Job B)
  console.log("\n[4/5] Enqueueing Leaf Task (Job C -> depends on Job B)...");
  const jobCRes = await request("/jobs", {
    method: "POST",
    body: JSON.stringify({
      projectId: project.id,
      queueName: "default",
      payload: { task: "default", step: "Job C (Leaf)", action: "archive" },
      parentJobIds: [jobB.id],
      priority: 5,
    }),
  });
  const jobC = jobCRes.data;
  console.log(`✓ Job C created: ${jobC.id} (Initial Status: ${jobC.status})`);

  // 5. Poll and Observe Sequential DAG Unblocking
  console.log("\n[5/5] Polling execution pipeline (watching unblock cascade)...");
  console.log("--------------------------------------------------");

  let completed = false;
  let attempts = 0;
  const maxAttempts = 30; // 60 seconds total

  while (!completed && attempts < maxAttempts) {
    attempts++;
    await sleep(2000);

    const jobsRes = await request(`/jobs?projectId=${project.id}`);
    const jobs: any[] = jobsRes.data || [];

    const stateA = jobs.find((j) => j.id === jobA.id);
    const stateB = jobs.find((j) => j.id === jobB.id);
    const stateC = jobs.find((j) => j.id === jobC.id);

    const format = (j: any) => `${j?.status || "UNKNOWN"} (retries: ${j?.retryCount ?? 0})`;

    console.log(
      `Tick ${String(attempts).padStart(2, "0")} | ` +
      `Job A: ${format(stateA).padEnd(14)} | ` +
      `Job B: ${format(stateB).padEnd(14)} | ` +
      `Job C: ${format(stateC).padEnd(14)}`
    );

    // Fail check
    if (stateA?.status === "DLQ" || stateB?.status === "DLQ" || stateC?.status === "DLQ") {
      console.log("\n❌ Workflow halted: A job transitioned to DLQ.");
      process.exit(1);
    }

    // Success check
    if (stateA?.status === "COMPLETED" && stateB?.status === "COMPLETED" && stateC?.status === "COMPLETED") {
      completed = true;
      console.log("--------------------------------------------------");
      console.log("🎉 SUCCESS: DAG Workflow executed in strict dependency order!");
      console.log("• Job A completed -> unblocked Job B");
      console.log("• Job B completed -> unblocked Job C");
      console.log("• Job C completed -> workflow finished cleanly");
      break;
    }
  }

  if (!completed) {
    console.log("\n⚠️ Timeout: DAG execution did not finish within 60 seconds.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ DAG Test Failed with Error:", err.message);
  process.exit(1);
});