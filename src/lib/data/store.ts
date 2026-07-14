/**
 * Persistence facade — the single import surface for all app data access.
 *
 * Every function here is async and routes to one of two implementations at
 * call time:
 *
 *   - DATABASE_URL set      -> src/lib/db/repositories/*  (real Postgres +
 *                              pgvector, embeddings via EMBEDDING_PROVIDER)
 *   - DATABASE_URL not set  -> src/lib/data/memory-store.ts  (zero-setup,
 *                              in-process fallback so `npm run dev` works
 *                              with no external services)
 *
 * Routing at call time (not import time) matters: it keeps the mock path
 * from ever opening a DB connection, and lets tests flip the env var
 * per-suite. Services and routes must import from THIS file only — never
 * from memory-store or the repositories directly — so the mode stays a
 * deployment decision, not a code path decision.
 */
import { isDatabaseConfigured } from "@/lib/db/client";
import * as memoryStore from "@/lib/data/memory-store";
import { getAgentCatalog, getWorkflowCatalog } from "@/lib/data/definitions";
import type {
  AgentRun,
  AgentStep,
  AuditLog,
  Citation,
  DashboardSnapshot,
  EvaluationRecord,
  MemoryRecord,
  SearchResult,
  SecurityEvent,
  SessionUser,
  ToolCall,
  UsageEvent,
  WorkflowRun,
  WorkflowRunEvent,
} from "@/lib/types";

export const DEMO_ORG_ID = memoryStore.DEMO_ORG_ID;

// ---------------------------------------------------------------------------
// Auth / users
// ---------------------------------------------------------------------------

export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  if (isDatabaseConfigured()) {
    const { authenticateUser: dbAuthenticate } = await import("@/lib/db/repositories/users");
    return dbAuthenticate(email, password);
  }
  const user = memoryStore.findDemoUser(email);
  if (!user || user.password !== password) {
    return null;
  }
  return memoryStore.toSessionUser(user);
}

export async function getDemoUsers(organizationId: string): Promise<SessionUser[]> {
  if (isDatabaseConfigured()) {
    const { getDemoUsers: dbGetDemoUsers } = await import("@/lib/db/repositories/users");
    return dbGetDemoUsers(organizationId);
  }
  return memoryStore.getDemoUsers();
}

// ---------------------------------------------------------------------------
// Static catalogs (product configuration, identical in both modes)
// ---------------------------------------------------------------------------

export function listAgents(organizationId: string) {
  return getAgentCatalog(organizationId);
}

export function listWorkflows(organizationId: string) {
  return getWorkflowCatalog(organizationId);
}

export function getWorkflowTemplate(organizationId: string, workflowId: string) {
  return getWorkflowCatalog(organizationId).find((workflow) => workflow.id === workflowId);
}

// ---------------------------------------------------------------------------
// Documents + retrieval
// ---------------------------------------------------------------------------

export async function createDocument(input: {
  organizationId: string;
  title: string;
  mimeType: string;
  text: string;
  uploadedBy: string;
}) {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/documents");
    const { recordAuditLog } = await import("@/lib/db/repositories/governance");
    const document = await repo.createDocument(input);
    await recordAuditLog({
      organizationId: input.organizationId,
      actorUserId: input.uploadedBy,
      action: "document.indexed",
      targetType: "document",
      targetId: document.id,
      metadata: { chunks: document.chunkCount, mimeType: input.mimeType },
    });
    return document;
  }
  return memoryStore.createDocument(input);
}

export async function listDocuments(organizationId: string) {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/documents");
    return repo.listDocuments(organizationId);
  }
  return memoryStore.listDocuments(organizationId);
}

export async function searchKnowledge(organizationId: string, query: string, limit = 5): Promise<SearchResult[]> {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/documents");
    return repo.searchKnowledge(organizationId, query, limit);
  }
  return memoryStore.searchKnowledge(organizationId, query, limit);
}

export function searchToCitations(results: SearchResult[]): Citation[] {
  return memoryStore.searchToCitations(results);
}

// ---------------------------------------------------------------------------
// Conversations + memory
// ---------------------------------------------------------------------------

export async function getRecentMessages(organizationId: string) {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/memory");
    return repo.getRecentMessages(organizationId);
  }
  return memoryStore.getRecentMessages(organizationId);
}

export async function recordChatExchange(input: {
  organizationId: string;
  userId: string;
  prompt: string;
  answer: string;
  citations: Citation[];
  latencyMs: number;
}) {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/memory");
    const { recordUsageEvent } = await import("@/lib/db/repositories/governance");
    const { estimateTokens } = await import("@/lib/ai/chunking");
    const result = await repo.recordChatExchange(input);
    await recordUsageEvent({
      organizationId: input.organizationId,
      userId: input.userId,
      eventType: "chat.completion",
      tokensIn: estimateTokens(input.prompt),
      tokensOut: estimateTokens(input.answer),
      costUsd: Number(((estimateTokens(input.prompt) + estimateTokens(input.answer)) * 0.00008).toFixed(4)),
      latencyMs: input.latencyMs,
    });
    return result;
  }
  return memoryStore.recordChatExchange(input);
}

export async function listMemories(organizationId: string): Promise<MemoryRecord[]> {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/memory");
    return repo.listMemories(organizationId);
  }
  return memoryStore.listMemories(organizationId);
}

