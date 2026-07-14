import { chunkText, estimateTokens, summarizeText } from "@/lib/ai/chunking";
import { embedText } from "@/lib/ai/embeddings";
import { rankChunks } from "@/lib/ai/retrieval";
import type {
  Agent,
  AgentRun,
  AgentStep,
  AuditLog,
  ChatMessage,
  Citation,
  DashboardSnapshot,
  DemoUser,
  DocumentChunkRecord,
  DocumentRecord,
  MemoryRecord,
  EvaluationRecord,
  SearchResult,
  SecurityEvent,
  SessionUser,
  ToolCall,
  UsageEvent,
  WorkflowRunEvent,
  WorkflowRun,
  WorkflowTemplate,
} from "@/lib/types";

export const DEMO_ORG_ID = "org-nova";

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

const demoUsers: DemoUser[] = [
  {
    id: "user-admin",
    organizationId: DEMO_ORG_ID,
    organizationName: "NovaWorks Enterprise",
    email: "admin@novaworks.ai",
    name: "Ava Chen",
    role: "admin",
    avatar: "AC",
    password: "admin123",
  },
  {
    id: "user-member",
    organizationId: DEMO_ORG_ID,
    organizationName: "NovaWorks Enterprise",
    email: "member@novaworks.ai",
    name: "Marcus Lee",
    role: "member",
    avatar: "ML",
    password: "member123",
  },
  {
    id: "user-viewer",
    organizationId: DEMO_ORG_ID,
    organizationName: "NovaWorks Enterprise",
    email: "viewer@novaworks.ai",
    name: "Priya Shah",
    role: "viewer",
    avatar: "PS",
    password: "viewer123",
  },
];

const agents: Agent[] = [
  {
    id: "agent-planner",
    organizationId: DEMO_ORG_ID,
    name: "Planner Agent",
    type: "planner",
    description: "Breaks enterprise requests into controllable execution plans.",
    modelPolicy: "mock now, openai/gpt-5.4 via Vercel AI Gateway when enabled",
    enabled: true,
  },
  {
    id: "agent-research",
    organizationId: DEMO_ORG_ID,
    name: "Research Agent",
    type: "retrieval",
    description: "Searches company knowledge and connector metadata.",
    modelPolicy: "deterministic embeddings with pgvector-ready adapter",
    enabled: true,
  },
  {
    id: "agent-analyst",
    organizationId: DEMO_ORG_ID,
    name: "Analyst Agent",
    type: "analysis",
    description: "Extracts risks, KPIs, anomalies, and operational themes.",
    modelPolicy: "mock now, cloud/local hybrid later",
    enabled: true,
  },
  {
    id: "agent-writer",
    organizationId: DEMO_ORG_ID,
    name: "Writer Agent",
    type: "synthesis",
    description: "Creates cited reports, summaries, and action plans.",
    modelPolicy: "mock now, provider-routed later",
    enabled: true,
  },
  {
    id: "agent-security",
    organizationId: DEMO_ORG_ID,
    name: "Security Agent",
    type: "guardrail",
    description: "Reviews tool use, prompt injection risk, data scope, and approvals.",
    modelPolicy: "rules-first guardrail with AI evaluation hooks",
    enabled: true,
  },
];

