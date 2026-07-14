export type Role = "admin" | "member" | "viewer";

export type RunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "skipped"
  | "retried"
  | "cancelled";

export type ToolStatus =
  | "proposed"
  | "dry_run"
  | "pending_approval"
  | "approved"
  | "executed"
  | "blocked"
  | "failed"
  | "cancelled";

export type SessionUser = {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  name: string;
  role: Role;
  avatar: string;
};

export type DemoUser = SessionUser & {
  password: string;
};

export type DocumentRecord = {
  id: string;
  organizationId: string;
  title: string;
  sourceType: "upload" | "seed" | "connector";
  mimeType: string;
  status: "indexed" | "processing" | "failed";
  summary: string;
  uploadedBy: string;
  chunkCount: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type DocumentChunkRecord = {
  id: string;
  organizationId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  tokenCount: number;
  createdAt: string;
};

export type SearchResult = {
  chunk: DocumentChunkRecord;
  document: DocumentRecord;
  score: number;
};

export type Citation = {
  documentId: string;
  documentTitle: string;
  chunkId?: string;
  quote: string;
  score: number;
};

export type ChatMessage = {
  id: string;
  organizationId: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[];
  createdAt: string;
};

export type Agent = {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  description: string;
  modelPolicy: string;
  enabled: boolean;
};

export type AgentStep = {
  id: string;
  organizationId: string;
  agentRunId: string;
  agentName: string;
  status: RunStatus;
  summary: string;
  latencyMs: number;
  attempt?: number;
  startedAt?: string;
  completedAt?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  createdAt: string;
};

export type AgentRun = {
  id: string;
  organizationId: string;
  objective: string;
  status: RunStatus;
  modelUsed: string;
  costUsd: number;
  latencyMs: number;
  providerUsed?: string;
  tokensIn?: number;
  tokensOut?: number;
  steps: AgentStep[];
  createdAt: string;
};

export type WorkflowStepDefinition = {
  name: string;
  agent: string;
  tool?: string;
  approvalRequired?: boolean;
  dependsOn?: string[];
  retry?: {
    attempts: number;
    backoffMs: number;
  };
};

export type WorkflowTemplate = {
  id: string;
  organizationId: string;
  name: string;
  category: "HR" | "Finance" | "Engineering" | "Operations";
  description: string;
  steps: WorkflowStepDefinition[];
  enabled: boolean;
};

export type WorkflowRun = {
  id: string;
  organizationId: string;
  workflowId: string;
  workflowName: string;
  requestedBy: string;
  status: RunStatus;
  currentStep: number;
  result: string;
  events?: WorkflowRunEvent[];
  createdAt: string;
  updatedAt: string;
};

export type WorkflowRunEvent = {
  id: string;
  organizationId: string;
  workflowRunId: string;
  type: "queued" | "step_started" | "step_completed" | "approval_required" | "retry" | "failed" | "completed" | "cancelled";
  message: string;
  stepIndex?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ToolCall = {
  id: string;
  organizationId: string;
  workflowRunId?: string;
  agentRunId?: string;
  toolName: string;
  status: ToolStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  riskLevel: "low" | "medium" | "high";
  createdAt: string;
};

export type MemoryRecord = {
  id: string;
  organizationId: string;
  userId?: string;
  type: "semantic" | "episodic" | "preference";
  content: string;
  embedding: number[];
  importanceScore?: number;
  reason?: string;
  lastAccessedAt?: string;
  decayAt?: string;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  organizationId: string;
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type UsageEvent = {
  id: string;
  organizationId: string;
  userId?: string;
  eventType: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  provider?: string;
  model?: string;
  createdAt: string;
};

export type SecurityEvent = {
  id: string;
  organizationId: string;
  actorUserId?: string;
  riskLevel: "low" | "medium" | "high";
  findings: string[];
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
};

export type EvaluationRecord = {
  id: string;
  organizationId: string;
  targetType: "chat" | "retrieval" | "workflow";
  targetId: string;
  groundedness: number;
  citationCoverage: number;
  retrievalQuality: number;
  answerRelevance?: number;
  retrievalRelevance?: number;
  hallucinationRisk: "low" | "medium" | "high";
  responseLatencyMs?: number;
  provider?: string;
  model?: string;
  policyFlags?: string[];
  notes: string[];
  createdAt: string;
};

export type DashboardSnapshot = {
  metrics: {
    documents: number;
    chunks: number;
    workflowsCompleted: number;
    openApprovals: number;
    agentSuccessRate: number;
    monthlyCostUsd: number;
  };
  documents: DocumentRecord[];
  agents: Agent[];
  agentRuns: AgentRun[];
  workflows: WorkflowTemplate[];
  workflowRuns: WorkflowRun[];
  toolCalls: ToolCall[];
  memories: MemoryRecord[];
  auditLogs: AuditLog[];
  usageEvents: UsageEvent[];
  securityEvents: SecurityEvent[];
  evaluations: EvaluationRecord[];
};
