import type { DocumentChunkRecord, DocumentRecord, SearchResult } from "@/lib/types";
import { cosineSimilarity, embedText } from "./embeddings";

function tokenize(input: string) {
  return new Set(
    input
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
}

function lexicalScore(query: string, content: string) {
  const queryTokens = tokenize(query);
  const contentTokens = tokenize(content);
  if (!queryTokens.size) {
    return 0;
  }

  let overlap = 0;
  for (const token of queryTokens) {
    if (contentTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / queryTokens.size;
}

/**
 * Hybrid semantic + lexical re-ranking given an already-computed query
 * embedding. Callers that have a real embedding (e.g. the Postgres
 * repository, which embeds the query with the configured EMBEDDING_PROVIDER)
 * must use this directly instead of `rankChunks` below — recomputing a mock
 * hash embedding here would silently compare it against real chunk
 * embeddings from a different vector space and produce meaningless scores.
 */
export function rankChunksWithEmbedding(
  queryEmbedding: number[],
  query: string,
  chunks: DocumentChunkRecord[],
  documents: DocumentRecord[],
  limit = 5,
): SearchResult[] {
  const documentById = new Map(documents.map((document) => [document.id, document]));

  return chunks
    .map((chunk) => ({
      chunk,
      document: documentById.get(chunk.documentId),
      score:
        cosineSimilarity(queryEmbedding, chunk.embedding) * 0.65 +
        lexicalScore(query, chunk.content) * 0.35,
    }))
    .filter((result): result is SearchResult => Boolean(result.document))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

/**
 * Convenience wrapper for the in-memory mock path: derives the mock hash
 * embedding for the query itself, then delegates to rankChunksWithEmbedding.
 */
export function rankChunks(
  query: string,
  chunks: DocumentChunkRecord[],
  documents: DocumentRecord[],
  limit = 5,
): SearchResult[] {
  return rankChunksWithEmbedding(embedText(query), query, chunks, documents, limit);
}
