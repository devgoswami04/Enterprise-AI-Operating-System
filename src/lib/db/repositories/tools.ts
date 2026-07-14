import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { auditLogs, toolCalls } from "@/lib/db/schema";
import type { ToolCall } from "@/lib/types";

function toToolCall(row: typeof toolCalls.$inferSelect): ToolCall {
  return {
    id: row.id,
    organizationId: row.organizationId,
    workflowRunId: row.workflowRunId ?? undefined,
    agentRunId: row.agentRunId ?? undefined,
    toolName: row.toolName,
    status: row.status,
    input: row.input,
    output: row.output,
    riskLevel: row.riskLevel as ToolCall["riskLevel"],
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listToolCalls(organizationId: string): Promise<ToolCall[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(toolCalls)
    .where(eq(toolCalls.organizationId, organizationId))
    .orderBy(desc(toolCalls.createdAt));
  return rows.map(toToolCall);
}

export async function createToolCall(input: {
  organizationId: string;
  workflowRunId?: string;
  agentRunId?: string;
  toolName: string;
  input: Record<string, unknown>;
  riskLevel?: ToolCall["riskLevel"];
  status?: ToolCall["status"];
}): Promise<ToolCall> {
  const db = getDb();
  const [row] = await db
    .insert(toolCalls)
    .values({
      organizationId: input.organizationId,
      workflowRunId: input.workflowRunId,
      agentRunId: input.agentRunId,
      toolName: input.toolName,
      status: input.status ?? "pending_approval",
      input: input.input,
      output: { dryRun: true, message: `${input.toolName} action prepared and held behind approval.` },
      riskLevel: input.riskLevel ?? "medium",
    })
    .returning();
  return toToolCall(row);
}

export async function updateToolCall(
  organizationId: string,
  toolCallId: string,
  update: { status: ToolCall["status"]; output: Record<string, unknown> },
): Promise<ToolCall | undefined> {
  const db = getDb();
  const [row] = await db
    .update(toolCalls)
    .set({ status: update.status, output: update.output })
    .where(and(eq(toolCalls.organizationId, organizationId), eq(toolCalls.id, toolCallId)))
    .returning();
  return row ? toToolCall(row) : undefined;
}

export async function resolveToolCall(input: {
  organizationId: string;
  actorUserId: string;
  toolName: string;
  toolCallId?: string;
  status: ToolCall["status"];
  output: Record<string, unknown>;
  riskLevel?: ToolCall["riskLevel"];
  payload?: Record<string, unknown>;
}): Promise<ToolCall> {
  const db = getDb();
  const existing = await findPendingToolCall(input.organizationId, input.toolName, input.toolCallId);

  const call =
    existing !== undefined
      ? (await updateToolCall(input.organizationId, existing.id, { status: input.status, output: input.output }))!
      : await createToolCall({
          organizationId: input.organizationId,
          toolName: input.toolName,
          input: input.payload ?? {},
          status: input.status,
          riskLevel: input.riskLevel ?? (input.toolName === "browser" || input.toolName === "github" ? "high" : "medium"),
        });

  await db.insert(auditLogs).values({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: input.status === "cancelled" ? "tool.rejected" : "tool.executed",
    targetType: "tool_call",
    targetId: call.id,
    metadata: { toolName: input.toolName },
  });

  return call;
}

export async function findPendingToolCall(
  organizationId: string,
  toolName: string,
  toolCallId?: string,
): Promise<ToolCall | undefined> {
  const db = getDb();
  const rows = await db
    .select()
    .from(toolCalls)
    .where(
      and(
        eq(toolCalls.organizationId, organizationId),
        eq(toolCalls.toolName, toolName),
        eq(toolCalls.status, "pending_approval"),
      ),
    )
    .orderBy(desc(toolCalls.createdAt));

  const match = toolCallId ? rows.find((row) => row.id === toolCallId) : rows[0];
  return match ? toToolCall(match) : undefined;
}
