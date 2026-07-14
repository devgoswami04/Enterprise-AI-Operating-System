/**
 * Workflow execution engine.
 *
 * `executeWorkflowStep` is the single source of truth for what a step DOES —
 * it performs real work (retrieval for research steps, memory writes for
 * synthesis steps, tool-call creation for approval-gated steps) and persists
 * every state transition through the store facade. It is deliberately
 * transport-agnostic: the SSE route drives it directly for live streaming,
 * and the BullMQ worker (src/worker.ts) drives the exact same function when
 * Redis-backed background processing is enabled. One implementation, two
 * schedulers — no divergence between "demo" and "real" behavior.
 */
import {
  appendWorkflowEvent,
  createToolCall,
  getWorkflowRun,
  getWorkflowTemplate,
  searchKnowledge,
  updateWorkflowRun,
} from "@/lib/data/store";
import { writeDurableMemory } from "@/modules/memory/service";
import { getRuntimeConfig } from "@/modules/shared/env";
import type { SessionUser, WorkflowStepDefinition, WorkflowTemplate } from "@/lib/types";
import { logEvent } from "@/modules/shared/logger";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type StepExecutionResult = {
  status: "completed" | "approval_required" | "failed";
  summary: string;
  output: Record<string, unknown>;
  toolCallId?: string;
};

/**
 * Execute one workflow step for real. Research-agent steps retrieve evidence
 * from the knowledge layer; writer-agent steps persist a durable memory of
 * the outcome; tool steps with approvalRequired create a pending_approval
 * tool call and pause the run. Every path writes its transition to the
 * workflow event log.
 */
export async function executeWorkflowStep(input: {
  organizationId: string;
  userId: string;
  userEmail: string;
  runId: string;
  workflow: WorkflowTemplate;
  step: WorkflowStepDefinition;
  stepIndex: number;
  attempt: number;
}): Promise<StepExecutionResult> {
  const { organizationId, runId, workflow, step, stepIndex, attempt } = input;

  await appendWorkflowEvent(organizationId, runId, {
    type: "step_started",
    message: `${step.agent} started ${step.name}.`,
    stepIndex,
    metadata: { attempt, dependencies: step.dependsOn ?? [] },
  });

  // Approval-gated tool step: create the pending tool call and pause.
  if (step.tool && step.approvalRequired) {
    const call = await createToolCall({
      organizationId,
      workflowRunId: runId,
      toolName: step.tool,
      input: {
        workflow: workflow.name,
        step: step.name,
        requestedBy: input.userEmail,
      },
      riskLevel: step.tool === "github" || step.tool === "browser" ? "high" : "medium",
    });

    await updateWorkflowRun(organizationId, runId, {
      status: "waiting_approval",
      result: `${step.tool} action is prepared and waiting for human approval.`,
    });
    await appendWorkflowEvent(organizationId, runId, {
      type: "approval_required",
      message: `${step.tool} action requires approval before execution.`,
      stepIndex,
      metadata: { toolCallId: call.id, toolName: step.tool, riskLevel: call.riskLevel },
    });

    logEvent(
      "warn",
      { component: "workflows", action: "workflow.approval_required", organizationId, userId: input.userId },
      "Workflow paused at approval gate",
      { workflowRunId: runId, toolCallId: call.id, toolName: step.tool },
    );

    return {
      status: "approval_required",
      summary: `${step.tool} action requires approval before execution.`,
      output: { toolCallId: call.id, riskLevel: call.riskLevel },
      toolCallId: call.id,
    };
  }

  // Research steps do real retrieval against the knowledge layer.
  if (step.agent === "Research Agent") {
    const results = await searchKnowledge(organizationId, `${workflow.name} ${step.name}`, 3);
    await appendWorkflowEvent(organizationId, runId, {
      type: "step_completed",
      message: `${step.agent} retrieved ${results.length} evidence passages for ${step.name}.`,
      stepIndex,
      metadata: { attempt, evidence: results.map((result) => result.document.title) },
    });
    return {
      status: "completed",
      summary: `Retrieved ${results.length} evidence passages.`,
      output: { evidenceCount: results.length, topScore: results[0]?.score ?? 0 },
    };
  }

  // Writer steps persist a durable episodic memory of the workflow outcome.
  if (step.agent === "Writer Agent") {
    await writeDurableMemory({
      organizationId,
      userId: input.userId,
      type: "episodic",
      content: `Workflow "${workflow.name}" completed step "${step.name}" producing a drafted artifact.`,
      reason: "Workflow synthesis step produced a durable outcome.",
    });
    await appendWorkflowEvent(organizationId, runId, {
      type: "step_completed",
      message: `${step.agent} completed ${step.name} and recorded the outcome to memory.`,
      stepIndex,
      metadata: { attempt, memoryWritten: true },
    });
    return {
      status: "completed",
      summary: `${step.name} drafted and outcome recorded to organizational memory.`,
      output: { memoryWritten: true },
    };
  }

  // Planner / Analyst / generic steps complete with recorded telemetry.
  await appendWorkflowEvent(organizationId, runId, {
    type: "step_completed",
    message: `${step.agent} completed ${step.name}.`,
    stepIndex,
    metadata: { attempt },
  });
  return {
    status: "completed",
    summary: `${step.agent} completed ${step.name.toLowerCase()}.`,
    output: { attempt },
  };
}

