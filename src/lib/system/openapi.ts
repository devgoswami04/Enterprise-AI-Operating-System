export function getOpenApiSpec(origin = "http://localhost:3000") {
  return {
    openapi: "3.1.0",
    info: {
      title: "Enterprise AI OS API",
      version: "0.1.0",
      description:
        "API contract for the multi-agent enterprise AI workspace MVP.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/health": {
        get: {
          summary: "Return deployment and provider readiness.",
          responses: { "200": { description: "System health snapshot" } },
        },
      },
      "/api/openapi": {
        get: {
          summary: "Return this OpenAPI contract.",
          responses: { "200": { description: "OpenAPI document" } },
        },
      },
      "/api/chat": {
        post: {
          summary: "Stream a cited multi-agent chat answer over SSE.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message"],
                  properties: { message: { type: "string" } },
                },
              },
            },
          },
          responses: {
            "200": { description: "text/event-stream response" },
            "401": { description: "Unauthenticated" },
          },
        },
      },
      "/api/documents": {
        get: {
          summary: "List indexed documents for the active organization.",
          responses: { "200": { description: "Document list" } },
        },
        post: {
          summary: "Upload and index a PDF/text/markdown/CSV/JSON document.",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: { file: { type: "string", format: "binary" } },
                },
              },
            },
          },
          responses: {
            "201": { description: "Document indexed" },
            "403": { description: "Insufficient role" },
          },
        },
      },
      "/api/search": {
        get: {
          summary: "Search indexed workspace knowledge.",
          parameters: [
            {
              name: "q",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "Ranked search results" } },
        },
      },
      "/api/memory": {
        get: {
          summary: "List long-term memories and recent short-term messages.",
          responses: {
            "200": { description: "Memory records and recent conversation messages" },
            "401": { description: "Unauthenticated" },
          },
        },
      },
      "/api/security/events": {
        get: {
          summary: "List security events, audit logs, and tool calls for admins.",
          responses: {
            "200": { description: "Security monitoring records" },
            "403": { description: "Admin role required" },
          },
        },
      },
      "/api/metrics": {
        get: {
          summary: "Expose Prometheus-style tenant-scoped runtime metrics.",
          responses: {
            "200": { description: "Prometheus text metrics" },
            "401": { description: "Unauthenticated" },
          },
        },
      },
      "/api/workflows/{id}/runs": {
        post: {
          summary: "Start a workflow run.",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "201": { description: "Workflow run created" } },
        },
      },
      "/api/runs/{id}/events": {
        get: {
          summary: "Stream workflow execution events over SSE.",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "text/event-stream response" } },
        },
      },
      "/api/tools/{tool}/execute": {
        post: {
          summary: "Approve and execute a safe mock tool action.",
          parameters: [
            { name: "tool", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Tool execution record" } },
        },
      },
    },
  };
}
