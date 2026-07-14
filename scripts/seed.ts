/**
 * Seeds the Postgres database with the demo organization, RBAC users
 * (bcrypt-hashed passwords), sample documents (chunked + embedded through
 * the configured EMBEDDING_PROVIDER), starter memories, and a pending
 * tool-call approval so the cockpit has meaningful data on first login.
 *
 * Usage:  DATABASE_URL=postgres://... npx tsx scripts/seed.ts
 *         (or `npm run db:seed` after docker compose up -d && npm run db:push)
 *
 * Idempotent: safe to run repeatedly — existing rows are detected by
 * email/slug and skipped rather than duplicated.
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "../src/lib/db/client";
import {
  documents as documentsTable,
  memberships,
  memories as memoriesTable,
  organizations,
  toolCalls,
  users,
} from "../src/lib/db/schema";
import { DEMO_ORG_SEED, DEMO_USER_SEEDS, SEED_DOCUMENTS } from "../src/lib/data/definitions";
import { createDocument } from "../src/lib/db/repositories/documents";
import { writeMemory } from "../src/lib/db/repositories/memory";

async function main() {
  if (!isDatabaseConfigured()) {
    console.error("DATABASE_URL is not set. Start Postgres (docker compose up -d) and set it in .env.local first.");
    process.exit(1);
  }

  const db = getDb();

  // 1. Organization
  let [org] = await db.select().from(organizations).where(eq(organizations.slug, DEMO_ORG_SEED.slug));
  if (!org) {
    [org] = await db
      .insert(organizations)
      .values({ name: DEMO_ORG_SEED.name, slug: DEMO_ORG_SEED.slug })
      .returning();
    console.log(`Created organization ${org.name} (${org.id})`);
  } else {
    console.log(`Organization ${org.name} already exists, skipping`);
  }

  // 2. Users + memberships (bcrypt-hashed passwords)
  const userIds: Record<string, string> = {};
  for (const seed of DEMO_USER_SEEDS) {
    let [user] = await db.select().from(users).where(eq(users.email, seed.email));
    if (!user) {
      const passwordHash = await bcrypt.hash(seed.password, 10);
      [user] = await db
        .insert(users)
        .values({ email: seed.email, name: seed.name, passwordHash, avatar: seed.avatar })
        .returning();
      await db.insert(memberships).values({ organizationId: org.id, userId: user.id, role: seed.role });
      console.log(`Created ${seed.role} user ${seed.email}`);
    } else {
      console.log(`User ${seed.email} already exists, skipping`);
    }
    userIds[seed.role] = user.id;
  }

  // 3. Documents (real chunk + embed + pgvector persist through the repository)
  const existingDocs = await db.select().from(documentsTable).where(eq(documentsTable.organizationId, org.id));
  if (existingDocs.length === 0) {
    for (const seed of SEED_DOCUMENTS) {
      const document = await createDocument({
        organizationId: org.id,
        title: seed.title,
        mimeType: seed.mimeType,
        text: seed.text,
        uploadedBy: userIds.admin,
        sourceType: "seed",
      });
      console.log(`Indexed "${document.title}" (${document.chunkCount} chunks)`);
    }
  } else {
    console.log(`${existingDocs.length} documents already present, skipping document seed`);
  }

  // 4. Starter memories
  const existingMemories = await db.select().from(memoriesTable).where(eq(memoriesTable.organizationId, org.id));
  if (existingMemories.length === 0) {
    await writeMemory({
      organizationId: org.id,
      type: "semantic",
      content: "NovaWorks prefers lower-cost local or mock execution for routine analysis and cloud reasoning for complex synthesis.",
      reason: "Provider-routing preference used by the model router.",
      importanceScore: 82,
      decayAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString(),
    });
    await writeMemory({
      organizationId: org.id,
      type: "episodic",
      content: "Tool actions that send, publish, schedule, or create external records require an approval audit trail.",
      reason: "Security policy that influences every tool adapter.",
      importanceScore: 94,
      decayAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(),
    });
    console.log("Seeded 2 starter memories");
  } else {
    console.log("Memories already present, skipping");
  }

  // 5. A pending approval so the security/workflow pages show a live gate
  const existingCalls = await db.select().from(toolCalls).where(eq(toolCalls.organizationId, org.id));
  if (existingCalls.length === 0) {
    await db.insert(toolCalls).values({
      organizationId: org.id,
      toolName: "calendar",
      status: "pending_approval",
      input: { action: "schedule_interview_panel", dryRun: true },
      output: { preview: "Would create a calendar hold after manager approval." },
      riskLevel: "medium",
    });
    console.log("Seeded 1 pending tool-call approval");
  } else {
    console.log("Tool calls already present, skipping");
  }

  console.log("\nSeed complete. Login: admin@novaworks.ai / admin123");
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