const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "workflow-hr-resume",
    organizationId: DEMO_ORG_ID,
    name: "HR Candidate Review",
    category: "HR",
    description: "Summarize resumes, rank candidates, draft interview plans, and schedule follow-ups.",
    enabled: true,
    steps: [
      { name: "Collect candidate packets", agent: "Research Agent" },
      { name: "Score qualifications", agent: "Analyst Agent" },
      { name: "Draft interview brief", agent: "Writer Agent" },
      { name: "Schedule panel interview", agent: "Workflow Agent", tool: "calendar", approvalRequired: true },
    ],
  },
  {
    id: "workflow-finance-invoice",
    organizationId: DEMO_ORG_ID,
    name: "Finance Invoice Audit",
    category: "Finance",
    description: "Extract invoice data, detect anomalies, create action items, and notify finance owners.",
    enabled: true,
    steps: [
      { name: "Parse invoices", agent: "Research Agent" },
      { name: "Detect fraud signals", agent: "Analyst Agent" },
      { name: "Create exceptions report", agent: "Writer Agent" },
      { name: "Notify finance channel", agent: "Workflow Agent", tool: "slack", approvalRequired: true },
    ],
  },
  {
    id: "workflow-eng-triage",
    organizationId: DEMO_ORG_ID,
    name: "Engineering Bug Triage",
    category: "Engineering",
    description: "Cluster issues, summarize reproduction notes, create Jira tickets, and prepare release notes.",
    enabled: true,
    steps: [
      { name: "Group incoming reports", agent: "Planner Agent" },
      { name: "Find related docs", agent: "Research Agent" },
      { name: "Create Jira ticket plan", agent: "Analyst Agent", tool: "jira", approvalRequired: true },
      { name: "Draft release summary", agent: "Writer Agent" },
    ],
  },
  {
    id: "workflow-ops-weekly",
    organizationId: DEMO_ORG_ID,
    name: "Operations Weekly Brief",
    category: "Operations",
    description: "Summarize operational health, open risks, owners, and executive-ready next actions.",
    enabled: true,
    steps: [
      { name: "Gather ops metrics", agent: "Research Agent" },
      { name: "Prioritize risks", agent: "Analyst Agent" },
      { name: "Generate brief", agent: "Writer Agent" },
      { name: "Share leadership update", agent: "Workflow Agent", tool: "gmail", approvalRequired: true },
    ],
  },
];

const documents: DocumentRecord[] = [];
const chunks: DocumentChunkRecord[] = [];
const conversations: ChatMessage[] = [];
const agentRuns: AgentRun[] = [];
const workflowRuns: WorkflowRun[] = [];
const workflowRunEvents: WorkflowRunEvent[] = [];
const toolCalls: ToolCall[] = [];
const memories: MemoryRecord[] = [];
const auditLogs: AuditLog[] = [];
const usageEvents: UsageEvent[] = [];
const securityEvents: SecurityEvent[] = [
  {
    id: "security-seed-prompt-controls",
    organizationId: DEMO_ORG_ID,
    actorUserId: "user-admin",
    riskLevel: "high",
    findings: ["prompt_injection_signal", "sensitive_data_masked", "approval_gate_required"],
    action: "chat.input_assessed",
    targetType: "agent_run",
    targetId: "agent-run-seed-security",
    createdAt: now(),
  },
];
const evaluations: EvaluationRecord[] = [
  {
    id: "eval-seed-rag-quality",
    organizationId: DEMO_ORG_ID,
    targetType: "chat",
    targetId: "agent-run-seed-security",
    groundedness: 88,
    citationCoverage: 75,
    retrievalQuality: 83,
    hallucinationRisk: "low",
    notes: ["3 citations attached", "seeded evaluation for dashboard readiness"],
    createdAt: now(),
  },
];

const seedDocuments = [
  {
    title: "Q2 Revenue and Risk Review",
    mimeType: "text/markdown",
    text: `Q2 revenue grew 18.4 percent quarter over quarter, led by enterprise renewals and a 31 percent increase in workflow automation seats.
Key risks include elongated procurement cycles, concentration in three strategic accounts, and increased cloud inference cost.
Recommended actions: expand self-serve onboarding, cap low-value model calls, and assign executive owners to the three largest renewal risks.`,
  },
  {
    title: "Security and AI Tooling Policy",
    mimeType: "text/markdown",
    text: `Employees may use AI agents with company data only inside approved workspaces.
High-risk actions such as sending email, creating public issues, changing calendar invites, or exporting documents require an approval record.
Prompt injection warnings, sensitive data detection, tool execution logs, and retrieval citations must be visible to administrators.`,
  },
  {
    title: "Engineering Release Operating Rhythm",
    mimeType: "text/plain",
    text: `Engineering teams triage bugs daily, create Jira issues for confirmed defects, and publish weekly release summaries.
Critical issues require linked source documents, an owner, reproduction notes, customer impact, and rollback guidance.
AI agents can cluster tickets and draft release notes, but production changes must stay behind human approval.`,
  },
  {
    title: "HR Interview Loop Playbook",
    mimeType: "text/plain",
    text: `Recruiting coordinators prepare candidate briefs with role fit, resume highlights, risks, and recommended interview panels.
Calendar scheduling should avoid Friday evenings and must include interviewer load balancing.
AI-generated candidate summaries should cite uploaded resumes or notes and avoid unverified claims.`,
  },
];

