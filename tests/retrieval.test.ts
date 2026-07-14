import { describe, expect, it } from "vitest";
import { chunkText, estimateTokens, normalizeText } from "@/lib/ai/chunking";
import { cosineSimilarity, embedText } from "@/lib/ai/embeddings";
import {
  DEMO_ORG_ID,
  createDocument,
  listDocuments,
  searchKnowledge,
  searchToCitations,
} from "@/lib/data/memory-store";

describe("chunking", () => {
  it("normalizes whitespace and windows line endings", () => {
    expect(normalizeText("a\r\nb   c\n\n\n\nd")).toBe("a\nb c\n\nd");
  });

  it("splits long text into overlapping chunks at sentence boundaries", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} carries meaningful payload.`).join(" ");
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1000);
    }
  });

  it("estimates tokens proportional to word count", () => {
    expect(estimateTokens("one two three four")).toBeGreaterThanOrEqual(4);
  });
});

describe("mock embeddings", () => {
  it("is deterministic for identical input", () => {
    expect(embedText("enterprise retrieval")).toEqual(embedText("enterprise retrieval"));
  });

  it("scores identical text at ~1.0 cosine similarity", () => {
    const a = embedText("quarterly revenue risk");
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5);
  });

  it("scores related text higher than unrelated text", () => {
    const query = embedText("revenue risk procurement");
    const related = embedText("revenue grew but procurement cycles are a risk");
    const unrelated = embedText("the quick brown fox jumps over a lazy dog");
    expect(cosineSimilarity(query, related)).toBeGreaterThan(cosineSimilarity(query, unrelated));
  });
});

describe("in-memory ingestion + retrieval", () => {
  it("ingests a document, retrieves it by meaning, and cites it", async () => {
    const document = await Promise.resolve(
      createDocument({
        organizationId: DEMO_ORG_ID,
        title: "Incident Postmortem Guide",
        mimeType: "text/markdown",
        text: "After every production incident, teams must write a postmortem covering root cause, blast radius, and remediation owners within five business days.",
        uploadedBy: "user-admin",
      }),
    );
    expect(document.chunkCount).toBeGreaterThan(0);

    const results = searchKnowledge(DEMO_ORG_ID, "who writes the postmortem after an incident", 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results.map((result) => result.document.title)).toContain("Incident Postmortem Guide");

    const citations = searchToCitations(results);
    expect(citations[0]).toHaveProperty("documentId");
    expect(citations[0]).toHaveProperty("quote");
    expect(citations[0].score).toBeGreaterThan(0);
  });

  it("never returns documents across tenant boundaries", () => {
    const foreign = searchKnowledge("org-other", "postmortem", 5);
    expect(foreign).toHaveLength(0);
    expect(listDocuments("org-other")).toHaveLength(0);
  });

  it("ranks the on-topic document above off-topic seeds", () => {
    const results = rankChunksSample();
    expect(results[0].document.title).toContain("Q2");
  });
});

function rankChunksSample() {
  const documents = listDocuments(DEMO_ORG_ID);
  const q2 = documents.find((doc) => doc.title.includes("Q2"));
  expect(q2).toBeDefined();
  return searchKnowledge(DEMO_ORG_ID, "Q2 revenue concentration risk renewal", 3);
}
