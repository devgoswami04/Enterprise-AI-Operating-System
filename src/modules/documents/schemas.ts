import { z } from "zod";

export const supportedMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

export const documentUploadSchema = z.object({
  name: z.string().min(1).max(180),
  type: z.string().min(1),
  size: z.number().int().positive().max(10 * 1024 * 1024),
});

export const documentIngestionSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().min(1).max(180),
  mimeType: z.string().min(1),
  text: z.string().min(1),
  uploadedBy: z.string().min(1),
});

export function isSupportedUpload(name: string, mimeType: string) {
  const lowerName = name.toLowerCase();
  return (
    supportedMimeTypes.has(mimeType) ||
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".json")
  );
}
