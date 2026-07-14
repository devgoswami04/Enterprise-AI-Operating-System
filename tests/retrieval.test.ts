import { describe, expect, it } from "vitest";
import { searchKnowledge } from "@/lib/data/store";

describe("retrieval", () => {
  it("returns relevant seeded chunks with scores", () => {
    const results = searchKnowledge("org-nova", "What are the Q2 revenue risks?", 3);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].document.title).toContain("Q2");
    expect(typeof results[0].score).toBe("number");
  });
});
