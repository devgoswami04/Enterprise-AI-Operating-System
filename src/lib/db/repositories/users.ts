import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { memberships, organizations, users } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/types";

async function loadSessionUser(userId: string): Promise<SessionUser | undefined> {
  const db = getDb();
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatar: users.avatar,
      role: memberships.role,
      organizationId: organizations.id,
      organizationName: organizations.name,
    })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) return undefined;

  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    email: row.email,
    name: row.name,
    role: row.role,
    avatar: row.avatar ?? row.name.slice(0, 2).toUpperCase(),
  };
}

/**
 * Real authentication: look up the user by email, verify the bcrypt hash
 * (never a plaintext compare), and return their org-scoped session. This is
 * the production path — seed.ts hashes the demo passwords with bcryptjs
 * when writing them into Postgres, so this only ever compares hashes.
 */
export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatar: users.avatar,
      passwordHash: users.passwordHash,
      role: memberships.role,
      organizationId: organizations.id,
      organizationName: organizations.name,
    })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!row) return null;

  const valid = await bcrypt.compare(password, row.passwordHash);
  if (!valid) return null;

  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    email: row.email,
    name: row.name,
    role: row.role,
    avatar: row.avatar ?? row.name.slice(0, 2).toUpperCase(),
  };
}

export async function getDemoUsers(organizationId: string): Promise<SessionUser[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatar: users.avatar,
      role: memberships.role,
      organizationId: organizations.id,
      organizationName: organizations.name,
    })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(organizations.id, organizationId));

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    email: row.email,
    name: row.name,
    role: row.role,
    avatar: row.avatar ?? row.name.slice(0, 2).toUpperCase(),
  }));
}

export async function getUserById(userId: string) {
  return loadSessionUser(userId);
}