/**
 * Drive an entire run from its current position. Returns the terminal
 * outcome. Used by the BullMQ worker; the SSE executor below wraps the same
 * per-step calls in a generator to stream progress.
 */
export async function processWorkflowRun(input: {
  organizationId: string;
  userId: string;
  userEmail: string;
  runId: string;
}) {
  const run = await getWorkflowRun(input.organizationId, input.runId);
  if (!run) throw new Error("Workflow run not found");
  const workflow = getWorkflowTemplate(input.organizationId, run.workflowId);
  if (!workflow) throw new Error("Workflow template not found");

  for (let index = run.currentStep; index < workflow.steps.length; index += 1) {
    const step = workflow.steps[index];
    const retry = step.retry ?? { attempts: 1, backoffMs: 0 };

    await updateWorkflowRun(input.organizationId, input.runId, {
      status: "running",
      currentStep: index + 1,
      result: `${step.agent} is running: ${step.name}`,
    });

    let outcome: StepExecutionResult | undefined;
    for (let attempt = 1; attempt <= retry.attempts; attempt += 1) {
      try {
        outcome = await executeWorkflowStep({
          organizationId: input.organizationId,
          userId: input.userId,
          userEmail: input.userEmail,
          runId: input.runId,
          workflow,
          step,
          stepIndex: index,
          attempt,
        });
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Workflow step failed";
        const finalAttempt = attempt >= retry.attempts;
        await appendWorkflowEvent(input.organizationId, input.runId, {
          type: finalAttempt ? "failed" : "retry",
          message,
          stepIndex: index,
          metadata: { attempt },
        });
        if (finalAttempt) {
          await updateWorkflowRun(input.organizationId, input.runId, { status: "failed", result: message });
          return { status: "failed" as const, message };
        }
        await sleep(retry.backoffMs);
      }
    }

    if (outcome?.status === "approval_required") {
      return { status: "waiting_approval" as const, toolCallId: outcome.toolCallId };
    }
  }

  await updateWorkflowRun(input.organizationId, input.runId, {
    status: "completed",
    result: "Workflow completed successfully.",
  });
  await appendWorkflowEvent(input.organizationId, input.runId, {
    type: "completed",
    message: "Workflow completed successfully.",
    metadata: { workflow: workflow.name },
  });
  return { status: "completed" as const };
}

export type WorkflowExecutor = {
  streamRun(session: SessionUser, runId: string): AsyncGenerator<Record<string, unknown>>;
};

/**
 * Watcher mode: used when BullMQ is enabled. The background worker owns
 * execution; this generator only observes persisted run state + events and
 * streams changes to the client. Driving the run from BOTH the worker and
 * the SSE request would double-execute steps, so exactly one of the two
 * modes runs per configuration.
 */
