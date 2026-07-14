import { startWorkflowRun, updateWorkflowRun } from "@/lib/data/store";
import type { SessionUser } from "@/lib/types";
import { getWorkflowQueue } from "@/modules/workflows/queue";
import { logEvent } from "@/modules/shared/logger";

export async function startQueuedWorkflow(input: {
  session: SessionUser;
  workflowId: string;
  requestId?: string;
}) {
  const { run, workflow } = startWorkflowRun({
    organizationId: input.session.organizationId,
    workflowId: input.workflowId,
    requestedBy: input.session.id,
  });

  updateWorkflowRun(input.session.organizationId, run.id, {
    status: "queued",
    result: "Run persisted and queued for worker execution.",
  });

  const queued = await getWorkflowQueue().enqueue({
    organizationId: input.session.organizationId,
    workflowRunId: run.id,
    requestedBy: input.session.id,
  });

  logEvent(
    "info",
    {
      component: "workflows",
      action: "workflow.run.created",
      organizationId: input.session.organizationId,
      userId: input.session.id,
      requestId: input.requestId,
    },
    "Workflow run created and queued",
    { workflowRunId: run.id, workflowId: workflow.id, queueProvider: queued.provider, jobId: queued.jobId },
  );

  return { run, workflow, queue: queued };
}
