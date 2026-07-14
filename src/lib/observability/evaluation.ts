import type { Citation, SearchResult } from "@/lib/types";

export type RetrievalEvaluation = {
  groundedness: number;
  citationCoverage: number;
  retrievalQuality: number;
  hallucinationRisk: "low" | "medium" | "high";
  notes: string[];
};

export function evaluateRetrieval(results: SearchResult[], citations: Citation[]): RetrievalEvaluation {
  const topScore = results[0]?.score ?? 0;
  const groundedness = Math.min(100, Math.round(Math.max(0, topScore) * 100));
  const citationCoverage = Math.min(100, citations.length * 25);
  const retrievalQuality = Math.round((groundedness * 0.65 + citationCoverage * 0.35));
  const hallucinationRisk =
    retrievalQuality >= 65 ? "low" : retrievalQuality >= 35 ? "medium" : "high";

  const notes = [
    `${citations.length} citations attached`,
    `top retrieval score ${topScore.toFixed(3)}`,
  ];

  if (hallucinationRisk !== "low") {
    notes.push("answer should request more source material before execution");
  }

  return {
    groundedness,
    citationCoverage,
    retrievalQuality,
    hallucinationRisk,
    notes,
  };
}
