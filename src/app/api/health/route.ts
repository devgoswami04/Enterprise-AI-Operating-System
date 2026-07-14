import { getSystemHealth } from "@/lib/system/health";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getSystemHealth(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
