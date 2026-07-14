import { requireApiSession } from "@/lib/auth";
import { requireRole } from "@/lib/security/rbac";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { toErrorResponse } from "@/modules/shared/errors";
import { createRequestId } from "@/modules/shared/logger";
import { parseOptionalJsonBody } from "@/modules/shared/validation";
import { workflowStartSchema } from "@/modules/workflows/schemas";
import { startQueuedWorkflow } from "@/modules/workflows/service";

export async function POST(
  request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const session = await requireApiSession();
    requireRole(session, "member");
    const requestId = createRequestId("workflow-api");
    const rateLimit = checkRateLimit(`workflow:start:${session.organizationId}:${session.id}`, {
      limit: 12,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Workflow start rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }
    const { id } = (await context.params) as { id: string };
    await parseOptionalJsonBody(request, workflowStartSchema, "Workflow start", { dryRun: true });
    const { run, workflow, queue } = await startQueuedWorkflow({
      session,
      workflowId: id,
      requestId,
    });

    return Response.json({ run, workflow, queue }, { status: 201, headers: rateLimitHeaders(rateLimit) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
