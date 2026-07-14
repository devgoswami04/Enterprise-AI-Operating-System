import { requireApiSession } from "@/lib/auth";
import { updateWorkflowRun } from "@/lib/data/store";
import { processWorkflowRun } from "@/lib/workflows/engine";
import { requireRole } from "@/lib/security/rbac";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { toErrorResponse } from "@/modules/shared/errors";
import { createRequestId } from "@/modules/shared/logger";
import { parseJsonBody } from "@/modules/shared/validation";
import { toolExecuteSchema } from "@/modules/tools/schemas";
import { executeToolThroughAdapter } from "@/modules/tools/service";
import { getWorkflowQueue } from "@/modules/workflows/queue";

export async function POST(
  request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const session = await requireApiSession();
    requireRole(session, "member");
    const requestId = createRequestId("tool-api");
    const rateLimit = checkRateLimit(`tool:execute:${session.organizationId}:${session.id}`, {
      limit: 20,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Tool execution rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }
    const { tool } = (await context.params) as { tool: string };
    const payload = await parseJsonBody(request, toolExecuteSchema, "Tool execution");
    const call = await executeToolThroughAdapter({
      session,
      toolName: tool,
      payload,
      requestId,
    });

    if (typeof payload.workflowRunId === "string") {
      if (payload.decision === "reject") {
        await updateWorkflowRun(session.organizationId, payload.workflowRunId, {
          status: "cancelled",
          result: `${tool} action was rejected by ${session.name}.`,
        });
      } else {
        // Approval unblocks the paused run: resume it from its persisted
        // currentStep. Prefer the queue when configured so the worker picks
        // it up; otherwise resume inline so mock mode stays zero-setup.
        await updateWorkflowRun(session.organizationId, payload.workflowRunId, {
          status: "running",
          result: `${tool} approved by ${session.name}. Resuming remaining workflow steps.`,
        });
        const queue = getWorkflowQueue();
        if (queue.name === "bullmq") {
          await queue.enqueue({
            organizationId: session.organizationId,
            workflowRunId: payload.workflowRunId,
            requestedBy: session.id,
          });
        } else {
          await processWorkflowRun({
            organizationId: session.organizationId,
            userId: session.id,
            userEmail: session.email,
            runId: payload.workflowRunId,
          });
        }
      }
    }

    return Response.json({ toolCall: call }, { headers: rateLimitHeaders(rateLimit) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
