import { requireApiSession } from "@/lib/auth";
import { listAuditLogs, listSecurityEvents, listToolCalls } from "@/lib/data/store";
import { requireRole } from "@/lib/security/rbac";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

export async function GET() {
  try {
    const session = await requireApiSession();
    requireRole(session, "admin");
    const rateLimit = checkRateLimit(`security:list:${session.organizationId}:${session.id}`, {
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
        securityEvents: listSecurityEvents(session.organizationId),
        auditLogs: listAuditLogs(session.organizationId),
        toolCalls: listToolCalls(session.organizationId),
      },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Security events unavailable";
    return Response.json(
      { error: message === "UNAUTHENTICATED" ? "Unauthenticated" : message },
      { status: message === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }
}
