import { describe, expect, it, vi } from "vitest";
import { selectModelForTask } from "@/lib/ai/model-router";
import { evaluateRetrieval } from "@/lib/observability/evaluation";
import type { Citation, DocumentChunkRecord, DocumentRecord, SearchResult } from "@/lib/types";

const document: DocumentRecord = {
  id: "doc-test",
  organizationId: "org-nova",
  title: "Security Policy",
  sourceType: "seed",
  mimeType: "text/markdown",
  status: "indexed",
  summary: "Security approvals",
  uploadedBy: "system",
  chunkCount: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const chunk: DocumentChunkRecord = {
  id: "chunk-test",
  organizationId: "org-nova",
  documentId: document.id,
  chunkIndex: 0,
  content: "High impact tools require approval.",
  embedding: [0.1, 0.2, 0.3],
  tokenCount: 8,
  createdAt: document.createdAt,
};

describe("model router", () => {
  it("uses the safe mock orchestrator by default", () => {
    vi.stubEnv("AI_PROVIDER", "mock");

    const decision = selectModelForTask({ objective: "Summarize a policy." });

    expect(decision.provider).toBe("mock");
    expect(decision.model).toBe("mock-enterprise-orchestrator");

    vi.unstubAllEnvs();
  });

  it("upgrades high-risk work to a guarded reasoning policy", () => {
    vi.stubEnv("AI_PROVIDER", "gateway");

    const decision = selectModelForTask({
      objective: "Run a sensitive workflow.",
      riskLevel: "high",
    });

    expect(decision.model).toBe("anthropic/claude-sonnet-4.6");

    vi.unstubAllEnvs();
  });
});

describe("retrieval evaluation", () => {
  it("scores cited, high-confidence retrieval as low risk", () => {
    const results: SearchResult[] = [{ chunk, document, score: 0.9 }];
    const citations: Citation[] = [
      {
        documentId: document.id,
        documentTitle: document.title,
        quote: chunk.content,
        score: 0.9,
      },
    ];

    const evaluation = evaluateRetrieval(results, citations);

    expect(evaluation.groundedness).toBe(90);
    expect(evaluation.retrievalQuality).toBeGreaterThanOrEqual(65);
    expect(evaluation.hallucinationRisk).toBe("low");
  });
});
