import { requireApiSession } from "@/lib/auth";
import { getRecentMessages, listMemories } from "@/lib/data/store";
import { requireRole } from "@/lib/security/rbac";
import { memoryRecallSchema, memoryWriteSchema } from "@/modules/memory/schemas";
import { recallRelevantMemory, writeDurableMemory } from "@/modules/memory/service";
import { toErrorResponse } from "@/modules/shared/errors";
import { parseJsonBody } from "@/modules/shared/validation";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

export async function GET() {
  try {
    const session = await requireApiSession();
    const rateLimit = checkRateLimit(`memory:list:${session.organizationId}:${session.id}`, {
      limit: 60,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }
    return Response.json(
      {
        memories: listMemories(session.organizationId),
        recentMessages: getRecentMessages(session.organizationId),
      },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession();
    requireRole(session, "member");
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") ?? "write";

    if (mode === "recall") {
      const body = await parseJsonBody(request, memoryRecallSchema, "Memory recall");
      return Response.json({
        results: recallRelevantMemory({
          organizationId: session.organizationId,
          query: body.query,
          limit: body.limit,
        }),
      });
    }

    const body = await parseJsonBody(request, memoryWriteSchema, "Memory write");
    return Response.json(
      {
        memory: writeDurableMemory({
          organizationId: session.organizationId,
          userId: session.id,
          ...body,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
