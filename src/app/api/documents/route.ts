import { requireApiSession } from "@/lib/auth";
import { listDocuments } from "@/lib/data/store";
import { requireRole } from "@/lib/security/rbac";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { ingestUploadedDocument } from "@/modules/documents/service";
import { toErrorResponse } from "@/modules/shared/errors";
import { createRequestId } from "@/modules/shared/logger";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireApiSession();
    const rateLimit = checkRateLimit(`documents:list:${session.organizationId}:${session.id}`, {
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
      { documents: listDocuments(session.organizationId) },
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
    const requestId = createRequestId("doc-api");
    const rateLimit = checkRateLimit(`documents:upload:${session.organizationId}:${session.id}`, {
      limit: 8,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Upload rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "File is required" }, { status: 400 });
    }
    const document = await ingestUploadedDocument({
      organizationId: session.organizationId,
      uploadedBy: session.id,
      file,
      requestId,
    });

    return Response.json({ document }, { status: 201, headers: rateLimitHeaders(rateLimit) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
