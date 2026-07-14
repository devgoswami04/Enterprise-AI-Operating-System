import { estimateTokens } from "@/lib/ai/chunking";
import { getRuntimeConfig } from "@/modules/shared/env";
import { RetryableError } from "@/modules/shared/errors";

export type AICompletionOptions = {
  system?: string;
  model?: string;
  maxOutputTokens?: number;
  organizationId?: string;
  requestId?: string;
  userId?: string;
};

export type AICompletion = {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  finishReason?: string;
  fallback?: boolean;
  error?: string;
};

export type AIProvider = {
  name: string;
  model: string;
  mode: "mock" | "live";
  complete(prompt: string, options?: AICompletionOptions): Promise<AICompletion>;
};

export type StorageProvider = {
  name: string;
  put(key: string, value: Blob | string): Promise<{ uri: string }>;
};

export type ToolProvider = {
  name: string;
  execute(toolName: string, input: Record<string, unknown>): Promise<Record<string, unknown>>;
};

function elapsed(started: number) {
  return Date.now() - started;
}

function completionFromText(input: {
  text: string;
  provider: string;
  model: string;
  started: number;
  prompt: string;
  fallback?: boolean;
  error?: string;
  finishReason?: string;
}): AICompletion {
  return {
    text: input.text.trim(),
    provider: input.provider,
    model: input.model,
    latencyMs: elapsed(input.started),
    tokensIn: estimateTokens(input.prompt),
    tokensOut: estimateTokens(input.text),
    fallback: input.fallback,
    error: input.error,
    finishReason: input.finishReason,
  };
}

function getMockAIProvider(reason = "Safe deterministic model selected because AI_PROVIDER=mock."): AIProvider {
  return {
    name: "mock",
    model: "mock-enterprise-orchestrator",
    mode: "mock",
    async complete(prompt: string) {
      const started = Date.now();
      return completionFromText({
        text: `Mock provider response for: ${prompt.slice(0, 160)}\n\n${reason}`,
        provider: "mock",
        model: "mock-enterprise-orchestrator",
        started,
        prompt,
        fallback: true,
        finishReason: "mock",
      });
    },
  };
}

function normalizeGatewayModel(model = "openai/gpt-5.4") {
  return model.includes("/") ? model : `openai/${model}`;
}

function normalizeDirectModel(model = "gpt-5.4", provider: "openai" | "anthropic" | "ollama") {
  return model.replace(`${provider}/`, "");
}

async function completeWithGateway(prompt: string, options: AICompletionOptions = {}) {
  const started = Date.now();
  const { generateText } = await import("ai");
  const model = normalizeGatewayModel(options.model);
  const result = await generateText({
    model,
    system: options.system,
    prompt,
    maxOutputTokens: options.maxOutputTokens ?? 900,
  });

  return completionFromText({
    text: result.text,
    provider: "gateway",
    model,
    started,
    prompt,
    finishReason: result.finishReason,
  });
}

async function completeWithOpenAI(prompt: string, options: AICompletionOptions = {}) {
  const started = Date.now();
  const { generateText } = await import("ai");
  const { openai } = await import("@ai-sdk/openai");
  const model = normalizeDirectModel(options.model, "openai");
  const result = await generateText({
    model: openai(model),
    system: options.system,
    prompt,
    maxOutputTokens: options.maxOutputTokens ?? 900,
  });

  return completionFromText({
    text: result.text,
    provider: "openai",
    model: `openai/${model}`,
    started,
    prompt,
    finishReason: result.finishReason,
  });
}

async function completeWithAnthropic(prompt: string, options: AICompletionOptions = {}) {
  const config = getRuntimeConfig();
  const started = Date.now();
  const model = normalizeDirectModel(options.model ?? "anthropic/claude-sonnet-4.6", "anthropic");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxOutputTokens ?? 900,
      system: options.system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new RetryableError("Anthropic provider request failed", { status: response.status });
  }

  const json = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = json.content
    ?.filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new RetryableError("Anthropic provider returned no text");
  }

  return {
    ...completionFromText({
      text,
      provider: "anthropic",
      model: `anthropic/${model}`,
      started,
      prompt,
      finishReason: json.stop_reason,
    }),
    tokensIn: json.usage?.input_tokens ?? estimateTokens(prompt),
    tokensOut: json.usage?.output_tokens ?? estimateTokens(text),
  };
}

async function completeWithOllama(prompt: string, options: AICompletionOptions = {}) {
  const config = getRuntimeConfig();
  const started = Date.now();
  const model = normalizeDirectModel(options.model ?? config.OLLAMA_MODEL, "ollama");
  const response = await fetch(`${config.OLLAMA_BASE_URL.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: [options.system, prompt].filter(Boolean).join("\n\n"),
      stream: false,
      options: {
        num_predict: options.maxOutputTokens ?? 900,
      },
    }),
  });

  if (!response.ok) {
    throw new RetryableError("Ollama provider request failed", { status: response.status });
  }

  const json = (await response.json()) as {
    response?: string;
    done_reason?: string;
    prompt_eval_count?: number;
    eval_count?: number;
  };
  const text = json.response?.trim();

  if (!text) {
    throw new RetryableError("Ollama provider returned no text");
  }

  return {
    ...completionFromText({
      text,
      provider: "ollama",
      model: `ollama/${model}`,
      started,
      prompt,
      finishReason: json.done_reason,
    }),
    tokensIn: json.prompt_eval_count ?? estimateTokens(prompt),
    tokensOut: json.eval_count ?? estimateTokens(text),
  };
}

export function getAIProvider(): AIProvider {
  const config = getRuntimeConfig();
  const provider = config.AI_PROVIDER;

  if (provider === "gateway") {
    return {
      name: "gateway",
      model: "openai/gpt-5.4",
      mode: "live",
      complete: completeWithGateway,
    };
  }

  if (provider === "openai") {
    if (!config.OPENAI_API_KEY) {
      return getMockAIProvider("OPENAI_API_KEY is missing; live OpenAI generation was not attempted.");
    }
    return {
      name: "openai",
      model: "openai/gpt-5.4",
      mode: "live",
      complete: completeWithOpenAI,
    };
  }

  if (provider === "anthropic") {
    if (!config.ANTHROPIC_API_KEY) {
      return getMockAIProvider("ANTHROPIC_API_KEY is missing; live Anthropic generation was not attempted.");
    }
    return {
      name: "anthropic",
      model: "anthropic/claude-sonnet-4.6",
      mode: "live",
      complete: completeWithAnthropic,
    };
  }

  if (provider === "ollama") {
    return {
      name: "ollama",
      model: `ollama/${config.OLLAMA_MODEL}`,
      mode: "live",
      complete: completeWithOllama,
    };
  }

  return getMockAIProvider();
}

export function getStorageProvider(): StorageProvider {
  return {
    name: "in-memory-object-storage",
    async put(key: string) {
      return { uri: `memory://${key}` };
    },
  };
}

export function getToolProvider(): ToolProvider {
  return {
    name: "safe-mock-tools",
    async execute(toolName: string, input: Record<string, unknown>) {
      return {
        provider: "mock",
        toolName,
        input,
        executedAt: new Date().toISOString(),
      };
    },
  };
}
