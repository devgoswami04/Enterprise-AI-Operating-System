import { orchestrateChat, toSse } from "@/lib/ai/orchestrator";
import { requireApiSession } from "@/lib/auth";
import { checkRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { promptInputSchema } from "@/modules/security/schemas";
import { toErrorResponse } from "@/modules/shared/errors";
import { createRequestId, logEvent } from "@/modules/shared/logger";
import { parseJsonBody } from "@/modules/shared/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireApiSession();
    const requestId = createRequestId("chat-api");
    const rateLimit = checkRateLimit(`chat:${session.organizationId}:${session.id}`, {
      limit: 20,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Rate limit exceeded. Try again shortly." },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const body = await parseJsonBody(request, promptInputSchema, "Chat request");

    logEvent(
      "info",
      {
        component: "api",
        action: "chat.request",
        organizationId: session.organizationId,
        userId: session.id,
        requestId,
      },
      "Chat request accepted",
      { inputLength: body.message.length },
    );

    const result = await orchestrateChat(session, body.message);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        for (const step of result.steps) {
          controller.enqueue(encoder.encode(toSse({ step }, "step")));
          await new Promise((resolve) => setTimeout(resolve, 120));
        }

        for (const token of result.answer.split(/(\s+)/).filter(Boolean)) {
          controller.enqueue(encoder.encode(toSse({ token }, "token")));
          await new Promise((resolve) => setTimeout(resolve, 18));
        }

        controller.enqueue(
          encoder.encode(
            toSse(
              {
                answer: result.answer,
                citations: result.citations,
                runId: result.runId,
                latencyMs: result.latencyMs,
                modelDecision: result.modelDecision,
                generation: result.generation,
                security: result.security,
                evaluation: result.evaluation,
              },
              "done",
            ),
          ),
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Content-Type-Options": "nosniff",
        ...rateLimitHeaders(rateLimit),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
