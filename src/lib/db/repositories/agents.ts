import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { agentRuns, agentSteps } from "@/lib/db/schema";
import type { AgentRun, AgentStep } from "@/lib/types";

function toStep(row: typeof agentSteps.$inferSelect): AgentStep {
  return {
    id: row.id,
    organizationId: row.organizationId,
    agentRunId: row.agentRunId,
    agentName: row.agentName,
    status: row.status,
    summary: row.summary,
    latencyMs: row.latencyMs,
    attempt: row.attempt,
    startedAt: row.startedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    input: row.input,
    output: row.output,
    error: row.error ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function recordAgentRun(input: {
  organizationId: string;
  objective: string;
  steps: Omit<AgentStep, "id" | "organizationId" | "agentRunId" | "createdAt">[];
  status?: AgentRun["status"];
  modelUsed?: string;
  providerUsed?: string;
  tokensIn?: number;
  tokensOut?: number;
}): Promise<AgentRun> {
  const db = getDb();
  const latencyMs = input.steps.reduce((total, step) => total + step.latencyMs, 0);

  const [run] = await db
    .insert(agentRuns)
    .values({
      organizationId: input.organizationId,
      objective: input.objective,
      status: input.status ?? "completed",
      modelUsed: input.modelUsed ?? "mock-enterprise-orchestrator",
      providerUsed: input.providerUsed,
      costUsd: Number((latencyMs * 0.00004).toFixed(4)),
      latencyMs,
      tokensIn: input.tokensIn ?? 0,
      tokensOut: input.tokensOut ?? 0,
    })
    .returning();

  const stepRows =
    input.steps.length > 0
      ? await db
          .insert(agentSteps)
          .values(
            input.steps.map((step) => ({
              organizationId: input.organizationId,
              agentRunId: run.id,
              agentName: step.agentName,
              status: step.status,
              summary: step.summary,
              attempt: step.attempt ?? 1,
              input: step.input ?? {},
              output: step.output ?? {},
              error: step.error,
              latencyMs: step.latencyMs,
              startedAt: step.startedAt ? new Date(step.startedAt) : undefined,
              completedAt: step.completedAt ? new Date(step.completedAt) : undefined,
            })),
          )
          .returning()
      : [];

  return {
    id: run.id,
    organizationId: run.organizationId,
    objective: run.objective,
    status: run.status,
    modelUsed: run.modelUsed,
    costUsd: run.costUsd,
    latencyMs: run.latencyMs,
    providerUsed: run.providerUsed ?? undefined,
    tokensIn: run.tokensIn,
    tokensOut: run.tokensOut,
    steps: stepRows.map(toStep),
    createdAt: run.createdAt.toISOString(),
  };
}

export async function listAgentRuns(organizationId: string, limit = 8): Promise<AgentRun[]> {
  const db = getDb();
  const runs = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.organizationId, organizationId))
    .orderBy(desc(agentRuns.createdAt))
    .limit(limit);

  const results: AgentRun[] = [];
  for (const run of runs) {
    const steps = await db.select().from(agentSteps).where(eq(agentSteps.agentRunId, run.id));
    results.push({
      id: run.id,
      organizationId: run.organizationId,
      objective: run.objective,
      status: run.status,
      modelUsed: run.modelUsed,
      costUsd: run.costUsd,
      latencyMs: run.latencyMs,
      providerUsed: run.providerUsed ?? undefined,
      tokensIn: run.tokensIn,
      tokensOut: run.tokensOut,
      steps: steps.map(toStep),
      createdAt: run.createdAt.toISOString(),
    });
  }
  return results;
}

export async function countAgentRuns(organizationId: string) {
  const db = getDb();
  const rows = await db.select().from(agentRuns).where(eq(agentRuns.organizationId, organizationId));
  const successRate =
    rows.length === 0 ? 100 : Math.round((rows.filter((r) => r.status === "completed").length / rows.length) * 100);
  return { total: rows.length, successRate };
}
