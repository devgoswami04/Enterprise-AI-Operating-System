/**
 * Applies the SQL migrations in ./drizzle to the configured database,
 * creating the pgvector extension first (drizzle-kit cannot do that part).
 *
 * Usage: npm run db:migrate   (requires DATABASE_URL)
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Start Postgres (docker compose up -d) and set it in .env.local first.");
    process.exit(1);
  }

  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client);

  await client`CREATE EXTENSION IF NOT EXISTS vector`;
  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log("Migrations applied.");
  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
