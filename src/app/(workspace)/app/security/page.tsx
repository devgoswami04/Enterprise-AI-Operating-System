import { AlertTriangle, LockKeyhole, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/data/store";
import { hasRole } from "@/lib/security/rbac";

export default async function SecurityPage() {
  const session = await requireSession();
  const snapshot = getDashboardSnapshot(session.organizationId);
  const canAdmin = hasRole(session, "admin");
  const visibleSecurityEvents = canAdmin ? snapshot.securityEvents : [];
  const visibleToolCalls = canAdmin ? snapshot.toolCalls : [];

  return (
    <div className="grid gap-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-normal text-white">Security Center</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Monitor RBAC, prompt-injection findings, sensitive-data masking, approval gates, and external tool actions.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["RBAC", session.role, "current user authorization"],
          ["Security Events", visibleSecurityEvents.length, "prompt and data controls"],
          ["Tool Gates", visibleToolCalls.filter((call) => call.status === "pending_approval").length, "pending approvals"],
        ].map(([label, value, detail]) => (
          <Card key={label} className="border-white/10 bg-white/[0.03]">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm text-zinc-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                <p className="mt-1 text-xs text-zinc-500">{detail}</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-cyan-200" />
            </CardContent>
          </Card>
        ))}
      </section>

      {!canAdmin ? (
        <Card className="border-amber-300/20 bg-amber-300/[0.04]">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-amber-100">
            <LockKeyhole className="h-4 w-4" />
            Admin role required for full audit export. Current view is scoped to safe summaries.
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-200" />
              Security Events
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {visibleSecurityEvents.length ? (
              visibleSecurityEvents.map((event) => (
                <div key={event.id} className="rounded-md border border-white/10 bg-zinc-950/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{event.action}</p>
                    <Badge variant="outline" className="border-amber-300/30 text-amber-200">
                      {event.riskLevel}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">{event.findings.join(", ")}</p>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
                No risky prompts or sensitive-data findings recorded yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-base">Tool Execution Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead>Tool</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleToolCalls.map((call) => (
                  <TableRow key={call.id} className="border-white/10">
                    <TableCell className="font-medium text-zinc-100">{call.toolName}</TableCell>
                    <TableCell>{call.status}</TableCell>
                    <TableCell>{call.riskLevel}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
