import { describe, expect, it } from "vitest";
import { orchestrateChat } from "@/lib/ai/orchestrator";
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

describe("orchestrator", () => {
  it("generates cited answers and agent steps", async () => {
    const result = await orchestrateChat(session, "Summarize the security approval policy");

    expect(result.answer).toContain("grounded workspace answer");
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.steps.map((step) => step.agentName)).toContain("Security Agent");
    expect(result.generation.provider).toBe("mock");
  });
});
