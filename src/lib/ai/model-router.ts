import { estimateTokens } from "@/lib/ai/chunking";

export type ModelDecision = {
  provider: string;
  model: string;
  reason: string;
  estimatedInputTokens: number;
};

function modelForProvider(
  provider: string,
  tier: "guarded" | "synthesis" | "routine",
) {
  if (provider === "anthropic") {
    return "anthropic/claude-sonnet-4.6";
  }

  if (provider === "ollama") {
    return `ollama/${process.env.OLLAMA_MODEL ?? "llama3.1"}`;
  }

  if (provider === "gateway" && tier === "guarded") {
    return "anthropic/claude-sonnet-4.6";
  }

  if (tier === "routine") {
    return "openai/gpt-5.4-mini";
  }

  return tier === "guarded" ? "openai/gpt-5.4" : "openai/gpt-5.4";
}

export function selectModelForTask(input: {
  objective: string;
  riskLevel?: "low" | "medium" | "high";
  requiresSynthesis?: boolean;
}): ModelDecision {
  const estimatedInputTokens = estimateTokens(input.objective);
  const provider = process.env.AI_PROVIDER ?? "mock";

  if (provider === "mock") {
    return {
      provider: "mock",
      model: "mock-enterprise-orchestrator",
      reason: "Safe deterministic model selected because AI_PROVIDER=mock.",
      estimatedInputTokens,
    };
  }

  if (input.riskLevel === "high") {
    return {
      provider,
      model: modelForProvider(provider, "guarded"),
      reason: "Guarded policy selected for high-risk work.",
      estimatedInputTokens,
    };
  }

  if (input.requiresSynthesis || estimatedInputTokens > 1200) {
    return {
      provider,
      model: modelForProvider(provider, "synthesis"),
      reason: "Synthesis policy selected for larger knowledge-grounded work.",
      estimatedInputTokens,
    };
  }

  return {
    provider,
    model: modelForProvider(provider, "routine"),
    reason: "Cost-optimized policy selected for routine workspace work.",
    estimatedInputTokens,
  };
}
