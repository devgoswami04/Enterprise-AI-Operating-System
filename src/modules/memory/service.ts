import { recallMemories, writeMemory } from "@/lib/data/store";
import { summarizeText } from "@/lib/ai/chunking";
import { logEvent } from "@/modules/shared/logger";

export function scoreMemoryImportance(input: {
  content: string;
  citations?: number;
  toolAction?: boolean;
  workflowOutcome?: boolean;
  securityFinding?: boolean;
}) {
  let score = Math.min(75, 25 + Math.ceil(input.content.length / 80));
  score += (input.citations ?? 0) * 8;
  if (input.toolAction) score += 18;
  if (input.workflowOutcome) score += 16;
  if (input.securityFinding) score += 20;
  return Math.min(100, score);
}

export function calculateDecayDate(importanceScore: number) {
  const days = importanceScore >= 85 ? 180 : importanceScore >= 65 ? 90 : 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function writeDurableMemory(input: {
  organizationId: string;
  userId?: string;
  type: "semantic" | "episodic" | "preference";
  content: string;
  reason: string;
  importanceScore?: number;
  requestId?: string;
}) {
  const importanceScore = input.importanceScore ?? scoreMemoryImportance({ content: input.content });
  const memory = await writeMemory({
    organizationId: input.organizationId,
    userId: input.userId,
    type: input.type,
    content: summarizeText(input.content, 600),
    reason: input.reason,
    importanceScore,
    lastAccessedAt: new Date().toISOString(),
    decayAt: calculateDecayDate(importanceScore),
  });

  logEvent(
    "info",
    {
      component: "memory",
      action: "memory.write",
      organizationId: input.organizationId,
      userId: input.userId,
      requestId: input.requestId,
    },
    "Durable memory written",
    { memoryId: memory.id, type: memory.type, importanceScore },
  );

  return memory;
}

export async function recallRelevantMemory(input: {
  organizationId: string;
  query: string;
  limit?: number;
  requestId?: string;
}) {
  const results = await recallMemories(input.organizationId, input.query, input.limit ?? 5);
  logEvent(
    "info",
    {
      component: "memory",
      action: "memory.recall",
      organizationId: input.organizationId,
      requestId: input.requestId,
    },
    "Semantic memory recall completed",
    { results: results.length, topScore: Number((results[0]?.score ?? 0).toFixed(3)) },
  );
  return results;
}