export async function writeMemory(input: {
  organizationId: string;
  userId?: string;
  type: "semantic" | "episodic" | "preference";
  content: string;
  reason?: string;
  importanceScore?: number;
  lastAccessedAt?: string;
  decayAt?: string;
  embeddingText?: string;
}): Promise<MemoryRecord> {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/memory");
    const { recordAuditLog } = await import("@/lib/db/repositories/governance");
    const memory = await repo.writeMemory(input);
    await recordAuditLog({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      action: "memory.written",
      targetType: "memory",
      targetId: memory.id,
      metadata: { type: input.type, importanceScore: input.importanceScore, reason: input.reason },
    });
    return memory;
  }
  return memoryStore.writeMemory(input);
}

export async function recallMemories(organizationId: string, query: string, limit = 5) {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/memory");
    return repo.recallMemories(organizationId, query, limit);
  }
  return memoryStore.recallMemories(organizationId, query, limit);
}

// ---------------------------------------------------------------------------
// Agent runs
// ---------------------------------------------------------------------------

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
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/agents");
    return repo.recordAgentRun(input);
  }
  return memoryStore.recordAgentRun(input);
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

export async function startWorkflowRun(input: { organizationId: string; workflowId: string; requestedBy: string }) {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/workflows");
    return repo.startWorkflowRun(input);
  }
  return memoryStore.startWorkflowRun(input);
}

export async function updateWorkflowRun(
  organizationId: string,
  runId: string,
  update: Partial<Pick<WorkflowRun, "status" | "currentStep" | "result">>,
) {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/workflows");
    return repo.updateWorkflowRun(organizationId, runId, update);
  }
  return memoryStore.updateWorkflowRun(organizationId, runId, update);
}

export async function getWorkflowRun(organizationId: string, runId: string) {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/workflows");
    return repo.getWorkflowRun(organizationId, runId);
  }
  return memoryStore.getWorkflowRun(organizationId, runId);
}

export async function appendWorkflowEvent(
  organizationId: string,
  workflowRunId: string,
  input: Omit<WorkflowRunEvent, "id" | "organizationId" | "workflowRunId" | "createdAt">,
) {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/workflows");
    return repo.appendWorkflowEvent(organizationId, workflowRunId, input);
  }
  return memoryStore.appendWorkflowEvent(organizationId, workflowRunId, input);
}

export async function listWorkflowEvents(organizationId: string, workflowRunId: string) {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/workflows");
    return repo.listWorkflowEvents(organizationId, workflowRunId);
  }
  return memoryStore.listWorkflowEvents(organizationId, workflowRunId);
}

// ---------------------------------------------------------------------------
// Tool calls
// ---------------------------------------------------------------------------

export async function createToolCall(input: {
  organizationId: string;
  workflowRunId?: string;
  agentRunId?: string;
  toolName: string;
  input: Record<string, unknown>;
  riskLevel?: ToolCall["riskLevel"];
  status?: ToolCall["status"];
}): Promise<ToolCall> {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/tools");
    return repo.createToolCall(input);
  }
  return memoryStore.createToolCall(input);
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
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/tools");
    return repo.resolveToolCall(input);
  }
  return memoryStore.resolveToolCall(input);
}

export async function listToolCalls(organizationId: string): Promise<ToolCall[]> {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/tools");
    return repo.listToolCalls(organizationId);
  }
  return memoryStore.listToolCalls(organizationId);
}

// ---------------------------------------------------------------------------
// Governance: audit, security, usage, evaluations
// ---------------------------------------------------------------------------

export async function recordAuditLog(input: Omit<AuditLog, "id" | "createdAt">) {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/governance");
    return repo.recordAuditLog(input);
  }
  return memoryStore.recordAuditLog(input);
}

export async function listAuditLogs(organizationId: string): Promise<AuditLog[]> {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/governance");
    return repo.listAuditLogs(organizationId);
  }
  return memoryStore.listAuditLogs(organizationId);
}

export async function recordSecurityEvent(input: Omit<SecurityEvent, "id" | "createdAt">) {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/governance");
    return repo.recordSecurityEvent(input);
  }
  return memoryStore.recordSecurityEvent(input);
}

export async function listSecurityEvents(organizationId: string): Promise<SecurityEvent[]> {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/governance");
    return repo.listSecurityEvents(organizationId);
  }
  return memoryStore.listSecurityEvents(organizationId);
}

export async function recordEvaluation(input: Omit<EvaluationRecord, "id" | "createdAt">) {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/governance");
    return repo.recordEvaluation(input);
  }
  return memoryStore.recordEvaluation(input);
}

export async function listEvaluations(organizationId: string): Promise<EvaluationRecord[]> {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/governance");
    return repo.listEvaluations(organizationId);
  }
  return memoryStore.listEvaluations(organizationId);
}

export async function listUsageEvents(organizationId: string): Promise<UsageEvent[]> {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/governance");
    return repo.listUsageEvents(organizationId);
  }
  return memoryStore.listUsageEvents(organizationId);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardSnapshot(organizationId: string): Promise<DashboardSnapshot> {
  if (isDatabaseConfigured()) {
    const repo = await import("@/lib/db/repositories/dashboard");
    return repo.getDashboardSnapshot(organizationId);
  }
  return memoryStore.getDashboardSnapshot(organizationId);
}
