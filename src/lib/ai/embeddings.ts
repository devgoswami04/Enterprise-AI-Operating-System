export const EMBEDDING_DIMENSIONS = 64;

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function embedText(input: string, dimensions = EMBEDDING_DIMENSIONS) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % dimensions;
    const sign = hash % 2 === 0 ? 1 : -1;
    vector[index] += sign * (1 + Math.min(token.length, 14) / 14);
  }

  return normalizeVector(vector);
}

export function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) {
    return vector;
  }
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

export function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
  }
  return dot;
}

export type EmbeddingProvider = {
  name: string;
  embed(text: string): Promise<number[]>;
};

function resizeEmbedding(vector: number[], dimensions = EMBEDDING_DIMENSIONS) {
  if (vector.length === dimensions) {
    return normalizeVector(vector);
  }

  const resized = Array.from({ length: dimensions }, () => 0);
  for (let index = 0; index < vector.length; index += 1) {
    resized[index % dimensions] += vector[index];
  }

  return normalizeVector(resized);
}

async function embedWithOpenAI(text: string) {
  const { embed } = await import("ai");
  const { openai } = await import("@ai-sdk/openai");
  const result = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text,
  });
  return resizeEmbedding(result.embedding);
}

type FeatureExtractionOutput = {
  data?: Iterable<number>;
  tolist?: () => unknown;
};

function coerceFeatureExtractionOutput(output: unknown) {
  const maybeOutput = output as FeatureExtractionOutput;
  if (maybeOutput.data) {
    return Array.from(maybeOutput.data).map(Number);
  }

  const listed = maybeOutput.tolist?.();
  if (Array.isArray(listed)) {
    return listed.flat(Number.POSITIVE_INFINITY).map(Number);
  }

  return [];
}

async function embedWithHuggingFace(text: string) {
  const { pipeline } = await import("@huggingface/transformers");
  const extractor = await pipeline(
    "feature-extraction",
    process.env.HUGGINGFACE_EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2",
    { dtype: "q8" },
  );

  try {
    const output = await extractor(text, { pooling: "mean", normalize: true });
    return resizeEmbedding(coerceFeatureExtractionOutput(output));
  } finally {
    await extractor.dispose();
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  const provider = process.env.EMBEDDING_PROVIDER ?? "mock";

  if (provider === "openai") {
    return {
      name: "openai/text-embedding-3-small",
      async embed(text: string) {
        return embedWithOpenAI(text);
      },
    };
  }

  if (provider === "huggingface") {
    return {
      name: process.env.HUGGINGFACE_EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2",
      async embed(text: string) {
        return embedWithHuggingFace(text);
      },
    };
  }

  return {
    name: "mock/deterministic-hash",
    async embed(text: string) {
      return embedText(text);
    },
  };
}
