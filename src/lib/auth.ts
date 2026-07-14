import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findDemoUser, toSessionUser } from "@/lib/data/store";
import type { SessionUser } from "@/lib/types";

const SESSION_COOKIE = "enterprise_ai_os_session";
const encoder = new TextEncoder();

function getSecret() {
  return encoder.encode(
    process.env.SESSION_SECRET ??
      "development-only-enterprise-ai-os-secret-change-before-production",
  );
}

async function signSession(user: SessionUser) {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function createSession(user: SessionUser) {
  const token = await signSession(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const user = payload.user as SessionUser | undefined;
    return user ?? null;
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireApiSession() {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}

export async function authenticateDemoUser(email: string, password: string) {
  const user = findDemoUser(email);
  if (!user || user.password !== password) {
    return null;
  }
  return toSessionUser(user);
}
