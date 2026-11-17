import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getRagConfig } from "./config";

export interface RagChunkRecord {
  id: string;
  doc: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
}

export interface RagIndexFile {
  version: 1;
  provider: string;
  model: string;
  dim: number;
  createdAt: string;
  documents: Array<{ name: string; chunks: number; pages: number }>;
  chunks: RagChunkRecord[];
}

export async function loadIndex(): Promise<RagIndexFile | null> {
  const { indexPath } = getRagConfig();
  try {
    const raw = await readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw) as RagIndexFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.chunks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveIndex(index: RagIndexFile): Promise<void> {
  const { indexPath } = getRagConfig();
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(indexPath, JSON.stringify(index), "utf8");
}
