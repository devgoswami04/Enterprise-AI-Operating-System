import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(2000),
  limit: z.coerce.number().int().min(1).max(20).default(6),
  sourceType: z.enum(["upload", "seed", "connector"]).optional(),
  documentId: z.string().optional(),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
