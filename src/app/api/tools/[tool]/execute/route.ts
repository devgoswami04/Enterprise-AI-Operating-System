import { requireApiSession } from "@/lib/auth";
import { updateWorkflowRun } from "@/lib/data/store";
import { requireRole } from "@/lib/security/rbac";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { toErrorResponse } from "@/modules/shared/errors";
import { createRequestId } from "@/modules/shared/logger";
import { parseJsonBody } from "@/modules/shared/validation";
import { toolExecuteSchema } from "@/modules/tools/schemas";
import { executeToolThroughAdapter } from "@/modules/tools/service";

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
      updateWorkflowRun(session.organizationId, payload.workflowRunId, {
        status: payload.decision === "reject" ? "cancelled" : "completed",
        result:
          payload.decision === "reject"
            ? `${tool} action was rejected by ${session.name}.`
            : `${tool} was approved and executed by ${session.name}. Workflow marked complete.`,
      });
    }

    return Response.json({ toolCall: call }, { headers: rateLimitHeaders(rateLimit) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
