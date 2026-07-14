import { Activity, AlertTriangle, Gauge, ReceiptText } from "lucide-react";
import { MetricCard } from "@/components/app/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/data/store";
import { getSystemHealth } from "@/lib/system/health";
import { listStructuredLogs } from "@/modules/shared/logger";

export default async function ObservabilityPage() {
  const session = await requireSession();
  const snapshot = getDashboardSnapshot(session.organizationId);
  const health = getSystemHealth();
  const structuredLogs = listStructuredLogs(session.organizationId).slice(0, 8);
  const avgLatency = snapshot.usageEvents.length
    ? Math.round(snapshot.usageEvents.reduce((sum, event) => sum + event.latencyMs, 0) / snapshot.usageEvents.length)
    : 0;
  const totalTokens = snapshot.usageEvents.reduce(
    (sum, event) => sum + event.tokensIn + event.tokensOut,
    0,
  );

  return (
    <div className="grid gap-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-normal text-white">Observability</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Inspect traces, token cost, retrieval quality, tool safety, and audit evidence for AI operations.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Latency" value={`${avgLatency}ms`} icon={Gauge} detail="average event latency" />
        <MetricCard label="Tokens" value={totalTokens} icon={ReceiptText} detail="tracked mock usage" />
        <MetricCard label="Risk Events" value={snapshot.toolCalls.length} icon={AlertTriangle} detail="tool actions recorded" />
        <MetricCard label="Traces" value={snapshot.agentRuns.length} icon={Activity} detail="agent runs captured" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-base">Usage Events</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead>Event</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.usageEvents.map((event) => (
                  <TableRow key={event.id} className="border-white/10">
                    <TableCell className="font-medium text-zinc-100">{event.eventType}</TableCell>
                    <TableCell>{event.tokensIn + event.tokensOut}</TableCell>
                    <TableCell>{event.latencyMs}ms</TableCell>
                    <TableCell>${event.costUsd}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-base">Audit Trail</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {snapshot.auditLogs.map((entry) => (
              <div key={entry.id} className="rounded-md border border-white/10 bg-zinc-950/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-zinc-100">{entry.action}</p>
                  <Badge variant="outline" className="border-white/10 text-zinc-400">
                    {entry.targetType}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-zinc-500">{entry.createdAt}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">AI Evaluation Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead>Target</TableHead>
                <TableHead>Grounded</TableHead>
                <TableHead>Citations</TableHead>
                <TableHead>Retrieval</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.evaluations.map((evaluation) => (
                <TableRow key={evaluation.id} className="border-white/10">
                  <TableCell className="font-medium text-zinc-100">{evaluation.targetType}</TableCell>
                  <TableCell>{evaluation.groundedness}/100</TableCell>
                  <TableCell>{evaluation.citationCoverage}/100</TableCell>
                  <TableCell>{evaluation.retrievalQuality}/100</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-white/10 text-zinc-400">
                      {evaluation.hallucinationRisk}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!snapshot.evaluations.length ? (
            <p className="mt-4 text-sm text-zinc-500">
              Ask a workspace question to generate groundedness, citation coverage, and retrieval quality metrics.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Structured Logs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {structuredLogs.length ? (
            structuredLogs.map((entry) => (
              <div key={`${entry.timestamp}-${entry.component}-${entry.message}`} className="rounded-md border border-white/10 bg-zinc-950/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-zinc-100">{entry.component} - {entry.message}</p>
                  <Badge variant="outline" className="border-white/10 text-zinc-400">
                    {entry.severity}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-zinc-500">{entry.timestamp}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500">
              Logs appear here after chat, retrieval, workflow, memory, and tool operations run in this process.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Runtime Readiness</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {health.checks.slice(0, 8).map((check) => (
            <div key={check.name} className="rounded-md border border-white/10 bg-zinc-950/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{check.name}</p>
                <Badge variant="outline" className="border-white/10 text-zinc-400">
                  {check.status}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">{check.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
