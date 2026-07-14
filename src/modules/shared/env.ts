import { z } from "zod";

const booleanFlag = z
  .string()
  .optional()
  .transform((value) => value === "true" || value === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  AI_PROVIDER: z.enum(["mock", "openai", "gateway", "anthropic", "ollama"]).default("mock"),
  EMBEDDING_PROVIDER: z.enum(["mock", "openai", "huggingface"]).default("mock"),
  TOOL_PROVIDER: z.enum(["mock", "live"]).default("mock"),
  QUEUE_PROVIDER: z.enum(["memory", "bullmq"]).default("memory"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  HUGGINGFACE_API_TOKEN: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("llama3.1"),
  GITHUB_TOKEN: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  CALENDAR_WEBHOOK_URL: z.string().url().optional(),
  ENABLE_LIVE_TOOLS: booleanFlag,
  ENABLE_BULLMQ: booleanFlag,
  ENABLE_PGVECTOR: booleanFlag,
});

export type RuntimeConfig = z.infer<typeof envSchema> & {
  features: {
    liveTools: boolean;
    bullmq: boolean;
    pgvector: boolean;
    mockSafeMode: boolean;
  };
};

let cachedConfig: RuntimeConfig | null = null;

export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = envSchema.parse(process.env);
  cachedConfig = {
    ...parsed,
    features: {
      liveTools: parsed.ENABLE_LIVE_TOOLS && parsed.TOOL_PROVIDER === "live",
      bullmq: parsed.ENABLE_BULLMQ && parsed.QUEUE_PROVIDER === "bullmq" && Boolean(parsed.REDIS_URL),
      pgvector: parsed.ENABLE_PGVECTOR && Boolean(parsed.DATABASE_URL),
      mockSafeMode: parsed.TOOL_PROVIDER !== "live" || !parsed.ENABLE_LIVE_TOOLS,
    },
  };
  return cachedConfig;
}

export function resetRuntimeConfigForTests() {
  cachedConfig = null;
}
