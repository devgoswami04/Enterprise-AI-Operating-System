import { getAgentCatalog } from "@/lib/data/definitions";
import type { DashboardSnapshot } from "@/lib/types";
import { listAgentRuns, countAgentRuns } from "@/lib/db/repositories/agents";
import { listDocuments } from "@/lib/db/repositories/documents";
import {
  listAuditLogs,
  listEvaluations,
  listSecurityEvents,
  listUsageEvents,
} from "@/lib/db/repositories/governance";
import { listMemories } from "@/lib/db/repositories/memory";
import { listToolCalls } from "@/lib/db/repositories/tools";
import { listWorkflowRuns, listWorkflows } from "@/lib/db/repositories/workflows";

export async function getDashboardSnapshot(organizationId: string): Promise<DashboardSnapshot> {
  const [documents, agentRuns, agentStats, workflowRuns, toolCalls, memories, auditLogs, usageEvents, securityEvents, evaluations] =
    await Promise.all([
      listDocuments(organizationId),
      listAgentRuns(organizationId, 8),
      countAgentRuns(organizationId),
      listWorkflowRuns(organizationId, 8),
      listToolCalls(organizationId),
      listMemories(organizationId),
      listAuditLogs(organizationId),
      listUsageEvents(organizationId),
      listSecurityEvents(organizationId),
      listEvaluations(organizationId),
    ]);

  const chunkCount = documents.reduce((sum, doc) => sum + doc.chunkCount, 0);

  return {
    metrics: {
      documents: documents.length,
      chunks: chunkCount,
      workflowsCompleted: workflowRuns.filter((run) => run.status === "completed").length,
      openApprovals: toolCalls.filter((call) => call.status === "pending_approval").length,
      agentSuccessRate: agentStats.successRate,
      monthlyCostUsd: Number(usageEvents.reduce((sum, event) => sum + event.costUsd, 0).toFixed(2)),
    },
    documents,
    agents: getAgentCatalog(organizationId),
    agentRuns,
    workflows: listWorkflows(organizationId),
    workflowRuns,
    toolCalls: toolCalls.slice(0, 8),
    memories: memories.slice(0, 8),
    auditLogs,
    usageEvents,
    securityEvents,
    evaluations,
  };
}
