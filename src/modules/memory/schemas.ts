import { z } from "zod";

export const memoryWriteSchema = z.object({
  type: z.enum(["semantic", "episodic", "preference"]),
  content: z.string().trim().min(12).max(2000),
  reason: z.string().trim().min(4).max(240),
  importanceScore: z.number().int().min(0).max(100),
});

export const memoryRecallSchema = z.object({
  query: z.string().trim().min(1).max(1000),
  limit: z.number().int().min(1).max(12).default(5),
});
