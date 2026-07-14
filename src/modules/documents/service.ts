import { createDocument } from "@/lib/data/store";
import { extractUploadText } from "@/lib/documents";
import { documentIngestionSchema, documentUploadSchema, isSupportedUpload } from "@/modules/documents/schemas";
import { ValidationError } from "@/modules/shared/errors";
import { logEvent } from "@/modules/shared/logger";
import { parseWithSchema } from "@/modules/shared/validation";

export async function ingestUploadedDocument(input: {
  organizationId: string;
  uploadedBy: string;
  file: File;
  requestId?: string;
}) {
  const upload = parseWithSchema(
    documentUploadSchema,
    {
      name: input.file.name,
      type: input.file.type || "application/octet-stream",
      size: input.file.size,
    },
    "Document upload",
  );

  if (!isSupportedUpload(upload.name, upload.type)) {
    throw new ValidationError("Unsupported document type", {
      fileName: upload.name,
      mimeType: upload.type,
      supported: ["pdf", "txt", "md", "csv", "json"],
    });
  }

  const text = await extractUploadText(input.file);
  const validated = parseWithSchema(
    documentIngestionSchema,
    {
      organizationId: input.organizationId,
      title: upload.name,
      mimeType: upload.type,
      text,
      uploadedBy: input.uploadedBy,
    },
    "Document ingestion",
  );

  const document = createDocument(validated);
  logEvent(
    "info",
    {
      component: "documents",
      action: "document.ingested",
      organizationId: input.organizationId,
      userId: input.uploadedBy,
      requestId: input.requestId,
    },
    "Document ingested and indexed",
    { documentId: document.id, chunkCount: document.chunkCount, mimeType: document.mimeType },
  );

  return document;
}
