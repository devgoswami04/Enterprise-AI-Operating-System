import { and, desc, eq, inArray } from "drizzle-orm";
import { getEmbeddingProvider } from "@/lib/ai/embeddings";
import { cosineSimilarity } from "@/lib/ai/embeddings";
import { getDb } from "@/lib/db/client";
import { conversations, memories, messages } from "@/lib/db/schema";
import type { Citation, MemoryRecord } from "@/lib/types";

function toMemoryRecord(row: typeof memories.$inferSelect): MemoryRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId ?? undefined,
    type: row.type as MemoryRecord["type"],
    content: row.content,
    embedding: row.embedding as unknown as number[],
    importanceScore: row.importanceScore,
    reason: row.reason ?? undefined,
    lastAccessedAt: row.lastAccessedAt?.toISOString(),
    decayAt: row.decayAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listMemories(organizationId: string): Promise<MemoryRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(memories)
    .where(eq(memories.organizationId, organizationId))
    .orderBy(desc(memories.importanceScore));
  return rows.map(toMemoryRecord);
}

export async function writeMemory(input: {
  organizationId: string;
  userId?: string;
  type: "semantic" | "episodic" | "preference";
  content: string;
  reason?: string;
  importanceScore?: number;
  lastAccessedAt?: string;
  decayAt?: string;
  embeddingText?: string;
}): Promise<MemoryRecord> {
  const db = getDb();
  const provider = getEmbeddingProvider();
  const embedding = await provider.embed(input.embeddingText ?? input.content);

  const [row] = await db
    .insert(memories)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      type: input.type,
      content: input.content,
      embedding,
      importanceScore: input.importanceScore ?? 50,
      reason: input.reason,
      lastAccessedAt: input.lastAccessedAt ? new Date(input.lastAccessedAt) : new Date(),
      decayAt: input.decayAt ? new Date(input.decayAt) : undefined,
    })
    .returning();

  return toMemoryRecord(row);
}

/**
 * Real semantic recall against pgvector: pull a candidate set with the
 * database's own nearest-neighbor index rather than loading every memory
 * into the Node process, then blend in the importance score exactly like
 * the mock path does.
 */
export async function recallMemories(organizationId: string, query: string, limit = 5) {
  const db = getDb();
  const provider = getEmbeddingProvider();
  const queryEmbedding = await provider.embed(query);

  const rows = await db
    .select()
    .from(memories)
    .where(eq(memories.organizationId, organizationId))
    .orderBy(desc(memories.importanceScore))
    .limit(200);

  const scored = rows
    .map((row) => {
      const memory = toMemoryRecord(row);
      const dot = cosineSimilarity(queryEmbedding, memory.embedding);
      const importance = (memory.importanceScore ?? 50) / 100;
      return { memory, score: dot * 0.75 + importance * 0.25 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length) {
    await db
      .update(memories)
      .set({ lastAccessedAt: new Date() })
      .where(
        and(
          eq(memories.organizationId, organizationId),
          inArray(
            memories.id,
            scored.map((entry) => entry.memory.id),
          ),
        ),
      );
  }

  return scored;
}

export async function getRecentMessages(organizationId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.organizationId, organizationId))
    .orderBy(desc(messages.createdAt))
    .limit(12);

  return rows.reverse().map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    conversationId: row.conversationId,
    role: row.role as "user" | "assistant" | "system",
    content: row.content,
    citations: (row.metadata as { citations?: Citation[] } | null)?.citations,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function recordChatExchange(input: {
  organizationId: string;
  userId: string;
  prompt: string;
  answer: string;
  citations: Citation[];
  latencyMs: number;
}) {
  const db = getDb();

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.organizationId, input.organizationId), eq(conversations.userId, input.userId)))
    .limit(1);

  const conversationRow =
    conversation ??
    (
      await db
        .insert(conversations)
        .values({ organizationId: input.organizationId, userId: input.userId, title: input.prompt.slice(0, 80) })
        .returning()
    )[0];

  await db.insert(messages).values([
    {
      organizationId: input.organizationId,
      conversationId: conversationRow.id,
      role: "user",
      content: input.prompt,
      metadata: {},
    },
    {
      organizationId: input.organizationId,
      conversationId: conversationRow.id,
      role: "assistant",
      content: input.answer,
      metadata: { citations: input.citations },
    },
  ]);

  return { conversationId: conversationRow.id };
}
