"use client";

import { useState } from "react";
import { Check, Play, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ToolCall, WorkflowRun, WorkflowTemplate } from "@/lib/types";

type EventLog = {
  type: string;
  message?: string;
  name?: string;
  agent?: string;
  status?: string;
  toolCall?: ToolCall;
};

export function WorkflowLauncher({
  workflows,
  initialRuns,
  initialToolCalls,
}: {
  workflows: WorkflowTemplate[];
  initialRuns: WorkflowRun[];
  initialToolCalls: ToolCall[];
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [toolCalls, setToolCalls] = useState(initialToolCalls);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  async function launch(workflowId: string) {
    setEvents([]);
    const response = await fetch(`/api/workflows/${workflowId}/runs`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setEvents([{ type: "error", message: data.error ?? "Could not start workflow" }]);
      return;
    }

    setRuns((current) => [data.run, ...current]);
    setActiveRunId(data.run.id);
    const source = new EventSource(`/api/runs/${data.run.id}/events`);
    const eventNames = ["run_started", "step", "approval_required", "run_completed", "error"];

    eventNames.forEach((eventName) => {
      source.addEventListener(eventName, (event) => {
        const parsed = JSON.parse(event.data) as EventLog;
        setEvents((current) => [...current, parsed]);
        if (parsed.toolCall) {
          setToolCalls((current) => [parsed.toolCall as ToolCall, ...current]);
        }
        if (eventName === "approval_required" || eventName === "run_completed" || eventName === "error") {
          source.close();
        }
      });
    });
  }

  async function approve(call: ToolCall) {
    const response = await fetch(`/api/tools/${call.toolName}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolCallId: call.id, workflowRunId: call.workflowRunId }),
    });
    const data = await response.json();
    if (response.ok) {
      setToolCalls((current) =>
        current.map((item) => (item.id === call.id ? data.toolCall : item)),
      );
      setEvents((current) => [
        ...current,
        {
          type: "tool_executed",
          message: `${call.toolName} approved and executed in mock provider mode.`,
        },
      ]);
    }
  }

  const pendingApprovals = toolCalls.filter((call) => call.status === "pending_approval");

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="grid gap-4 md:grid-cols-2">
        {workflows.map((workflow) => (
          <Card key={workflow.id} className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{workflow.name}</CardTitle>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{workflow.description}</p>
                </div>
                <Badge variant="outline" className="border-cyan-300/30 text-cyan-100">
                  {workflow.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                {workflow.steps.map((step, index) => (
                  <div key={`${workflow.id}-${step.name}`} className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-white/[0.04] text-zinc-300">
                      {index + 1}
                    </span>
                    <span className="truncate">{step.name}</span>
                    {step.approvalRequired ? <ShieldAlert className="h-3.5 w-3.5 text-amber-300" /> : null}
                  </div>
                ))}
              </div>
              <Button onClick={() => launch(workflow.id)} className="justify-self-start gap-2">
                <Play className="h-4 w-4" />
                Launch
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6">
        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-base">Live Execution</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="grid gap-3 pr-4">
                {events.length ? (
                  events.map((event, index) => (
                    <div key={`${event.type}-${index}`} className="rounded-md border border-white/10 bg-zinc-950/60 p-3 text-sm text-zinc-400">
                      <p className="text-xs uppercase tracking-wide text-cyan-100">{event.type}</p>
                      <p className="mt-1">
                        {event.message ?? `${event.agent ?? "Agent"} ${event.status ?? "updated"} ${event.name ?? ""}`}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
                    Launch a workflow to watch agent progress and approval gates.
                  </div>
                )}
              </div>
            </ScrollArea>
            {activeRunId ? <p className="mt-3 text-xs text-zinc-500">Active run: {activeRunId}</p> : null}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-base">Tool Approvals</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {pendingApprovals.length ? (
              pendingApprovals.map((call) => (
                <div key={call.id} className="rounded-md border border-amber-300/20 bg-amber-300/[0.04] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-amber-100">{call.toolName}</p>
                      <p className="mt-1 text-sm text-zinc-400">{String(call.output.message)}</p>
                    </div>
                    <Button size="sm" onClick={() => approve(call)} className="gap-2">
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
                No pending tool approvals.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-base">Recent Runs</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {runs.slice(0, 4).map((run) => (
              <div key={run.id} className="rounded-md border border-white/10 bg-zinc-950/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-white">{run.workflowName}</p>
                  <Badge variant="outline" className="border-white/10 text-zinc-400">
                    {run.status}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-zinc-500">{run.result}</p>
              </div>
            ))}
            {!runs.length ? (
              <div className="rounded-md border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
                Workflow run history appears here.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
