const DEFAULT_CHUNK_SIZE = 900;
const DEFAULT_OVERLAP = 140;

export function normalizeText(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function estimateTokens(input: string) {
  return Math.max(1, Math.ceil(input.trim().split(/\s+/).filter(Boolean).length * 1.33));
}

export function chunkText(
  input: string,
  options: { chunkSize?: number; overlap?: number } = {},
) {
  const text = normalizeText(input);
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = Math.min(options.overlap ?? DEFAULT_OVERLAP, Math.floor(chunkSize / 2));
  const chunks: string[] = [];

  if (!text) {
    return chunks;
  }

  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    const sentenceBreak = text.lastIndexOf(".", end);
    const paragraphBreak = text.lastIndexOf("\n\n", end);
    const breakPoint = Math.max(sentenceBreak, paragraphBreak);

    if (breakPoint > start + chunkSize * 0.55 && end < text.length) {
      end = breakPoint + 1;
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= text.length) {
      break;
    }

    start = Math.max(0, end - overlap);
  }

  return chunks;
}

export function summarizeText(input: string, maxLength = 220) {
  const normalized = normalizeText(input);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trim()}...`;
}
