import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDatabaseUrl() {
  return process.env.DATABASE_URL;
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
