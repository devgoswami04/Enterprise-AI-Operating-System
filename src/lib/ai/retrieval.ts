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

export function rankChunks(
  query: string,
  chunks: DocumentChunkRecord[],
  documents: DocumentRecord[],
  limit = 5,
): SearchResult[] {
  const queryEmbedding = embedText(query);
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
