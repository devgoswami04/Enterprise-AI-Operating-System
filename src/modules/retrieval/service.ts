import { searchKnowledge } from "@/lib/data/store";
import type { SearchResult } from "@/lib/types";
import { assessInput } from "@/lib/security/controls";
import { evaluateRetrieval } from "@/lib/observability/evaluation";
import { logEvent } from "@/modules/shared/logger";
import type { SearchQueryInput } from "@/modules/retrieval/schemas";

export async function retrieveKnowledge(input: SearchQueryInput & {
  organizationId: string;
  userId?: string;
  requestId?: string;
}) {
  const assessed = assessInput(input.q);
  let results = await searchKnowledge(input.organizationId, assessed.sanitizedInput, input.limit);

  if (input.sourceType) {
    results = results.filter((result) => result.document.sourceType === input.sourceType);
  }

  if (input.documentId) {
    results = results.filter((result) => result.document.id === input.documentId);
  }

  logEvent(
    "info",
    {
      component: "retrieval",
      action: "retrieval.search",
      organizationId: input.organizationId,
      userId: input.userId,
      requestId: input.requestId,
    },
    "Knowledge retrieval completed",
    {
      queryLength: assessed.sanitizedInput.length,
      results: results.length,
      topScore: results[0]?.score ?? 0,
      filters: { sourceType: input.sourceType, documentId: input.documentId },
      securityFindings: assessed.findings,
    },
  );

  return {
    query: assessed.sanitizedInput,
    security: assessed,
    results,
  };
}

export function evaluateSearchResults(results: SearchResult[]) {
  const citations = results.map((result) => ({
    documentId: result.document.id,
    documentTitle: result.document.title,
    chunkId: result.chunk.id,
    quote: result.chunk.content.slice(0, 220),
    score: Number(result.score.toFixed(3)),
  }));
  return evaluateRetrieval(results, citations);
}
