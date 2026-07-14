import { z } from "zod";

export const workflowStartSchema = z.object({
  dryRun: z.boolean().default(true).optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal").optional(),
  inputs: z.record(z.string(), z.unknown()).default({}).optional(),
});

export const workflowApprovalSchema = z.object({
  workflowRunId: z.string().min(1).optional(),
  toolCallId: z.string().min(1).optional(),
  decision: z.enum(["approve", "reject"]).default("approve"),
  reason: z.string().max(500).optional(),
});
