import { describe, expect, it, vi } from "vitest";
import { getSystemHealth } from "@/lib/system/health";
import { getOpenApiSpec } from "@/lib/system/openapi";

describe("system health", () => {
  it("reports mock-safe readiness without secrets", () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    vi.stubEnv("EMBEDDING_PROVIDER", "mock");
    vi.stubEnv("DATABASE_URL", "");

    const health = getSystemHealth();

    expect(health.status).toBe("ready");
    expect(health.checks.map((check) => check.name)).toContain("Database");
    expect(health.routes).toContain("GET /api/health");
    expect(health.routes).toContain("GET /api/security/events");

    vi.unstubAllEnvs();
  });
});

describe("openapi contract", () => {
  it("includes the core enterprise AI OS endpoints", () => {
    const spec = getOpenApiSpec("https://example.com");

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/api/chat"]).toBeDefined();
    expect(spec.paths["/api/memory"]).toBeDefined();
    expect(spec.paths["/api/security/events"]).toBeDefined();
    expect(spec.paths["/api/workflows/{id}/runs"]).toBeDefined();
    expect(spec.servers[0].url).toBe("https://example.com");
  });
});
