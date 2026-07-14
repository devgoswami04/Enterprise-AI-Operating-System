import { Activity, Brain, Coins, FileText, ShieldCheck, Workflow } from "lucide-react";
import { ChatPanel } from "@/components/app/chat-panel";
import { MetricCard } from "@/components/app/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { requireSession } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/data/store";

export default async function AppDashboardPage() {
  const session = await requireSession();
  const snapshot = await getDashboardSnapshot(session.organizationId);

  return (
    <div className="grid gap-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Badge className="mb-3 bg-cyan-300/15 text-cyan-100 hover:bg-cyan-300/15">
            {session.organizationName}
          </Badge>
          <h1 className="text-3xl font-semibold tracking-normal text-white">Command Center</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Search knowledge, coordinate agents, execute workflows, and inspect every AI action from one secure operating surface.
          </p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
          Signed in as <span className="text-zinc-100">{session.name}</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="Documents" value={snapshot.metrics.documents} icon={FileText} detail={`${snapshot.metrics.chunks} indexed chunks`} />
        <MetricCard label="Approvals" value={snapshot.metrics.openApprovals} icon={ShieldCheck} detail="human-gated actions" />
        <MetricCard label="Success Rate" value={`${snapshot.metrics.agentSuccessRate}%`} icon={Activity} detail="agent run reliability" />
        <MetricCard label="Workflows" value={snapshot.metrics.workflowsCompleted} icon={Workflow} detail="completed this session" />
        <MetricCard label="Memory" value={snapshot.memories.length} icon={Brain} detail="active memory records" />
        <MetricCard label="Cost" value={`$${snapshot.metrics.monthlyCostUsd}`} icon={Coins} detail="mock monthly usage" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <ChatPanel />
        <div className="grid gap-6">
          <Card className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-base">Agent Fabric</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {snapshot.agents.slice(0, 5).map((agent) => (
                <div key={agent.id} className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{agent.name}</p>
                      <p className="text-xs text-zinc-500">{agent.type}</p>
                    </div>
                    <Badge variant="outline" className="border-emerald-300/30 text-emerald-200">
                      active
                    </Badge>
                  </div>
                  <Progress value={agent.enabled ? 92 : 0} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-base">Recent Memory</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {snapshot.memories.map((memory) => (
                <div key={memory.id} className="text-sm leading-6 text-zinc-400">
                  <span className="text-cyan-100">{memory.type}</span> - {memory.content}
                  <Separator className="mt-3 bg-white/10" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
