import { z } from "zod";

export const promptInputSchema = z.object({
  message: z.string().trim().min(1).max(12_000),
});

export const securityEventQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
