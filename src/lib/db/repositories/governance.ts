import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { auditLogs, evaluations, securityEvents, usageEvents } from "@/lib/db/schema";
import type { AuditLog, EvaluationRecord, SecurityEvent, UsageEvent } from "@/lib/types";

export async function recordAuditLog(input: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog> {
  const db = getDb();
  const [row] = await db
    .insert(auditLogs)
    .values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ?? {},
    })
    .returning();
  return { ...input, id: row.id, createdAt: row.createdAt.toISOString() };
}

export async function listAuditLogs(organizationId: string, limit = 20): Promise<AuditLog[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, organizationId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    actorUserId: row.actorUserId ?? undefined,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function recordSecurityEvent(input: Omit<SecurityEvent, "id" | "createdAt">): Promise<SecurityEvent> {
  const db = getDb();
  const [row] = await db
    .insert(securityEvents)
    .values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      riskLevel: input.riskLevel,
      findings: input.findings,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
    })
    .returning();
  return { ...input, id: row.id, createdAt: row.createdAt.toISOString() };
}

export async function listSecurityEvents(organizationId: string, limit = 20): Promise<SecurityEvent[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(securityEvents)
    .where(eq(securityEvents.organizationId, organizationId))
    .orderBy(desc(securityEvents.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    actorUserId: row.actorUserId ?? undefined,
    riskLevel: row.riskLevel as SecurityEvent["riskLevel"],
    findings: row.findings,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function recordEvaluation(input: Omit<EvaluationRecord, "id" | "createdAt">): Promise<EvaluationRecord> {
  const db = getDb();
  const [row] = await db
    .insert(evaluations)
    .values({
      organizationId: input.organizationId,
      targetType: input.targetType,
      targetId: input.targetId,
      groundedness: input.groundedness,
      citationCoverage: input.citationCoverage,
      retrievalQuality: input.retrievalQuality,
      answerRelevance: input.answerRelevance,
      retrievalRelevance: input.retrievalRelevance,
      hallucinationRisk: input.hallucinationRisk,
      responseLatencyMs: input.responseLatencyMs,
      provider: input.provider,
      model: input.model,
      policyFlags: input.policyFlags ?? [],
      notes: input.notes,
    })
    .returning();
  return { ...input, id: row.id, createdAt: row.createdAt.toISOString() };
}

export async function listEvaluations(organizationId: string, limit = 20): Promise<EvaluationRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.organizationId, organizationId))
    .orderBy(desc(evaluations.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    targetType: row.targetType as EvaluationRecord["targetType"],
    targetId: row.targetId,
    groundedness: row.groundedness,
    citationCoverage: row.citationCoverage,
    retrievalQuality: row.retrievalQuality,
    answerRelevance: row.answerRelevance ?? undefined,
    retrievalRelevance: row.retrievalRelevance ?? undefined,
    hallucinationRisk: row.hallucinationRisk as EvaluationRecord["hallucinationRisk"],
    responseLatencyMs: row.responseLatencyMs ?? undefined,
    provider: row.provider ?? undefined,
    model: row.model ?? undefined,
    policyFlags: row.policyFlags,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function recordUsageEvent(input: Omit<UsageEvent, "id" | "createdAt">) {
  const db = getDb();
  const [row] = await db
    .insert(usageEvents)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      eventType: input.eventType,
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
      costUsd: input.costUsd,
      latencyMs: input.latencyMs,
      provider: input.provider,
      model: input.model,
      metadata: {},
    })
    .returning();
  return { ...input, id: row.id, createdAt: row.createdAt.toISOString() };
}

export async function listUsageEvents(organizationId: string): Promise<UsageEvent[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(usageEvents)
    .where(eq(usageEvents.organizationId, organizationId))
    .orderBy(desc(usageEvents.createdAt))
    .limit(100);
  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId ?? undefined,
    eventType: row.eventType,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    costUsd: row.costUsd,
    latencyMs: row.latencyMs,
    provider: row.provider ?? undefined,
    model: row.model ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }));
}
