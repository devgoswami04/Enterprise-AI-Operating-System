import { getDatabaseUrl } from "@/lib/db/client";

export type SystemCheck = {
  name: string;
  status: "ready" | "mock" | "missing" | "disabled";
  detail: string;
};

export type SystemHealth = {
  status: "ready" | "degraded";
  timestamp: string;
  app: {
    name: string;
    version: string;
    environment: string;
  };
  checks: SystemCheck[];
  routes: string[];
};

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function aiProviderStatus(provider: string): SystemCheck["status"] {
  if (provider === "mock") {
    return "mock";
  }
  if (provider === "openai") {
    return hasEnv("OPENAI_API_KEY") ? "ready" : "missing";
  }
  if (provider === "anthropic") {
    return hasEnv("ANTHROPIC_API_KEY") ? "ready" : "missing";
  }
  return "ready";
}

export function getProviderChecks(): SystemCheck[] {
  const aiProvider = process.env.AI_PROVIDER ?? "mock";
  const embeddingProvider = process.env.EMBEDDING_PROVIDER ?? "mock";
  const databaseUrl = getDatabaseUrl();
  const aiStatus = aiProviderStatus(aiProvider);

  return [
    {
      name: "Database",
      status: databaseUrl ? "ready" : "mock",
      detail: databaseUrl
        ? "DATABASE_URL is configured for Postgres/pgvector."
        : "Using in-memory demo store. Configure DATABASE_URL for persistence.",
    },
    {
      name: "AI Provider",
      status: aiStatus,
      detail:
        aiProvider === "mock"
          ? "Safe deterministic orchestration is active."
          : aiStatus === "missing"
            ? `AI_PROVIDER=${aiProvider} needs its required credential before live generation can run.`
            : `Configured provider: ${aiProvider}.`,
    },
    {
      name: "Embedding Provider",
      status: embeddingProvider === "mock" ? "mock" : "ready",
      detail:
        embeddingProvider === "mock"
          ? "Deterministic local hash embeddings are active."
          : `Configured provider: ${embeddingProvider}.`,
    },
    {
      name: "OpenAI",
      status: hasEnv("OPENAI_API_KEY") ? "ready" : "missing",
      detail: hasEnv("OPENAI_API_KEY")
        ? "OPENAI_API_KEY is configured for direct provider calls."
        : "Optional. Required only for AI_PROVIDER=openai or EMBEDDING_PROVIDER=openai.",
    },
    {
      name: "Anthropic",
      status: hasEnv("ANTHROPIC_API_KEY") ? "ready" : "missing",
      detail: hasEnv("ANTHROPIC_API_KEY")
        ? "ANTHROPIC_API_KEY is configured for direct Anthropic generation."
        : "Optional. Required only for AI_PROVIDER=anthropic.",
    },
    {
      name: "Ollama",
      status: aiProvider === "ollama" ? "ready" : "disabled",
      detail:
        aiProvider === "ollama"
          ? `Local Ollama generation targets ${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}.`
          : "Optional. Set AI_PROVIDER=ollama for local LLM generation.",
    },
    {
      name: "Hugging Face",
      status: hasEnv("HUGGINGFACE_API_TOKEN") || embeddingProvider === "huggingface" ? "ready" : "missing",
      detail:
        embeddingProvider === "huggingface"
          ? `Transformers.js embedding model: ${process.env.HUGGINGFACE_EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2"}.`
          : "Optional. Configure EMBEDDING_PROVIDER=huggingface for local model embeddings.",
    },
    {
      name: "GitHub",
      status: hasEnv("GITHUB_TOKEN") ? "ready" : "disabled",
      detail: hasEnv("GITHUB_TOKEN")
        ? "GitHub token is present for future tool execution."
        : "Safe mock tool mode is active. GitHub execution is disabled.",
    },
    {
      name: "External Tools",
      status: "mock",
      detail: "Slack, Gmail, Jira, Calendar, Browser, and GitHub actions remain human-gated and mock-safe.",
    },
  ];
}

export function getSystemHealth(): SystemHealth {
  const checks = getProviderChecks();
  const missingRequired = checks.some(
    (check) => check.status === "missing" && ["Database"].includes(check.name),
  );

  return {
    status: missingRequired ? "degraded" : "ready",
    timestamp: new Date().toISOString(),
    app: {
      name: "Enterprise AI OS",
      version: process.env.npm_package_version ?? "0.1.0",
      environment: process.env.NODE_ENV ?? "development",
    },
    checks,
    routes: [
      "POST /api/chat",
      "GET/POST /api/documents",
      "GET /api/search",
      "GET /api/memory",
      "GET /api/security/events",
      "GET /api/metrics",
      "POST /api/workflows/:id/runs",
      "GET /api/runs/:id/events",
      "POST /api/tools/:tool/execute",
      "GET /api/health",
      "GET /api/openapi",
    ],
  };
}
