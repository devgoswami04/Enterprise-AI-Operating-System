import { describe, expect, it } from "vitest";
import { runAgentGraph, type AgentNode } from "@/modules/agents/state-machine";

type State = { value: number };
const context = { organizationId: "org-test", userId: "u1", requestId: "r1" };

describe("agent state machine", () => {
  it("threads state through nodes in order and records completed steps", async () => {
    const nodes: AgentNode<State>[] = [
      { name: "A", run: (state) => ({ state: { value: state.value + 1 }, summary: "plus one" }) },
      { name: "B", run: (state) => ({ state: { value: state.value * 10 }, summary: "times ten" }) },
    ];
    const result = await runAgentGraph({ value: 1 }, nodes, context);
    expect(result.state.value).toBe(20);
    expect(result.steps.map((step) => step.status)).toEqual(["completed", "completed"]);
    expect(result.steps.every((step) => typeof step.latencyMs === "number")).toBe(true);
  });

  it("retries a flaky node and records the retried attempt", async () => {
    let calls = 0;
    const nodes: AgentNode<State>[] = [
      {
        name: "Flaky",
        retry: { attempts: 2, backoffMs: 1 },
        run: (state) => {
          calls += 1;
          if (calls === 1) throw new Error("transient");
          return { state, summary: "second try worked" };
        },
      },
    ];
    const result = await runAgentGraph({ value: 0 }, nodes, context);
    expect(calls).toBe(2);
    expect(result.steps.map((step) => step.status)).toEqual(["retried", "completed"]);
    expect(result.steps[1].attempt).toBe(2);
  });

  it("stops the graph and records failure after exhausting retries", async () => {
    const nodes: AgentNode<State>[] = [
      {
        name: "Doomed",
        retry: { attempts: 2, backoffMs: 1 },
        run: () => {
          throw new Error("permanent failure");
        },
      },
      { name: "Never", run: (state) => ({ state, summary: "should not run" }) },
    ];
    const result = await runAgentGraph({ value: 0 }, nodes, context);
    const statuses = result.steps.map((step) => step.status);
    expect(statuses).toContain("failed");
    expect(result.steps.some((step) => step.agentName === "Never")).toBe(false);
    expect(result.steps.at(-1)?.error).toContain("permanent failure");
  });

  it("supports async nodes", async () => {
    const nodes: AgentNode<State>[] = [
      {
        name: "Async",
        run: async (state) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return { state: { value: state.value + 41 }, summary: "async done" };
        },
      },
    ];
    const result = await runAgentGraph({ value: 1 }, nodes, context);
    expect(result.state.value).toBe(42);
  });
});
