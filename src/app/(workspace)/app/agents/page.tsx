import { Bot, CheckCircle2, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireSession } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/data/store";

export default async function AgentsPage() {
  const session = await requireSession();
  const snapshot = getDashboardSnapshot(session.organizationId);

  return (
    <div className="grid gap-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-normal text-white">Agent Orchestration</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Specialized agents plan, retrieve, analyze, write, guard, and execute work with traceable steps.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {snapshot.agents.map((agent) => (
          <Card key={agent.id} className="border-white/10 bg-white/[0.03]">
            <CardContent className="p-4">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-cyan-300/10 text-cyan-100">
                <Bot className="h-5 w-5" />
              </div>
              <p className="font-medium text-white">{agent.name}</p>
              <p className="mt-2 min-h-20 text-sm leading-6 text-zinc-400">{agent.description}</p>
              <Badge variant="outline" className="mt-4 border-white/10 text-zinc-300">
                {agent.modelPolicy}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Recent Agent Runs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          {snapshot.agentRuns.length ? (
            snapshot.agentRuns.map((run) => (
              <div key={run.id} className="rounded-md border border-white/10 bg-zinc-950/60 p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <p className="font-medium text-white">{run.objective}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {run.modelUsed} - {run.latencyMs}ms - ${run.costUsd}
                    </p>
                  </div>
                  <Badge className="bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/15">
                    {run.status}
                  </Badge>
                </div>
                <Separator className="my-4 bg-white/10" />
                <div className="grid gap-3">
                  {run.steps.map((step) => (
                    <div key={step.id} className="flex items-start gap-3 text-sm text-zinc-400">
                      {step.status === "completed" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                      ) : (
                        <Clock3 className="mt-0.5 h-4 w-4 text-amber-300" />
                      )}
                      <span>
                        <span className="text-zinc-100">{step.agentName}</span> - {step.summary}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
              Ask the workspace chat a question to generate the first multi-agent trace.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
