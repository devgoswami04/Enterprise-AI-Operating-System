import { afterEach, describe, expect, it, vi } from "vitest";
import { selectModelForTask } from "@/lib/ai/model-router";
import { getAIProvider } from "@/lib/ai/providers";
import { resetRuntimeConfigForTests } from "@/modules/shared/env";

afterEach(() => {
  vi.unstubAllEnvs();
  resetRuntimeConfigForTests();
});

describe("provider routing", () => {
  it("keeps mock mode explicit", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    resetRuntimeConfigForTests();

    const provider = getAIProvider();
    const completion = await provider.complete("Summarize the approval policy.");

    expect(provider.mode).toBe("mock");
    expect(completion.fallback).toBe(true);
    expect(completion.provider).toBe("mock");
  });

  it("does not silently treat missing OpenAI credentials as live", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    resetRuntimeConfigForTests();

    const provider = getAIProvider();

    expect(provider.mode).toBe("mock");
    expect(provider.model).toBe("mock-enterprise-orchestrator");
  });

  it("routes Ollama decisions to the configured local model", () => {
    vi.stubEnv("AI_PROVIDER", "ollama");
    vi.stubEnv("OLLAMA_MODEL", "llama3.2");

    const decision = selectModelForTask({
      objective: "Draft a routine release summary.",
    });

    expect(decision.provider).toBe("ollama");
    expect(decision.model).toBe("ollama/llama3.2");
  });

  it("keeps direct OpenAI routing on OpenAI model ids for guarded work", () => {
    vi.stubEnv("AI_PROVIDER", "openai");

    const decision = selectModelForTask({
      objective: "Review a high-risk policy exception.",
      riskLevel: "high",
    });

    expect(decision.provider).toBe("openai");
    expect(decision.model.startsWith("openai/")).toBe(true);
  });
});
