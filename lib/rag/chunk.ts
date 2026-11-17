export interface TextChunk {
  index: number;
  content: string;
}

const SENTENCE_ENDINGS = /(?<=[。！？!?；;\n])/g;

export function chunkText(
  raw: string,
  size: number,
  overlap: number,
): TextChunk[] {
  const text = raw.replace(/\u0000/g, "").trim();
  if (!text) return [];
  if (text.length <= size) {
    return [{ index: 0, content: text }];
  }

  const sentences = text.split(SENTENCE_ENDINGS);
  const chunks: TextChunk[] = [];
  let current = "";

  const pushChunk = (content: string) => {
    const trimmed = content.trim();
    if (trimmed.length >= 20) {
      chunks.push({ index: chunks.length, content: trimmed });
    }
  };

  for (const sentence of sentences) {
    if (!sentence) continue;
    if ((current + sentence).length <= size) {
      current += sentence;
      continue;
    }
    if (current) {
      pushChunk(current);
      current = current.slice(Math.max(0, current.length - overlap));
    }
    if (sentence.length > size) {
      // 单句超长时硬切
      for (let i = 0; i < sentence.length; i += size - overlap) {
        const piece = sentence.slice(i, i + size);
        if (i + size >= sentence.length) {
          current = piece;
        } else {
          pushChunk(piece);
        }
      }
    } else {
      current += sentence;
    }
  }
  if (current.trim()) {
    pushChunk(current);
  }
  return chunks;
}
