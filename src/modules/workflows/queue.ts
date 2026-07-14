import { Queue } from "bullmq";
import { getRuntimeConfig } from "@/modules/shared/env";
import { logEvent } from "@/modules/shared/logger";

export type WorkflowQueueJob = {
  organizationId: string;
  workflowRunId: string;
  requestedBy: string;
};

export type WorkflowQueue = {
  name: string;
  enqueue(job: WorkflowQueueJob): Promise<{ jobId: string; provider: string }>;
};

const memoryJobs: Array<WorkflowQueueJob & { jobId: string; createdAt: string }> = [];
let bullQueue: Queue<WorkflowQueueJob> | null = null;

function getBullQueue() {
  const config = getRuntimeConfig();
  if (!config.REDIS_URL) {
    return null;
  }
  if (!bullQueue) {
    bullQueue = new Queue<WorkflowQueueJob>("enterprise-ai-os-workflows", {
      connection: { url: config.REDIS_URL },
    });
  }
  return bullQueue;
}

export function getWorkflowQueue(): WorkflowQueue {
  const config = getRuntimeConfig();

  if (config.features.bullmq) {
    return {
      name: "bullmq",
      async enqueue(job) {
        const queue = getBullQueue();
        if (!queue) {
          throw new Error("BullMQ requested but REDIS_URL is missing.");
        }
        const queued = await queue.add("workflow-run", job, {
          attempts: 3,
          backoff: { type: "exponential", delay: 500 },
          removeOnComplete: 100,
          removeOnFail: 250,
        });
        return { jobId: String(queued.id), provider: "bullmq" };
      },
    };
  }

  return {
    name: "memory",
    async enqueue(job) {
      const jobId = `memory-job-${crypto.randomUUID()}`;
      memoryJobs.unshift({ ...job, jobId, createdAt: new Date().toISOString() });
      memoryJobs.splice(100);
      logEvent(
        "info",
        {
          component: "workflows",
          action: "workflow.queued",
          organizationId: job.organizationId,
          userId: job.requestedBy,
        },
        "Workflow queued in in-memory queue provider",
        { workflowRunId: job.workflowRunId, jobId },
      );
      return { jobId, provider: "memory" };
    },
  };
}

export function listMemoryWorkflowJobs() {
  return memoryJobs;
}
