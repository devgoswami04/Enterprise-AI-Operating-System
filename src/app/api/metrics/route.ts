import { requireApiSession } from "@/lib/auth";
import { getPrometheusMetrics } from "@/modules/observability/metrics";

export async function GET() {
  try {
    const session = await requireApiSession();
    return new Response(getPrometheusMetrics(session.organizationId), {
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      },
    });
  } catch {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }
}
