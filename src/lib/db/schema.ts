import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "member", "viewer"]);
export const runStatusEnum = pgEnum("run_status", [
  "queued",
  "running",
  "waiting_approval",
  "completed",
  "failed",
  "skipped",
  "retried",
  "cancelled",
]);
export const toolStatusEnum = pgEnum("tool_status", [
  "proposed",
  "dry_run",
  "pending_approval",
  "approved",
  "executed",
  "blocked",
  "failed",
  "cancelled",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").default("enterprise-demo").notNull(),
  ...timestamps,
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatar: text("avatar"),
  ...timestamps,
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    role: roleEnum("role").notNull(),
    ...timestamps,
  },
  (table) => ({
    organizationIdx: index("memberships_organization_idx").on(table.organizationId),
    userIdx: index("memberships_user_idx").on(table.userId),
  }),
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    uploadedById: uuid("uploaded_by_id").references(() => users.id),
    title: text("title").notNull(),
    sourceType: text("source_type").notNull(),
    mimeType: text("mime_type").notNull(),
    status: text("status").default("indexed").notNull(),
    storageUri: text("storage_uri"),
    summary: text("summary"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => ({
    organizationIdx: index("documents_organization_idx").on(table.organizationId),
  }),
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    documentId: uuid("document_id")
      .references(() => documents.id)
      .notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 64 }).notNull(),
    tokenCount: integer("token_count").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => ({
    organizationIdx: index("document_chunks_organization_idx").on(table.organizationId),
    documentIdx: index("document_chunks_document_idx").on(table.documentId),
  }),
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    userId: uuid("user_id").references(() => users.id),
    title: text("title").notNull(),
    ...timestamps,
  },
  (table) => ({
    organizationIdx: index("conversations_organization_idx").on(table.organizationId),
  }),
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id)
      .notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index("messages_conversation_idx").on(table.conversationId),
  }),
);

export const citations = pgTable(
  "citations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    messageId: uuid("message_id").references(() => messages.id),
    documentId: uuid("document_id").references(() => documents.id),
    chunkId: uuid("chunk_id").references(() => documentChunks.id),
    quote: text("quote").notNull(),
    score: real("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    messageIdx: index("citations_message_idx").on(table.messageId),
  }),
);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    description: text("description").notNull(),
    modelPolicy: text("model_policy").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    organizationIdx: index("agents_organization_idx").on(table.organizationId),
  }),
);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    userId: uuid("user_id").references(() => users.id),
    objective: text("objective").notNull(),
    status: runStatusEnum("status").default("queued").notNull(),
    modelUsed: text("model_used").notNull(),
    providerUsed: text("provider_used"),
    costUsd: real("cost_usd").default(0).notNull(),
    latencyMs: integer("latency_ms").default(0).notNull(),
    tokensIn: integer("tokens_in").default(0).notNull(),
    tokensOut: integer("tokens_out").default(0).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => ({
    organizationIdx: index("agent_runs_organization_idx").on(table.organizationId),
  }),
);

export const agentSteps = pgTable(
  "agent_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    agentRunId: uuid("agent_run_id")
      .references(() => agentRuns.id)
      .notNull(),
    agentName: text("agent_name").notNull(),
    status: runStatusEnum("status").default("completed").notNull(),
    summary: text("summary").notNull(),
    attempt: integer("attempt").default(1).notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().default({}).notNull(),
    output: jsonb("output").$type<Record<string, unknown>>().default({}).notNull(),
    error: text("error"),
    latencyMs: integer("latency_ms").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    runIdx: index("agent_steps_run_idx").on(table.agentRunId),
  }),
);

export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    definition: jsonb("definition").$type<Record<string, unknown>>().default({}).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    organizationIdx: index("workflows_organization_idx").on(table.organizationId),
  }),
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    // Workflow definitions live in code (src/lib/data/definitions.ts) like
    // Airflow DAGs or Temporal workflows — versioned with the app, not rows
    // in a table. Runs therefore reference the definition by its stable slug.
    // The `workflows` table above remains for future org-authored dynamic
    // definitions.
    workflowId: text("workflow_id").notNull(),
    requestedById: uuid("requested_by_id").references(() => users.id),
    status: runStatusEnum("status").default("queued").notNull(),
    currentStep: integer("current_step").default(0).notNull(),
    result: jsonb("result").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => ({
    organizationIdx: index("workflow_runs_organization_idx").on(table.organizationId),
    workflowIdx: index("workflow_runs_workflow_idx").on(table.workflowId),
  }),
);

export const toolCalls = pgTable(
  "tool_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    workflowRunId: uuid("workflow_run_id").references(() => workflowRuns.id),
    agentRunId: uuid("agent_run_id").references(() => agentRuns.id),
    toolName: text("tool_name").notNull(),
    status: toolStatusEnum("status").default("dry_run").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().default({}).notNull(),
    output: jsonb("output").$type<Record<string, unknown>>().default({}).notNull(),
    riskLevel: text("risk_level").default("low").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("tool_calls_organization_idx").on(table.organizationId),
  }),
);

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    userId: uuid("user_id").references(() => users.id),
    type: text("type").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 64 }).notNull(),
    importanceScore: integer("importance_score").default(50).notNull(),
    reason: text("reason"),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    decayAt: timestamp("decay_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => ({
    organizationIdx: index("memories_organization_idx").on(table.organizationId),
  }),
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("audit_logs_organization_idx").on(table.organizationId),
  }),
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    userId: uuid("user_id").references(() => users.id),
    eventType: text("event_type").notNull(),
    tokensIn: integer("tokens_in").default(0).notNull(),
    tokensOut: integer("tokens_out").default(0).notNull(),
    costUsd: real("cost_usd").default(0).notNull(),
    latencyMs: integer("latency_ms").default(0).notNull(),
    provider: text("provider"),
    model: text("model"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("usage_events_organization_idx").on(table.organizationId),
  }),
);

export const securityEvents = pgTable(
  "security_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    riskLevel: text("risk_level").notNull(),
    findings: jsonb("findings").$type<string[]>().default([]).notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("security_events_organization_idx").on(table.organizationId),
  }),
);

export const evaluations = pgTable(
  "evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    groundedness: integer("groundedness").default(0).notNull(),
    citationCoverage: integer("citation_coverage").default(0).notNull(),
    retrievalQuality: integer("retrieval_quality").default(0).notNull(),
    answerRelevance: integer("answer_relevance"),
    retrievalRelevance: integer("retrieval_relevance"),
    hallucinationRisk: text("hallucination_risk").notNull(),
    responseLatencyMs: integer("response_latency_ms"),
    provider: text("provider"),
    model: text("model"),
    policyFlags: jsonb("policy_flags").$type<string[]>().default([]).notNull(),
    notes: jsonb("notes").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("evaluations_organization_idx").on(table.organizationId),
  }),
);

export const workflowRunEvents = pgTable(
  "workflow_run_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    workflowRunId: uuid("workflow_run_id")
      .references(() => workflowRuns.id)
      .notNull(),
    type: text("type").notNull(),
    message: text("message").notNull(),
    stepIndex: integer("step_index"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    runIdx: index("workflow_run_events_run_idx").on(table.workflowRunId),
  }),
);
