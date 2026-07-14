import { requireApiSession } from "@/lib/auth";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { searchQuerySchema } from "@/modules/retrieval/schemas";
import { evaluateSearchResults, retrieveKnowledge } from "@/modules/retrieval/service";
import { toErrorResponse } from "@/modules/shared/errors";
import { parseWithSchema } from "@/modules/shared/validation";

export async function GET(request: Request) {
  try {
    const session = await requireApiSession();
    const rateLimit = checkRateLimit(`search:${session.organizationId}:${session.id}`, {
      limit: 50,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";

    if (!query) {
      return Response.json({ results: [] });
    }

    const parsed = parseWithSchema(
      searchQuerySchema,
      {
        q: query,
        limit: url.searchParams.get("limit") ?? undefined,
        sourceType: url.searchParams.get("sourceType") ?? undefined,
        documentId: url.searchParams.get("documentId") ?? undefined,
      },
      "Search query",
    );
    const retrieval = await retrieveKnowledge({
      ...parsed,
      organizationId: session.organizationId,
      userId: session.id,
    });

    return Response.json(
      {
        query: retrieval.query,
        security: retrieval.security,
        results: retrieval.results,
        evaluation: evaluateSearchResults(retrieval.results),
      },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