function createDocumentRecord(input: {
  organizationId: string;
  title: string;
  mimeType: string;
  text: string;
  uploadedBy: string;
  sourceType?: DocumentRecord["sourceType"];
}) {
  const documentId = id("doc");
  const createdAt = now();
  const chunkTexts = chunkText(input.text);
  const chunkRecords = chunkTexts.map((content, chunkIndex) => ({
    id: id("chunk"),
    organizationId: input.organizationId,
    documentId,
    chunkIndex,
    content,
    embedding: embedText(content),
    tokenCount: estimateTokens(content),
    createdAt,
  }));

  const document: DocumentRecord = {
    id: documentId,
    organizationId: input.organizationId,
    title: input.title,
    sourceType: input.sourceType ?? "upload",
    mimeType: input.mimeType,
    status: "indexed",
    summary: summarizeText(input.text),
    uploadedBy: input.uploadedBy,
    chunkCount: chunkRecords.length,
    createdAt,
  };

  documents.unshift(document);
  chunks.push(...chunkRecords);

  return { document, chunks: chunkRecords };
}

for (const seed of seedDocuments) {
  createDocumentRecord({
    organizationId: DEMO_ORG_ID,
    title: seed.title,
    mimeType: seed.mimeType,
    text: seed.text,
    uploadedBy: "System Seed",
    sourceType: "seed",
  });
}

memories.push(
  {
    id: "memory-cost-policy",
    organizationId: DEMO_ORG_ID,
    type: "semantic",
    content: "NovaWorks prefers lower-cost local or mock execution for routine analysis and cloud reasoning for complex synthesis.",
    embedding: embedText("cost local mock cloud reasoning synthesis"),
    importanceScore: 82,
    reason: "Provider-routing preference used by the model router.",
    lastAccessedAt: now(),
    decayAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString(),
    createdAt: now(),
  },
  {
    id: "memory-approval-policy",
    organizationId: DEMO_ORG_ID,
    type: "episodic",
    content: "Tool actions that send, publish, schedule, or create external records require an approval audit trail.",
    embedding: embedText("approval audit send publish schedule create external"),
    importanceScore: 94,
    reason: "Security policy that influences every tool adapter.",
    lastAccessedAt: now(),
    decayAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(),
    createdAt: now(),
  },
);

toolCalls.push({
  id: "tool-seed-calendar-approval",
  organizationId: DEMO_ORG_ID,
  workflowRunId: "workflow-run-seed-ops",
  toolName: "calendar",
  status: "pending_approval",
  input: {
    action: "schedule_interview_panel",
    dryRun: true,
  },
  output: {
    preview: "Would create a calendar hold after manager approval.",
  },
  riskLevel: "medium",
  createdAt: now(),
});

usageEvents.push(
  {
    id: "usage-seed-1",
    organizationId: DEMO_ORG_ID,
    eventType: "rag.query",
    tokensIn: 1420,
    tokensOut: 620,
    costUsd: 0.18,
    latencyMs: 840,
    createdAt: now(),
  },
  {
    id: "usage-seed-2",
    organizationId: DEMO_ORG_ID,
    eventType: "workflow.run",
    tokensIn: 2110,
    tokensOut: 980,
    costUsd: 0.31,
    latencyMs: 1240,
    createdAt: now(),
  },
);

auditLogs.push({
  id: "audit-seed",
  organizationId: DEMO_ORG_ID,
  action: "workspace.seeded",
  targetType: "organization",
  targetId: DEMO_ORG_ID,
  metadata: { source: "mock-provider" },
  createdAt: now(),
});

export function getDemoUsers() {
  return demoUsers.map((user) => toSessionUser(user));
}

