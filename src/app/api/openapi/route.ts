import { getOpenApiSpec } from "@/lib/system/openapi";

export async function GET(request: Request) {
  return Response.json(getOpenApiSpec(new URL(request.url).origin), {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
