import { toSse } from "@/lib/ai/orchestrator";
import { requireApiSession } from "@/lib/auth";
import { getWorkflowExecutor } from "@/lib/workflows/engine";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const session = await requireApiSession();
    const { id } = (await context.params) as { id: string };
    const executor = getWorkflowExecutor();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        for await (const event of executor.streamRun(session, id)) {
          controller.enqueue(encoder.encode(toSse(event, String(event.type ?? "message"))));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }
}
