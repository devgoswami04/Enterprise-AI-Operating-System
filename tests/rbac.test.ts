import { describe, expect, it } from "vitest";
import { hasRole } from "@/lib/security/rbac";
import type { SessionUser } from "@/lib/types";

const baseUser: SessionUser = {
  id: "user",
  organizationId: "org-nova",
  organizationName: "NovaWorks Enterprise",
  email: "user@example.com",
  name: "User",
  role: "member",
  avatar: "U",
};

describe("rbac", () => {
  it("allows higher roles to satisfy lower permissions", () => {
    expect(hasRole({ ...baseUser, role: "admin" }, "member")).toBe(true);
    expect(hasRole({ ...baseUser, role: "member" }, "viewer")).toBe(true);
    expect(hasRole({ ...baseUser, role: "viewer" }, "member")).toBe(false);
  });
});
