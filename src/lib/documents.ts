import { normalizeText } from "@/lib/ai/chunking";

async function extractPdfText(buffer: ArrayBuffer) {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const parsed = await parser.getText();

      if (parsed.text.trim().length > 40) {
        return normalizeText(parsed.text);
      }
    } finally {
      await parser.destroy();
    }
  } catch {
    // Fall through to the lightweight embedded-text parser. OCR remains a future adapter.
  }

  const decoded = new TextDecoder("latin1").decode(buffer);
  const textMatches = [...decoded.matchAll(/\(([^()]{3,})\)/g)]
    .map((match) => match[1])
    .filter((value) => /[A-Za-z]{3,}/.test(value));

  const extracted = textMatches.join(" ");
  if (extracted.length > 80) {
    return normalizeText(extracted);
  }

  return "PDF uploaded. Text extraction found limited embedded text in this demo parser; add OCR/provider extraction for scanned documents.";
}

export async function extractUploadText(file: File) {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return extractPdfText(await file.arrayBuffer());
  }

  if (
    file.type.startsWith("text/") ||
    file.name.endsWith(".md") ||
    file.name.endsWith(".csv") ||
    file.name.endsWith(".json")
  ) {
    return normalizeText(await file.text());
  }

  return normalizeText(await file.text().catch(() => ""));
}
