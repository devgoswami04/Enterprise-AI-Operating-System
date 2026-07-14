/**
 * End-to-end smoke test of the real Postgres path. Exercises the exact
 * repository + engine code the app uses (no HTTP layer):
 *   auth -> retrieval w/ citations -> chat orchestration -> workflow run
 *   -> approval gate -> approval resume -> audit/eval verification.
 */
import { authenticateUser } from "@/lib/db/repositories/users";
import { searchKnowledge, listDocuments } from "@/lib/db/repositories/documents";
import { orchestrateChat } from "@/lib/ai/orchestrator";
import { startWorkflowRun } from "@/lib/db/repositories/workflows";
import { processWorkflowRun } from "@/lib/workflows/engine";
import { getWorkflowRun } from "@/lib/db/repositories/workflows";
import { executeToolThroughAdapter } from "@/modules/tools/service";
import { listAuditLogs, listEvaluations } from "@/lib/db/repositories/governance";
import { listToolCalls } from "@/lib/db/repositories/tools";

function assert(condition: unknown, label: string) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`PASS: ${label}`);
}

async function main() {
  // 1. Real auth (bcrypt against Postgres)
  const admin = await authenticateUser("admin@novaworks.ai", "admin123");
  assert(admin && admin.role === "admin", "bcrypt auth returns admin session");
  const badLogin = await authenticateUser("admin@novaworks.ai", "wrongpass");
  assert(badLogin === null, "wrong password rejected");
  const session = admin!;

  // 2. Real pgvector retrieval with citations
  const docs = await listDocuments(session.organizationId);
  assert(docs.length >= 4, `documents listed from Postgres (${docs.length})`);
  const results = await searchKnowledge(session.organizationId, "What are the Q2 revenue risks?", 3);
  assert(results.length > 0, `pgvector retrieval returned ${results.length} chunks`);
  assert(results[0].document.title.includes("Q2"), `top result is the Q2 doc: "${results[0].document.title}"`);

  // 3. Full chat orchestration -> persisted agent run + evaluation + memory
  const chat = await orchestrateChat(session, "Summarize our Q2 revenue risks and recommended actions.");
  assert(chat.citations.length > 0, `chat produced ${chat.citations.length} citations`);
  assert(chat.steps.length >= 7, `agent graph executed ${chat.steps.length} steps`);
  assert(chat.runId.length > 10, `agent run persisted (${chat.runId})`);

  // 4. Workflow run: eng-triage has an approval-gated jira step at index 2
  const { run } = await startWorkflowRun({
    organizationId: session.organizationId,
    workflowId: "workflow-eng-triage",
    requestedBy: session.id,
  });
  const first = await processWorkflowRun({
    organizationId: session.organizationId,
    userId: session.id,
    userEmail: session.email,
    runId: run.id,
  });
  assert(first.status === "waiting_approval", `run paused at approval gate (${first.status})`);
  const paused = await getWorkflowRun(session.organizationId, run.id);
  assert(paused?.status === "waiting_approval", "persisted run status is waiting_approval");
  assert(Boolean(first.toolCallId), `pending tool call created (${first.toolCallId})`);

  // 5. Approve the tool call through the adapter service (mock-safe path)
  const approved = await executeToolThroughAdapter({
    session,
    toolName: "jira",
    payload: { toolCallId: first.toolCallId, action: "execute", decision: "approve" },
  });
  assert(approved.status === "dry_run" || approved.status === "executed", `tool call resolved as ${approved.status}`);

  // 6. Resume the workflow from its saved position -> completes remaining steps
  const resumed = await processWorkflowRun({
    organizationId: session.organizationId,
    userId: session.id,
    userEmail: session.email,
    runId: run.id,
  });
  assert(resumed.status === "completed", `run resumed and completed (${resumed.status})`);
  const finished = await getWorkflowRun(session.organizationId, run.id);
  assert(finished?.status === "completed", "persisted final status is completed");
  assert((finished?.events?.length ?? 0) >= 6, `run has ${finished?.events?.length} persisted events`);

  // 7. Governance surfaces populated
  const audit = await listAuditLogs(session.organizationId);
  assert(audit.some((entry) => entry.action === "workflow.started"), "audit log has workflow.started");
  assert(audit.some((entry) => entry.action === "tool.executed"), "audit log has tool.executed");
  const evals = await listEvaluations(session.organizationId);
  assert(evals.length > 0, `evaluations recorded (${evals.length})`);
  const calls = await listToolCalls(session.organizationId);
  assert(calls.length >= 2, `tool ledger has ${calls.length} entries`);

  // 8. Tenant isolation: a fabricated other-org id sees nothing
  const foreign = await listDocuments("00000000-0000-0000-0000-000000000000");
  assert(foreign.length === 0, "foreign org sees zero documents");
  const foreignAudit = await listAuditLogs("00000000-0000-0000-0000-000000000000");
  assert(foreignAudit.length === 0, "foreign org sees zero audit logs");

  console.log("\nALL SMOKE CHECKS PASSED — the Postgres path is real.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Smoke test crashed:", error);
  process.exit(1);
});