export function findDemoUser(email: string) {
  return demoUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

export function getUserById(userId: string) {
  return demoUsers.find((user) => user.id === userId);
}

export function listDocuments(organizationId: string) {
  return documents.filter((document) => document.organizationId === organizationId);
}

export function listAgents(organizationId: string) {
  return agents.filter((agent) => agent.organizationId === organizationId);
}

export function listWorkflows(organizationId: string) {
  return workflowTemplates.filter((workflow) => workflow.organizationId === organizationId);
}

export function listWorkflowRuns(organizationId: string) {
  return workflowRuns.filter((run) => run.organizationId === organizationId);
}

export function listToolCalls(organizationId: string) {
  return toolCalls.filter((call) => call.organizationId === organizationId);
}

export function listAuditLogs(organizationId: string) {
  return auditLogs.filter((entry) => entry.organizationId === organizationId).slice(0, 20);
}

export function listUsageEvents(organizationId: string) {
  return usageEvents.filter((event) => event.organizationId === organizationId);
}

export function listMemories(organizationId: string) {
  return memories
    .filter((memory) => memory.organizationId === organizationId)
    .sort((a, b) => (b.importanceScore ?? 0) - (a.importanceScore ?? 0));
}

export function writeMemory(input: Omit<MemoryRecord, "id" | "createdAt" | "embedding"> & {
  embeddingText?: string;
}) {
  const memory: MemoryRecord = {
    ...input,
    id: id("memory"),
    embedding: embedText(input.embeddingText ?? input.content),
    createdAt: now(),
  };
  memories.unshift(memory);
  auditLogs.unshift({
    id: id("audit"),
    organizationId: input.organizationId,
    actorUserId: input.userId,
    action: "memory.written",
    targetType: "memory",
    targetId: memory.id,
    metadata: {
      type: input.type,
      importanceScore: input.importanceScore,
      reason: input.reason,
    },
    createdAt: now(),
  });
  return memory;
}

export function recallMemories(organizationId: string, query: string, limit = 5) {
  const queryEmbedding = embedText(query);
  const scored = memories
    .filter((memory) => memory.organizationId === organizationId)
    .map((memory) => {
      const dot = memory.embedding.reduce((sum, value, index) => sum + value * (queryEmbedding[index] ?? 0), 0);
      const importance = (memory.importanceScore ?? 50) / 100;
      const score = dot * 0.75 + importance * 0.25;
      memory.lastAccessedAt = now();
      return { memory, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored;
}

export function listSecurityEvents(organizationId: string) {
  return securityEvents.filter((event) => event.organizationId === organizationId).slice(0, 20);
}

export function listEvaluations(organizationId: string) {
  return evaluations.filter((evaluation) => evaluation.organizationId === organizationId).slice(0, 20);
}

export function recordAuditLog(input: Omit<AuditLog, "id" | "createdAt">) {
  const entry: AuditLog = {
    ...input,
    id: id("audit"),
    createdAt: now(),
  };
  auditLogs.unshift(entry);
  return entry;
}

export function recordSecurityEvent(input: Omit<SecurityEvent, "id" | "createdAt">) {
  const event: SecurityEvent = {
    ...input,
    id: id("security"),
    createdAt: now(),
  };
  securityEvents.unshift(event);
  return event;
}

export function recordEvaluation(input: Omit<EvaluationRecord, "id" | "createdAt">) {
  const evaluation: EvaluationRecord = {
    ...input,
    id: id("eval"),
    createdAt: now(),
  };
  evaluations.unshift(evaluation);
  return evaluation;
}

export function createDocument(input: {
  organizationId: string;
  title: string;
  mimeType: string;
  text: string;
  uploadedBy: string;
}) {
  const result = createDocumentRecord(input);
  auditLogs.unshift({
    id: id("audit"),
    organizationId: input.organizationId,
    actorUserId: input.uploadedBy,
    action: "document.indexed",
    targetType: "document",
    targetId: result.document.id,
    metadata: { chunks: result.chunks.length, mimeType: input.mimeType },
    createdAt: now(),
  });
  return result.document;
}

export function searchKnowledge(
  organizationId: string,
  query: string,
  limit = 5,
): SearchResult[] {
  const organizationDocuments = listDocuments(organizationId);
  const organizationChunks = chunks.filter((chunk) => chunk.organizationId === organizationId);
  return rankChunks(query, organizationChunks, organizationDocuments, limit);
}

export function getRecentMessages(organizationId: string) {
  return conversations
    .filter((message) => message.organizationId === organizationId)
    .slice(-12);
}

export function recordChatExchange(input: {
  organizationId: string;
  userId: string;
  prompt: string;
  answer: string;
  citations: Citation[];
  latencyMs: number;
}) {
  const conversationId = `conversation-${input.userId}`;
  const createdAt = now();
  const userMessage: ChatMessage = {
    id: id("msg"),
    organizationId: input.organizationId,
    conversationId,
    role: "user",
    content: input.prompt,
    createdAt,
  };
  const assistantMessage: ChatMessage = {
    id: id("msg"),
    organizationId: input.organizationId,
    conversationId,
    role: "assistant",
    content: input.answer,
    citations: input.citations,
    createdAt: now(),
  };

  conversations.push(userMessage, assistantMessage);
  memories.unshift({
    organizationId: input.organizationId,
    userId: input.userId,
    type: "episodic",
    content: `Asked: ${input.prompt.slice(0, 140)}. Answered with ${input.citations.length} citations.`,
    importanceScore: Math.min(95, 35 + input.citations.length * 12),
    reason: "Conversation generated a reusable cited answer.",
    lastAccessedAt: now(),
    decayAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString(),
    embedding: embedText(input.prompt),
    id: id("memory"),
    createdAt: now(),
  });
  usageEvents.unshift({
    id: id("usage"),
    organizationId: input.organizationId,
    userId: input.userId,
    eventType: "chat.completion",
    tokensIn: estimateTokens(input.prompt),
    tokensOut: estimateTokens(input.answer),
    costUsd: Number(((estimateTokens(input.prompt) + estimateTokens(input.answer)) * 0.00008).toFixed(4)),
    latencyMs: input.latencyMs,
    createdAt: now(),
  });

  return assistantMessage;
}

export function recordAgentRun(input: {
  organizationId: string;
  objective: string;
  steps: Omit<AgentStep, "id" | "organizationId" | "agentRunId" | "createdAt">[];
  status?: AgentRun["status"];
  modelUsed?: string;
  providerUsed?: string;
  tokensIn?: number;
  tokensOut?: number;
}) {
  const runId = id("run");
  const createdAt = now();
  const steps = input.steps.map((step) => ({
    ...step,
    id: id("step"),
    organizationId: input.organizationId,
    agentRunId: runId,
    createdAt: now(),
  }));
  const latencyMs = steps.reduce((total, step) => total + step.latencyMs, 0);
  const run: AgentRun = {
    id: runId,
    organizationId: input.organizationId,
    objective: input.objective,
    status: input.status ?? "completed",
    modelUsed: input.modelUsed ?? (process.env.AI_PROVIDER === "gateway" ? "openai/gpt-5.4" : "mock-enterprise-orchestrator"),
    costUsd: Number((latencyMs * 0.00004).toFixed(4)),
    latencyMs,
    providerUsed: input.providerUsed,
    tokensIn: input.tokensIn,
    tokensOut: input.tokensOut,
    steps,
    createdAt,
  };

  agentRuns.unshift(run);
  return run;
}

export function startWorkflowRun(input: {
  organizationId: string;
  workflowId: string;
  requestedBy: string;
}) {
  const workflow = workflowTemplates.find(
    (candidate) =>
      candidate.organizationId === input.organizationId && candidate.id === input.workflowId,
  );

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const run: WorkflowRun = {
    id: id("wf-run"),
    organizationId: input.organizationId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    requestedBy: input.requestedBy,
    status: "running",
    currentStep: 0,
    result: "Run accepted. Agents are preparing the execution graph.",
    events: [],
    createdAt: now(),
    updatedAt: now(),
  };

  workflowRuns.unshift(run);
  auditLogs.unshift({
    id: id("audit"),
    organizationId: input.organizationId,
    actorUserId: input.requestedBy,
    action: "workflow.started",
    targetType: "workflow_run",
    targetId: run.id,
    metadata: { workflow: workflow.name },
    createdAt: now(),
  });

  return { run, workflow };
}

export function appendWorkflowEvent(
  organizationId: string,
  workflowRunId: string,
  input: Omit<WorkflowRunEvent, "id" | "organizationId" | "workflowRunId" | "createdAt">,
) {
  const event: WorkflowRunEvent = {
    ...input,
    id: id("wf-event"),
    organizationId,
    workflowRunId,
    createdAt: now(),
  };
  workflowRunEvents.unshift(event);
  const run = getWorkflowRun(organizationId, workflowRunId);
  if (run) {
    run.events = [event, ...(run.events ?? [])].slice(0, 50);
  }
  return event;
}

export function listWorkflowEvents(organizationId: string, workflowRunId: string) {
  return workflowRunEvents.filter(
    (event) => event.organizationId === organizationId && event.workflowRunId === workflowRunId,
  );
}

export function updateWorkflowRun(
  organizationId: string,
  runId: string,
  update: Partial<Pick<WorkflowRun, "status" | "currentStep" | "result">>,
) {
  const run = workflowRuns.find(
    (candidate) => candidate.organizationId === organizationId && candidate.id === runId,
  );

  if (!run) {
    throw new Error("Workflow run not found");
  }

  Object.assign(run, update, { updatedAt: now() });
  return run;
}

export function createToolCall(input: {
  organizationId: string;
  workflowRunId?: string;
  agentRunId?: string;
  toolName: string;
  input: Record<string, unknown>;
  riskLevel?: ToolCall["riskLevel"];
  status?: ToolCall["status"];
}) {
  const call: ToolCall = {
    id: id("tool"),
    organizationId: input.organizationId,
    workflowRunId: input.workflowRunId,
    agentRunId: input.agentRunId,
    toolName: input.toolName,
    status: input.status ?? "pending_approval",
    input: input.input,
    output: {
      dryRun: true,
      message: `${input.toolName} action prepared and held behind approval.`,
    },
    riskLevel: input.riskLevel ?? "medium",
    createdAt: now(),
  };

  toolCalls.unshift(call);
  return call;
}

export function executeTool(input: {
  organizationId: string;
  actorUserId: string;
  toolName: string;
  payload: Record<string, unknown>;
}) {
  const existingCall = toolCalls.find(
    (candidate) =>
      candidate.organizationId === input.organizationId &&
      candidate.toolName === input.toolName &&
      candidate.status === "pending_approval" &&
      (input.payload.toolCallId ? candidate.id === input.payload.toolCallId : true),
  );
  const call =
    existingCall ??
    createToolCall({
      organizationId: input.organizationId,
      toolName: input.toolName,
      input: input.payload,
      status: "executed",
      riskLevel: input.toolName === "browser" || input.toolName === "github" ? "high" : "medium",
    });

  call.status = "executed";
  call.output = {
    dryRun: false,
    provider: "mock",
    message: `${input.toolName} executed in dry-run provider mode.`,
    reference: id("external-ref"),
  };

  auditLogs.unshift({
    id: id("audit"),
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "tool.executed",
    targetType: "tool_call",
    targetId: call.id,
    metadata: { toolName: input.toolName, provider: "mock" },
    createdAt: now(),
  });

  return call;
}

export function getDashboardSnapshot(organizationId: string): DashboardSnapshot {
  const organizationRuns = workflowRuns.filter((run) => run.organizationId === organizationId);
  const organizationAgentRuns = agentRuns.filter((run) => run.organizationId === organizationId);
  const successRate =
    organizationAgentRuns.length === 0
      ? 100
      : Math.round(
          (organizationAgentRuns.filter((run) => run.status === "completed").length /
            organizationAgentRuns.length) *
            100,
        );

  return {
    metrics: {
      documents: listDocuments(organizationId).length,
      chunks: chunks.filter((chunk) => chunk.organizationId === organizationId).length,
      workflowsCompleted: organizationRuns.filter((run) => run.status === "completed").length,
      openApprovals: toolCalls.filter(
        (call) => call.organizationId === organizationId && call.status === "pending_approval",
      ).length,
      agentSuccessRate: successRate,
      monthlyCostUsd: Number(
        usageEvents
          .filter((event) => event.organizationId === organizationId)
          .reduce((sum, event) => sum + event.costUsd, 0)
          .toFixed(2),
      ),
    },
    documents: listDocuments(organizationId),
    agents: listAgents(organizationId),
    agentRuns: organizationAgentRuns.slice(0, 8),
    workflows: listWorkflows(organizationId),
    workflowRuns: organizationRuns.slice(0, 8),
    toolCalls: listToolCalls(organizationId).slice(0, 8),
    memories: memories.filter((memory) => memory.organizationId === organizationId).slice(0, 8),
    auditLogs: listAuditLogs(organizationId),
    usageEvents: listUsageEvents(organizationId),
    securityEvents: listSecurityEvents(organizationId),
    evaluations: listEvaluations(organizationId),
  };
}

export function searchToCitations(results: SearchResult[]): Citation[] {
  return results.map((result) => ({
    documentId: result.document.id,
    documentTitle: result.document.title,
    quote: summarizeText(result.chunk.content, 180),
    score: Number(result.score.toFixed(3)),
  }));
}

export function getWorkflowTemplate(organizationId: string, workflowId: string) {
  return workflowTemplates.find(
    (workflow) => workflow.organizationId === organizationId && workflow.id === workflowId,
  );
}

export function getWorkflowRun(organizationId: string, runId: string) {
  return workflowRuns.find((run) => run.organizationId === organizationId && run.id === runId);
}

export function toSessionUser(user: DemoUser): SessionUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    organizationName: user.organizationName,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
  };
}