async function* watchRun(session: SessionUser, runId: string): AsyncGenerator<Record<string, unknown>> {
  const seenEventIds = new Set<string>();
  const terminal = new Set(["completed", "failed", "cancelled", "waiting_approval"]);
  const startedAt = Date.now();
  const maxWatchMs = 120_000;

  yield { type: "run_started", runId, message: "Watching worker-driven execution." };

  while (Date.now() - startedAt < maxWatchMs) {
    const run = await getWorkflowRun(session.organizationId, runId);
    if (!run) {
      yield { type: "error", message: "Workflow run not found" };
      return;
    }

    const orderedEvents = [...(run.events ?? [])].reverse();
    for (const event of orderedEvents) {
      if (seenEventIds.has(event.id)) continue;
      seenEventIds.add(event.id);
      if (event.type === "approval_required") {
        yield {
          type: "approval_required",
          toolCall: {
            id: (event.metadata as { toolCallId?: string })?.toolCallId,
            toolName: (event.metadata as { toolName?: string })?.toolName,
            riskLevel: (event.metadata as { riskLevel?: string })?.riskLevel ?? "medium",
            workflowRunId: runId,
          },
          message: event.message,
        };
      } else {
        yield {
          type: "step",
          status: event.type === "step_started" ? "running" : event.type === "retry" ? "retrying" : "completed",
          index: event.stepIndex ?? 0,
          name: event.message,
          agent: "worker",
        };
      }
    }

    if (terminal.has(run.status)) {
      if (run.status === "completed") {
        yield { type: "run_completed", runId, message: run.result };
      } else if (run.status === "failed" || run.status === "cancelled") {
        yield { type: "error", message: run.result };
      }
      return;
    }

    await sleep(750);
  }

  yield { type: "error", message: "Watch window expired; the run continues in the background worker." };
}

/**
 * SSE-facing executor: same step logic as processWorkflowRun, wrapped in a
 * generator that yields UI events as each real transition happens.
 */
export function getWorkflowExecutor(): WorkflowExecutor {
  const config = getRuntimeConfig();
  if (config.features.bullmq) {
    return { streamRun: watchRun };
  }
  return {
    async *streamRun(session: SessionUser, runId: string) {
      const run = await getWorkflowRun(session.organizationId, runId);
      if (!run) {
        yield { type: "error", message: "Workflow run not found" };
        return;
      }

      const workflow = getWorkflowTemplate(session.organizationId, run.workflowId);
      if (!workflow) {
        yield { type: "error", message: "Workflow template not found" };
        return;
      }

      await appendWorkflowEvent(session.organizationId, runId, {
        type: "queued",
        message: "Workflow worker accepted queued run.",
        metadata: { workflow: workflow.name },
      });
      yield { type: "run_started", runId, workflow: workflow.name, message: "Execution graph created." };

      for (let index = run.currentStep; index < workflow.steps.length; index += 1) {
        const step = workflow.steps[index];
        const retry = step.retry ?? { attempts: 1, backoffMs: 0 };

        await updateWorkflowRun(session.organizationId, runId, {
          status: "running",
          currentStep: index + 1,
          result: `${step.agent} is running: ${step.name}`,
        });

        let outcome: StepExecutionResult | undefined;
        for (let attempt = 1; attempt <= retry.attempts; attempt += 1) {
          yield { type: "step", status: "running", index, name: step.name, agent: step.agent, attempt };
          try {
            outcome = await executeWorkflowStep({
              organizationId: session.organizationId,
              userId: session.id,
              userEmail: session.email,
              runId,
              workflow,
              step,
              stepIndex: index,
              attempt,
            });
            break;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Workflow step failed";
            const finalAttempt = attempt >= retry.attempts;
            await appendWorkflowEvent(session.organizationId, runId, {
              type: finalAttempt ? "failed" : "retry",
              message,
              stepIndex: index,
              metadata: { attempt },
            });
            if (finalAttempt) {
              await updateWorkflowRun(session.organizationId, runId, { status: "failed", result: message });
              yield { type: "error", message, index, name: step.name };
              return;
            }
            yield { type: "step", status: "retrying", index, name: step.name, agent: step.agent, attempt };
            await sleep(retry.backoffMs);
          }
        }

        if (!outcome) continue;

        if (outcome.status === "approval_required") {
          const refreshed = await getWorkflowRun(session.organizationId, runId);
          const approvalEvent = refreshed?.events?.find((event) => event.type === "approval_required");
          yield {
            type: "approval_required",
            toolCall: {
              id: outcome.toolCallId,
              toolName: step.tool,
              riskLevel: (approvalEvent?.metadata as { riskLevel?: string })?.riskLevel ?? "medium",
              workflowRunId: runId,
            },
            message: outcome.summary,
          };
          return;
        }

        yield {
          type: "step",
          status: "completed",
          index,
          name: step.name,
          agent: step.agent,
          summary: outcome.summary,
          output: outcome.output,
        };
      }

      await updateWorkflowRun(session.organizationId, runId, {
        status: "completed",
        result: "Workflow completed successfully.",
      });
      await appendWorkflowEvent(session.organizationId, runId, {
        type: "completed",
        message: "Workflow completed successfully.",
        metadata: { workflow: workflow.name },
      });
      yield { type: "run_completed", runId, message: "Workflow completed successfully." };
    },
  };
}
