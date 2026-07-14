import {
  appendWorkflowEvent,
  createToolCall,
  getWorkflowRun,
  getWorkflowTemplate,
  updateWorkflowRun,
} from "@/lib/data/store";
import type { SessionUser } from "@/lib/types";
import { logEvent } from "@/modules/shared/logger";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type WorkflowExecutor = {
  streamRun(session: SessionUser, runId: string): AsyncGenerator<Record<string, unknown>>;
};

export function getWorkflowExecutor(): WorkflowExecutor {
  return {
    async *streamRun(session: SessionUser, runId: string) {
      const run = getWorkflowRun(session.organizationId, runId);
      if (!run) {
        yield { type: "error", message: "Workflow run not found" };
        return;
      }

      const workflow = getWorkflowTemplate(session.organizationId, run.workflowId);
      if (!workflow) {
        yield { type: "error", message: "Workflow template not found" };
        return;
      }

      appendWorkflowEvent(session.organizationId, runId, {
        type: "queued",
        message: "Workflow worker accepted queued run.",
        metadata: { workflow: workflow.name },
      });
      yield {
        type: "run_started",
        runId,
        workflow: workflow.name,
        message: "Execution graph created.",
      };

      for (let index = 0; index < workflow.steps.length; index += 1) {
        const step = workflow.steps[index];
        const retry = step.retry ?? { attempts: 1, backoffMs: 0 };
        let attempt = 0;
        let completed = false;

        updateWorkflowRun(session.organizationId, runId, {
          status: "running",
          currentStep: index + 1,
          result: `${step.agent} is running: ${step.name}`,
        });
        while (!completed && attempt < retry.attempts) {
          attempt += 1;
          appendWorkflowEvent(session.organizationId, runId, {
            type: "step_started",
            message: `${step.agent} started ${step.name}.`,
            stepIndex: index,
            metadata: { attempt, dependencies: step.dependsOn ?? [] },
          });
          yield {
            type: "step",
            status: "running",
            index,
            name: step.name,
            agent: step.agent,
            attempt,
          };
          await sleep(260);

          try {
            appendWorkflowEvent(session.organizationId, runId, {
              type: "step_completed",
              message: `${step.agent} completed ${step.name}.`,
              stepIndex: index,
              metadata: { attempt },
            });
            yield {
              type: "step",
              status: "completed",
              index,
              name: step.name,
              agent: step.agent,
              attempt,
              summary: `${step.agent} completed ${step.name.toLowerCase()}.`,
            };
            completed = true;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Workflow step failed";
            appendWorkflowEvent(session.organizationId, runId, {
              type: attempt < retry.attempts ? "retry" : "failed",
              message,
              stepIndex: index,
              metadata: { attempt },
            });
            if (attempt >= retry.attempts) {
              updateWorkflowRun(session.organizationId, runId, {
                status: "failed",
                result: message,
              });
              yield { type: "error", message, index, name: step.name };
              return;
            }
            await sleep(retry.backoffMs);
          }
        }

        if (step.tool && step.approvalRequired) {
          const call = createToolCall({
            organizationId: session.organizationId,
            workflowRunId: runId,
            toolName: step.tool,
            input: {
              workflow: workflow.name,
              step: step.name,
              requestedBy: session.email,
            },
            riskLevel: step.tool === "github" || step.tool === "browser" ? "high" : "medium",
          });
          updateWorkflowRun(session.organizationId, runId, {
            status: "waiting_approval",
            result: `${step.tool} action is prepared and waiting for human approval.`,
          });
          appendWorkflowEvent(session.organizationId, runId, {
            type: "approval_required",
            message: `${step.tool} action requires approval before execution.`,
            stepIndex: index,
            metadata: { toolCallId: call.id, toolName: step.tool, riskLevel: call.riskLevel },
          });
          logEvent(
            "warn",
            {
              component: "workflows",
              action: "workflow.approval_required",
              organizationId: session.organizationId,
              userId: session.id,
            },
            "Workflow paused at approval gate",
            { workflowRunId: runId, toolCallId: call.id, toolName: step.tool },
          );
          yield {
            type: "approval_required",
            toolCall: call,
            message: `${step.tool} action requires approval before execution.`,
          };
          return;
        }
      }

      updateWorkflowRun(session.organizationId, runId, {
        status: "completed",
        result: "Workflow completed successfully in mock execution mode.",
      });
      appendWorkflowEvent(session.organizationId, runId, {
        type: "completed",
        message: "Workflow completed successfully.",
        metadata: { workflow: workflow.name },
      });
      yield {
        type: "run_completed",
        runId,
        message: "Workflow completed successfully in mock execution mode.",
      };
    },
  };
}
