import { readFile } from "node:fs/promises";
import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdfPages(filePath: string): Promise<string[]> {
  const buffer = await readFile(filePath);
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(result.text) ? result.text : [result.text];
  return pages.map((page) => page.replace(/\s+/g, " ").trim());
}

export function mergePageText(pages: string[]): string {
  return pages
    .filter((page) => page.length > 0)
    .join("\n\n")
    .trim();
}
