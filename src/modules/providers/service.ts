import { getRuntimeConfig } from "@/modules/shared/env";

export function getProviderPosture() {
  const config = getRuntimeConfig();
  return {
    ai: {
      provider: config.AI_PROVIDER,
      liveReady:
        config.AI_PROVIDER === "mock" ||
        config.AI_PROVIDER === "gateway" ||
        config.AI_PROVIDER === "ollama" ||
        (config.AI_PROVIDER === "openai" && Boolean(config.OPENAI_API_KEY)) ||
        (config.AI_PROVIDER === "anthropic" && Boolean(config.ANTHROPIC_API_KEY)),
      ollamaBaseUrl: config.OLLAMA_BASE_URL,
      ollamaModel: config.OLLAMA_MODEL,
    },
    embeddings: {
      provider: config.EMBEDDING_PROVIDER,
      liveReady:
        config.EMBEDDING_PROVIDER === "mock" ||
        (config.EMBEDDING_PROVIDER === "openai" && Boolean(config.OPENAI_API_KEY)) ||
        (config.EMBEDDING_PROVIDER === "huggingface" && Boolean(config.HUGGINGFACE_API_TOKEN)),
    },
    tools: {
      provider: config.TOOL_PROVIDER,
      liveTools: config.features.liveTools,
      githubReady: Boolean(config.GITHUB_TOKEN),
      slackReady: Boolean(config.SLACK_BOT_TOKEN),
      calendarReady: Boolean(config.CALENDAR_WEBHOOK_URL),
    },
    queues: {
      provider: config.features.bullmq ? "bullmq" : "memory",
      redisReady: Boolean(config.REDIS_URL),
    },
    persistence: {
      pgvectorReady: config.features.pgvector,
      databaseReady: Boolean(config.DATABASE_URL),
    },
  };
}
