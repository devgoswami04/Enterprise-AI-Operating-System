/**
 * Background workflow worker.
 *
 * Consumes the "enterprise-ai-os-workflows" BullMQ queue (the producer lives
 * in src/modules/workflows/queue.ts) and drives runs through the exact same
 * processWorkflowRun() the SSE path uses — so background execution and live
 * streaming can never diverge in behavior.
 *
 * Requires: REDIS_URL and DATABASE_URL (state must be durable — running a
 * background worker against the in-memory store would be a different
 * process's memory, which is why this refuses to start without a DB).
 *
 * Usage:  npm run worker
 *
 * With the worker running, workflow runs enqueued with QUEUE_PROVIDER=bullmq
 * are processed asynchronously, survive app restarts (BullMQ retries with
 * exponential backoff per the producer's job options), and pause themselves
 * at approval gates. Approving the tool call from the UI resumes the run by
 * re-enqueuing it (see the tool execute route).
 */
import { Worker, type Job } from "bullmq";
import { isDatabaseConfigured } from "@/lib/db/client";
import { processWorkflowRun } from "@/lib/workflows/engine";
import type { WorkflowQueueJob } from "@/modules/workflows/queue";
import { getUserById } from "@/lib/db/repositories/users";
import { logEvent } from "@/modules/shared/logger";

const QUEUE_NAME = "enterprise-ai-os-workflows";

async function main() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error("REDIS_URL is not set. The worker requires Redis (docker compose up -d).");
    process.exit(1);
  }
  if (!isDatabaseConfigured()) {
    console.error("DATABASE_URL is not set. The worker requires durable Postgres state.");
    process.exit(1);
  }

  const worker = new Worker<WorkflowQueueJob>(
    QUEUE_NAME,
    async (job: Job<WorkflowQueueJob>) => {
      const { organizationId, workflowRunId, requestedBy } = job.data;
      const user = await getUserById(requestedBy);

      logEvent(
        "info",
        { component: "worker", action: "workflow.job.started", organizationId, userId: requestedBy },
        "Worker picked up workflow run",
        { workflowRunId, jobId: job.id, attempt: job.attemptsMade + 1 },
      );

      const outcome = await processWorkflowRun({
        organizationId,
        userId: requestedBy,
        userEmail: user?.email ?? "worker@system",
        runId: workflowRunId,
      });

      logEvent(
        "info",
        { component: "worker", action: "workflow.job.finished", organizationId, userId: requestedBy },
        `Workflow run reached terminal-or-paused state: ${outcome.status}`,
        { workflowRunId, jobId: job.id, outcome },
      );

      return outcome;
    },
    {
      connection: { url: redisUrl },
      concurrency: 4,
    },
  );

  worker.on("failed", (job, error) => {
    logEvent(
      "error",
      { component: "worker", action: "workflow.job.failed", organizationId: job?.data.organizationId ?? "unknown" },
      "Workflow job failed",
      { jobId: job?.id, error: error.message, attemptsMade: job?.attemptsMade },
    );
  });

  console.log(`Workflow worker listening on queue "${QUEUE_NAME}" (concurrency 4). Ctrl+C to stop.`);

  const shutdown = async () => {
    console.log("Shutting down worker...");
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Worker failed to start:", error);
  process.exit(1);
});
