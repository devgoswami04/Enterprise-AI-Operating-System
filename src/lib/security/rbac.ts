import type { Role, SessionUser } from "@/lib/types";

const roleRank: Record<Role, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
};

export function hasRole(user: SessionUser, minimumRole: Role) {
  return roleRank[user.role] >= roleRank[minimumRole];
}

export function requireRole(user: SessionUser, minimumRole: Role) {
  if (!hasRole(user, minimumRole)) {
    throw new Error(`Requires ${minimumRole} role`);
  }
}
