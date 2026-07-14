import { z } from "zod";
import { ValidationError } from "@/modules/shared/errors";

export function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError(`${label} failed validation`, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}

export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>, label: string) {
  const body = await request.json().catch(() => {
    throw new ValidationError("Request body must be valid JSON");
  });
  return parseWithSchema(schema, body, label);
}

export async function parseOptionalJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  label: string,
  fallback: T,
) {
  const text = await request.text();
  if (!text.trim()) {
    return fallback;
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }

  return parseWithSchema(schema, body, label);
}
