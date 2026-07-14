import type { AgentStep, RunStatus } from "@/lib/types";
import { logEvent } from "@/modules/shared/logger";

export type AgentGraphContext = {
  organizationId: string;
  userId: string;
  requestId: string;
};

export type AgentNodeResult<TState> = {
  state: TState;
  summary: string;
  status?: RunStatus;
  output?: Record<string, unknown>;
};

export type AgentNode<TState> = {
  name: string;
  retry?: {
    attempts: number;
    backoffMs: number;
  };
  timeoutMs?: number;
  run: (state: TState, context: AgentGraphContext) => Promise<AgentNodeResult<TState>> | AgentNodeResult<TState>;
};

export type AgentGraphResult<TState> = {
  state: TState;
  steps: Omit<AgentStep, "id" | "organizationId" | "agentRunId" | "createdAt">[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, nodeName: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${nodeName} timed out`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function runAgentGraph<TState>(
  initialState: TState,
  nodes: AgentNode<TState>[],
  context: AgentGraphContext,
): Promise<AgentGraphResult<TState>> {
  let state = initialState;
  const steps: AgentGraphResult<TState>["steps"] = [];

  for (const node of nodes) {
    const retry = node.retry ?? { attempts: 1, backoffMs: 0 };
    let attempt = 0;
    let completed = false;

    while (!completed && attempt < retry.attempts) {
      attempt += 1;
      const startedAt = new Date().toISOString();
      const started = Date.now();

      logEvent(
        "info",
        {
          component: "agents",
          action: "agent.step.started",
          organizationId: context.organizationId,
          userId: context.userId,
          requestId: context.requestId,
        },
        `${node.name} started`,
        { attempt },
      );

      try {
        const result = await withTimeout(
          Promise.resolve(node.run(state, context)),
          node.timeoutMs ?? 8000,
          node.name,
        );
        state = result.state;
        steps.push({
          agentName: node.name,
          status: result.status ?? "completed",
          summary: result.summary,
          latencyMs: Date.now() - started,
          attempt,
          startedAt,
          completedAt: new Date().toISOString(),
          output: result.output,
        });
        completed = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown agent failure";
        const finalAttempt = attempt >= retry.attempts;
        steps.push({
          agentName: node.name,
          status: finalAttempt ? "failed" : "retried",
          summary: finalAttempt ? `${node.name} failed: ${message}` : `${node.name} retrying after failure: ${message}`,
          latencyMs: Date.now() - started,
          attempt,
          startedAt,
          completedAt: new Date().toISOString(),
          error: message,
        });

        logEvent(
          finalAttempt ? "error" : "warn",
          {
            component: "agents",
            action: finalAttempt ? "agent.step.failed" : "agent.step.retry",
            organizationId: context.organizationId,
            userId: context.userId,
            requestId: context.requestId,
          },
          `${node.name} ${finalAttempt ? "failed" : "will retry"}`,
          { attempt, error: message },
        );

        if (finalAttempt) {
          return { state, steps };
        }
        await sleep(retry.backoffMs);
      }
    }
  }

  return { state, steps };
}
