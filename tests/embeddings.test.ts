import { describe, expect, it, vi } from "vitest";
import { EMBEDDING_DIMENSIONS, getEmbeddingProvider } from "@/lib/ai/embeddings";

describe("embedding providers", () => {
  it("defaults to deterministic mock embeddings", async () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "mock");
    const provider = getEmbeddingProvider();
    const embedding = await provider.embed("enterprise knowledge search");

    expect(provider.name).toBe("mock/deterministic-hash");
    expect(embedding).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(embedding.some((value) => value !== 0)).toBe(true);

    vi.unstubAllEnvs();
  });

  it("exposes a Hugging Face provider without loading it until embed is called", () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "huggingface");
    vi.stubEnv("HUGGINGFACE_EMBEDDING_MODEL", "Xenova/all-MiniLM-L6-v2");

    expect(getEmbeddingProvider().name).toBe("Xenova/all-MiniLM-L6-v2");

    vi.unstubAllEnvs();
  });
});
