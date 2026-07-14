import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDatabaseUrl() {
  return process.env.DATABASE_URL;
}

/**
 * True when a DATABASE_URL is configured. The rest of the app uses this to
 * choose between the real Postgres-backed repositories (src/lib/db/repositories)
 * and the zero-setup in-memory store (src/lib/data/memory-store.ts). This keeps
 * `npm install && npm run dev` working with no external services, while making
 * the Postgres path fully real once DATABASE_URL is set (e.g. via docker-compose).
 */
export function isDatabaseConfigured() {
  return Boolean(getDatabaseUrl());
}

export function getDb() {
  const url = getDatabaseUrl();

  if (!url) {
    throw new Error("DATABASE_URL is not configured. Use the in-memory provider or start Docker Compose.");
  }

  if (!client) {
    client = postgres(url, { max: 5 });
  }

  if (!db) {
    db = drizzle(client, { schema });
  }

  return db;
}
