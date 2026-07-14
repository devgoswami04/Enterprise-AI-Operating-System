import { describe, expect, it } from "vitest";
import { startWorkflowRun } from "@/lib/data/store";
import { getWorkflowExecutor } from "@/lib/workflows/engine";
import type { SessionUser } from "@/lib/types";

const session: SessionUser = {
  id: "user-test",
  organizationId: "org-nova",
  organizationName: "NovaWorks Enterprise",
  email: "test@novaworks.ai",
  name: "Test User",
  role: "admin",
  avatar: "TU",
};

describe("workflow executor", () => {
  it("streams steps and stops at approval gates", async () => {
    const { run } = startWorkflowRun({
      organizationId: session.organizationId,
      workflowId: "workflow-finance-invoice",
      requestedBy: session.id,
    });
    const events: Record<string, unknown>[] = [];

    for await (const event of getWorkflowExecutor().streamRun(session, run.id)) {
      events.push(event);
    }

    expect(events.some((event) => event.type === "step")).toBe(true);
    expect(events.at(-1)?.type).toBe("approval_required");
  });
});
