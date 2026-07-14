import { getDashboardSnapshot } from "@/lib/data/store";

function metric(name: string, value: number, labels: Record<string, string> = {}) {
  const labelText = Object.entries(labels)
    .map(([key, labelValue]) => `${key}="${labelValue.replaceAll('"', '\\"')}"`)
    .join(",");
  return `${name}${labelText ? `{${labelText}}` : ""} ${value}`;
}

export function getPrometheusMetrics(organizationId: string) {
  const snapshot = getDashboardSnapshot(organizationId);
  const avgRetrievalQuality = snapshot.evaluations.length
    ? snapshot.evaluations.reduce((sum, item) => sum + item.retrievalQuality, 0) / snapshot.evaluations.length
    : 0;
  const avgLatency = snapshot.usageEvents.length
    ? snapshot.usageEvents.reduce((sum, item) => sum + item.latencyMs, 0) / snapshot.usageEvents.length
    : 0;

  return [
    "# HELP enterprise_ai_os_documents Indexed documents.",
    "# TYPE enterprise_ai_os_documents gauge",
    metric("enterprise_ai_os_documents", snapshot.metrics.documents, { organizationId }),
    "# HELP enterprise_ai_os_open_approvals Pending approval gates.",
    "# TYPE enterprise_ai_os_open_approvals gauge",
    metric("enterprise_ai_os_open_approvals", snapshot.metrics.openApprovals, { organizationId }),
    "# HELP enterprise_ai_os_agent_success_rate Agent run success percentage.",
    "# TYPE enterprise_ai_os_agent_success_rate gauge",
    metric("enterprise_ai_os_agent_success_rate", snapshot.metrics.agentSuccessRate, { organizationId }),
    "# HELP enterprise_ai_os_retrieval_quality Average retrieval quality.",
    "# TYPE enterprise_ai_os_retrieval_quality gauge",
    metric("enterprise_ai_os_retrieval_quality", Number(avgRetrievalQuality.toFixed(2)), { organizationId }),
    "# HELP enterprise_ai_os_latency_ms Average recorded operation latency.",
    "# TYPE enterprise_ai_os_latency_ms gauge",
    metric("enterprise_ai_os_latency_ms", Number(avgLatency.toFixed(2)), { organizationId }),
    "# HELP enterprise_ai_os_security_events Security findings recorded.",
    "# TYPE enterprise_ai_os_security_events counter",
    metric("enterprise_ai_os_security_events", snapshot.securityEvents.length, { organizationId }),
  ].join("\n");
}
