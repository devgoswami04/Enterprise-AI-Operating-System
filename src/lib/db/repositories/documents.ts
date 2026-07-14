import { and, eq, sql } from "drizzle-orm";
import { chunkText, estimateTokens, summarizeText } from "@/lib/ai/chunking";
import { getEmbeddingProvider } from "@/lib/ai/embeddings";
import { getDb } from "@/lib/db/client";
import { documentChunks, documents } from "@/lib/db/schema";
import type { DocumentChunkRecord, DocumentRecord, SearchResult } from "@/lib/types";

function toDocumentRecord(row: typeof documents.$inferSelect, chunkCount: number): DocumentRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    sourceType: row.sourceType as DocumentRecord["sourceType"],
    mimeType: row.mimeType,
    status: row.status as DocumentRecord["status"],
    summary: row.summary ?? "",
    uploadedBy: row.uploadedById ?? "system",
    chunkCount,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}

function toChunkRecord(row: typeof documentChunks.$inferSelect): DocumentChunkRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    documentId: row.documentId,
    chunkIndex: row.chunkIndex,
    content: row.content,
    embedding: row.embedding as unknown as number[],
    tokenCount: row.tokenCount,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Real ingestion: chunk the text, embed every chunk with the configured
 * embedding provider (mock/openai/huggingface — see lib/ai/embeddings.ts),
 * and persist the document + chunk rows (with pgvector embeddings) in
 * Postgres. This replaces the in-memory-only version and is what makes
 * EMBEDDING_PROVIDER actually matter.
 */
export async function createDocument(input: {
  organizationId: string;
  title: string;
  mimeType: string;
  text: string;
  uploadedBy: string;
  sourceType?: DocumentRecord["sourceType"];
}): Promise<DocumentRecord> {
  const db = getDb();
  const provider = getEmbeddingProvider();
  const chunkTexts = chunkText(input.text);

  const [documentRow] = await db
    .insert(documents)
    .values({
      organizationId: input.organizationId,
      uploadedById: input.uploadedBy,
      title: input.title,
      sourceType: input.sourceType ?? "upload",
      mimeType: input.mimeType,
      status: "indexed",
      summary: summarizeText(input.text),
      metadata: { embeddingProvider: provider.name },
    })
    .returning();

  if (chunkTexts.length > 0) {
    const embedded = await Promise.all(
      chunkTexts.map(async (content, chunkIndex) => ({
        organizationId: input.organizationId,
        documentId: documentRow.id,
        chunkIndex,
        content,
        embedding: await provider.embed(content),
        tokenCount: estimateTokens(content),
      })),
    );
    await db.insert(documentChunks).values(embedded);
  }

  return toDocumentRecord(documentRow, chunkTexts.length);
}

export async function listDocuments(organizationId: string): Promise<DocumentRecord[]> {
  const db = getDb();
  const rows = await db
    .select({
      document: documents,
      chunkCount: sql<number>`count(${documentChunks.id})::int`,
    })
    .from(documents)
    .leftJoin(documentChunks, eq(documentChunks.documentId, documents.id))
    .where(eq(documents.organizationId, organizationId))
    .groupBy(documents.id)
    .orderBy(sql`${documents.createdAt} desc`);

  return rows.map((row) => toDocumentRecord(row.document, row.chunkCount));
}

/**
 * Real retrieval: embed the query with the configured provider, use pgvector
 * cosine distance (`<=>`) to pull a candidate set of nearest chunks straight
 * from Postgres (the actual ANN search — not an in-process array scan), then
 * apply the same hybrid semantic+lexical re-ranking used everywhere else in
 * the app so citation quality stays consistent between mock and DB modes.
 */
export async function searchKnowledge(
  organizationId: string,
  query: string,
  limit = 5,
): Promise<SearchResult[]> {
  const db = getDb();
  const provider = getEmbeddingProvider();
  const queryEmbedding = await provider.embed(query);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const candidateLimit = Math.max(limit * 4, 20);

  const candidates = await db
    .select({
      chunk: documentChunks,
      document: documents,
      distance: sql<number>`${documentChunks.embedding} <=> ${vectorLiteral}::vector`,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documents.id, documentChunks.documentId))
    .where(and(eq(documentChunks.organizationId, organizationId), eq(documents.organizationId, organizationId)))
    .orderBy(sql`${documentChunks.embedding} <=> ${vectorLiteral}::vector`)
    .limit(candidateLimit);

  const { rankChunksWithEmbedding } = await import("@/lib/ai/retrieval");
  const chunkRecords = candidates.map((row) => toChunkRecord(row.chunk));
  const documentRecords = candidates.map((row) => toDocumentRecord(row.document, 0));
  const uniqueDocuments = Array.from(new Map(documentRecords.map((doc) => [doc.id, doc])).values());

  return rankChunksWithEmbedding(queryEmbedding, query, chunkRecords, uniqueDocuments, limit);
}
