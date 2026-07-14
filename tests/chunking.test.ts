import { describe, expect, it } from "vitest";
import { chunkText, estimateTokens, normalizeText } from "@/lib/ai/chunking";

describe("chunking", () => {
  it("normalizes whitespace and chunks long text", () => {
    const text = "Alpha   beta.\n\n\nGamma delta. ".repeat(80);
    const chunks = chunkText(text, { chunkSize: 220, overlap: 40 });

    expect(normalizeText("A   B\n\n\nC")).toBe("A B\n\nC");
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.length <= 260)).toBe(true);
  });

  it("estimates tokens for non-empty input", () => {
    expect(estimateTokens("one two three")).toBeGreaterThanOrEqual(4);
  });
});
