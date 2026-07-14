import { describe, expect, it } from "vitest";
import { DEMO_ORG_ID, getWorkflowRun, resolveToolCall, startWorkflowRun } from "@/lib/data/memory-store";
import { processWorkflowRun } from "@/lib/workflows/engine";

const runInput = (runId: string) => ({
  organizationId: DEMO_ORG_ID,
  userId: "user-admin",
  userEmail: "admin@novaworks.ai",
  runId,
});

describe("workflow engine (in-memory mode)", () => {
  it("executes to the approval gate, pauses, then resumes to completion after approval", async () => {
    const { run } = await Promise.resolve(
      startWorkflowRun({ organizationId: DEMO_ORG_ID, workflowId: "workflow-eng-triage", requestedBy: "user-admin" }),
    );

    // Drive until the jira approval gate (step index 2)
    const first = await processWorkflowRun(runInput(run.id));
    expect(first.status).toBe("waiting_approval");
    expect(first.toolCallId).toBeTruthy();

    const paused = await Promise.resolve(getWorkflowRun(DEMO_ORG_ID, run.id));
    expect(paused?.status).toBe("waiting_approval");
    expect(paused?.currentStep).toBe(3); // resumes AFTER the gated step

    // Approve the pending tool call
    resolveToolCall({
      organizationId: DEMO_ORG_ID,
      actorUserId: "user-admin",
      toolName: "jira",
      toolCallId: first.toolCallId,
      status: "executed",
      output: { provider: "mock", message: "approved in test" },
    });

    // Resume: remaining steps complete
    const second = await processWorkflowRun(runInput(run.id));
    expect(second.status).toBe("completed");

    const finished = await Promise.resolve(getWorkflowRun(DEMO_ORG_ID, run.id));
    expect(finished?.status).toBe("completed");
    const eventTypes = (finished?.events ?? []).map((event) => event.type);
    expect(eventTypes).toContain("approval_required");
    expect(eventTypes).toContain("completed");
  });

  it("records step_started and step_completed events with step indices", async () => {
    const { run } = await Promise.resolve(
      startWorkflowRun({ organizationId: DEMO_ORG_ID, workflowId: "workflow-hr-resume", requestedBy: "user-admin" }),
    );
    await processWorkflowRun(runInput(run.id));
    const state = await Promise.resolve(getWorkflowRun(DEMO_ORG_ID, run.id));
    const started = (state?.events ?? []).filter((event) => event.type === "step_started");
    expect(started.length).toBeGreaterThanOrEqual(3);
    expect(started.every((event) => typeof event.stepIndex === "number")).toBe(true);
  });

  it("rejects starting a workflow that does not exist", async () => {
    await expect(
      Promise.resolve().then(() =>
        startWorkflowRun({ organizationId: DEMO_ORG_ID, workflowId: "workflow-nope", requestedBy: "user-admin" }),
      ),
    ).rejects.toThrow(/not found/i);
  });

  it("does not expose runs across tenant boundaries", async () => {
    const { run } = await Promise.resolve(
      startWorkflowRun({ organizationId: DEMO_ORG_ID, workflowId: "workflow-ops-weekly", requestedBy: "user-admin" }),
    );
    const foreign = await Promise.resolve(getWorkflowRun("org-other", run.id));
    expect(foreign).toBeUndefined();
  });
});
