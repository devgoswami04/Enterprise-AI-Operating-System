import { z } from "zod";

export const toolExecuteSchema = z.object({
  workflowRunId: z.string().optional(),
  toolCallId: z.string().optional(),
  action: z.string().min(1).max(120).default("execute"),
  input: z.record(z.string(), z.unknown()).default({}).optional(),
  decision: z.enum(["approve", "reject"]).default("approve").optional(),
  reason: z.string().max(500).optional(),
});

export type ToolExecuteInput = z.infer<typeof toolExecuteSchema>;
