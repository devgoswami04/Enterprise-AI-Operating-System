import { and, desc, eq } from "drizzle-orm";
import { getWorkflowCatalog } from "@/lib/data/definitions";
import { getDb } from "@/lib/db/client";
import { auditLogs, workflowRunEvents, workflowRuns } from "@/lib/db/schema";
import type { RunStatus, WorkflowRun, WorkflowRunEvent } from "@/lib/types";

function toWorkflowRun(row: typeof workflowRuns.$inferSelect, workflowName: string, events: WorkflowRunEvent[]): WorkflowRun {
  return {
    id: row.id,
    organizationId: row.organizationId,
    workflowId: row.workflowId,
    workflowName,
    requestedBy: row.requestedById ?? "system",
    status: row.status,
    currentStep: row.currentStep,
    result: typeof row.result === "string" ? row.result : ((row.result as { message?: string })?.message ?? ""),
    events,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toEvent(row: typeof workflowRunEvents.$inferSelect): WorkflowRunEvent {
  return {
    id: row.id,
    organizationId: row.organizationId,
    workflowRunId: row.workflowRunId,
    type: row.type as WorkflowRunEvent["type"],
    message: row.message,
    stepIndex: row.stepIndex ?? undefined,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Workflow *templates* (the 4 built-in HR/Finance/Engineering/Ops
 * definitions) are static product configuration, not tenant data — see
 * lib/data/definitions.ts. What's real, tenant-scoped, and persisted here is
 * workflow *runs* and their events.
 */
export function listWorkflows(organizationId: string) {
  return getWorkflowCatalog(organizationId);
}

export function getWorkflowTemplate(organizationId: string, workflowId: string) {
  return getWorkflowCatalog(organizationId).find((workflow) => workflow.id === workflowId);
}

export async function startWorkflowRun(input: { organizationId: string; workflowId: string; requestedBy: string }) {
  const workflow = getWorkflowTemplate(input.organizationId, input.workflowId);
  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const db = getDb();
  const [row] = await db
    .insert(workflowRuns)
    .values({
      organizationId: input.organizationId,
      workflowId: workflow.id,
      requestedById: input.requestedBy,
      status: "running",
      currentStep: 0,
      result: { message: "Run accepted. Agents are preparing the execution graph." },
    })
    .returning();

  await db.insert(auditLogs).values({
    organizationId: input.organizationId,
    actorUserId: input.requestedBy,
    action: "workflow.started",
    targetType: "workflow_run",
    targetId: row.id,
    metadata: { workflow: workflow.name },
  });

  const run = toWorkflowRun(row, workflow.name, []);
  return { run, workflow };
}

export async function updateWorkflowRun(
  organizationId: string,
  runId: string,
  update: Partial<Pick<WorkflowRun, "status" | "currentStep" | "result">>,
) {
  const db = getDb();
  const [row] = await db
    .update(workflowRuns)
    .set({
      ...(update.status ? { status: update.status as RunStatus } : {}),
      ...(update.currentStep !== undefined ? { currentStep: update.currentStep } : {}),
      ...(update.result !== undefined ? { result: { message: update.result } } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(workflowRuns.organizationId, organizationId), eq(workflowRuns.id, runId)))
    .returning();

  if (!row) {
    throw new Error("Workflow run not found");
  }

  const workflow = getWorkflowTemplate(organizationId, row.workflowId);
  return toWorkflowRun(row, workflow?.name ?? "Workflow", []);
}

export async function getWorkflowRun(organizationId: string, runId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(workflowRuns)
    .where(and(eq(workflowRuns.organizationId, organizationId), eq(workflowRuns.id, runId)))
    .limit(1);
  if (!row) return undefined;

  const events = await db
    .select()
    .from(workflowRunEvents)
    .where(eq(workflowRunEvents.workflowRunId, runId))
    .orderBy(desc(workflowRunEvents.createdAt));

  const workflow = getWorkflowTemplate(organizationId, row.workflowId);
  return toWorkflowRun(row, workflow?.name ?? "Workflow", events.map(toEvent));
}

export async function listWorkflowRuns(organizationId: string, limit = 8): Promise<WorkflowRun[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.organizationId, organizationId))
    .orderBy(desc(workflowRuns.createdAt))
    .limit(limit);

  return rows.map((row) => {
    const workflow = getWorkflowTemplate(organizationId, row.workflowId);
    return toWorkflowRun(row, workflow?.name ?? "Workflow", []);
  });
}

export async function appendWorkflowEvent(
  organizationId: string,
  workflowRunId: string,
  input: Omit<WorkflowRunEvent, "id" | "organizationId" | "workflowRunId" | "createdAt">,
) {
  const db = getDb();
  const [row] = await db
    .insert(workflowRunEvents)
    .values({
      organizationId,
      workflowRunId,
      type: input.type,
      message: input.message,
      stepIndex: input.stepIndex,
      metadata: input.metadata ?? {},
    })
    .returning();
  return toEvent(row);
}

export async function listWorkflowEvents(organizationId: string, workflowRunId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(workflowRunEvents)
    .where(and(eq(workflowRunEvents.organizationId, organizationId), eq(workflowRunEvents.workflowRunId, workflowRunId)))
    .orderBy(desc(workflowRunEvents.createdAt));
  return rows.map(toEvent);
}
