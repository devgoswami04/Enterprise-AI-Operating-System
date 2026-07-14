import { resolveToolCall } from "@/lib/data/store";
import type { SessionUser } from "@/lib/types";
import { assessInput } from "@/lib/security/controls";
import { SecurityError } from "@/modules/shared/errors";
import { logEvent } from "@/modules/shared/logger";
import { getToolAdapter } from "@/modules/tools/adapters";
import type { ToolExecuteInput } from "@/modules/tools/schemas";

export async function executeToolThroughAdapter(input: {
  session: SessionUser;
  toolName: string;
  payload: ToolExecuteInput;
  requestId?: string;
}) {
  const assessment = assessInput(JSON.stringify(input.payload));
  if (assessment.riskLevel === "high" && input.payload.decision !== "approve") {
    throw new SecurityError("High-risk tool action requires explicit approval.", {
      findings: assessment.findings,
    });
  }

  if (input.payload.decision === "reject") {
    const call = await resolveToolCall({
      organizationId: input.session.organizationId,
      actorUserId: input.session.id,
      toolName: input.toolName,
      toolCallId: input.payload.toolCallId,
      status: "cancelled",
      output: {
        provider: "governance",
        message: input.payload.reason ?? "Rejected by approver.",
      },
      payload: { ...input.payload, rejected: true },
    });

    logEvent(
      "info",
      {
        component: "tools",
        action: "tool.rejected",
        organizationId: input.session.organizationId,
        userId: input.session.id,
        requestId: input.requestId,
      },
      "Tool action rejected by approver",
      { toolName: input.toolName, toolCallId: call.id },
    );

    return call;
  }

  const adapter = getToolAdapter(input.toolName);
  const adapterResult = await adapter.execute({
    toolName: input.toolName,
    action: input.payload.action ?? "execute",
    input: input.payload.input ?? input.payload,
    dryRun: input.payload.decision !== "approve",
  });

  const call = await resolveToolCall({
    organizationId: input.session.organizationId,
    actorUserId: input.session.id,
    toolName: input.toolName,
    toolCallId: input.payload.toolCallId,
    status: adapterResult.dryRun ? "dry_run" : "executed",
    output: {
      ...adapterResult,
      securityFindings: assessment.findings,
    },
    payload: {
      ...input.payload,
      adapter: adapter.name,
    },
  });

  logEvent(
    adapterResult.dryRun ? "info" : "warn",
    {
      component: "tools",
      action: "tool.executed",
      organizationId: input.session.organizationId,
      userId: input.session.id,
      requestId: input.requestId,
    },
    "Tool adapter execution completed",
    { toolName: input.toolName, provider: adapterResult.provider, dryRun: adapterResult.dryRun },
  );

  return call;
}
