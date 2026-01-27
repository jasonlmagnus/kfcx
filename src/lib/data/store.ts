import { promises as fs } from "fs";
import path from "path";
import {
  MetadataIndex,
  NormalizedTranscript,
  NormalizedReport,
  ThemeAnalysis,
  OpportunitiesAnalysis,
  EmbeddingIndex,
} from "@/types";

const DATA_ROOT = path.join(process.cwd(), "data", "store");

function resolvePath(...segments: string[]): string {
  return path.join(DATA_ROOT, ...segments);
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readJSON<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function writeJSON<T>(filePath: string, data: T): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// --- Metadata Index ---

export async function readMetadataIndex(): Promise<MetadataIndex> {
  const filePath = resolvePath("metadata", "index.json");
  const data = await readJSON<MetadataIndex>(filePath);
  return (
    data || {
      version: 1,
      lastUpdated: new Date().toISOString(),
      interviews: [],
    }
  );
}

export async function writeMetadataIndex(index: MetadataIndex): Promise<void> {
  const filePath = resolvePath("metadata", "index.json");
  index.lastUpdated = new Date().toISOString();
  await writeJSON(filePath, index);
}

// --- Transcripts ---

export async function readTranscript(
  id: string
): Promise<NormalizedTranscript | null> {
  const filePath = resolvePath("transcripts", `${id}.json`);
  return readJSON<NormalizedTranscript>(filePath);
}

export async function writeTranscript(
  id: string,
  data: NormalizedTranscript
): Promise<void> {
  const filePath = resolvePath("transcripts", `${id}.json`);
  await writeJSON(filePath, data);
}

// --- Reports ---

export async function readReport(id: string): Promise<NormalizedReport | null> {
  const filePath = resolvePath("reports", `${id}.json`);
  return readJSON<NormalizedReport>(filePath);
}

export async function writeReport(
  id: string,
  data: NormalizedReport
): Promise<void> {
  const filePath = resolvePath("reports", `${id}.json`);
  await writeJSON(filePath, data);
}

// --- Theme Analysis ---

export async function readThemeAnalysis(): Promise<ThemeAnalysis | null> {
  const filePath = resolvePath("metadata", "themes.json");
  return readJSON<ThemeAnalysis>(filePath);
}

export async function writeThemeAnalysis(data: ThemeAnalysis): Promise<void> {
  const filePath = resolvePath("metadata", "themes.json");
  await writeJSON(filePath, data);
}

// --- Opportunities ---

export async function readOpportunities(): Promise<OpportunitiesAnalysis | null> {
  const filePath = resolvePath("metadata", "opportunities.json");
  return readJSON<OpportunitiesAnalysis>(filePath);
}

export async function writeOpportunities(
  data: OpportunitiesAnalysis
): Promise<void> {
  const filePath = resolvePath("metadata", "opportunities.json");
  await writeJSON(filePath, data);
}

// --- Embeddings ---

export async function readEmbeddingIndex(): Promise<EmbeddingIndex | null> {
  const filePath = resolvePath("embeddings", "index.json");
  return readJSON<EmbeddingIndex>(filePath);
}

export async function writeEmbeddingIndex(
  data: EmbeddingIndex
): Promise<void> {
  const filePath = resolvePath("embeddings", "index.json");
  await writeJSON(filePath, data);
}

// --- Utility ---

export function getNextInterviewId(index: MetadataIndex): string {
  const maxId = index.interviews.reduce((max, item) => {
    const num = parseInt(item.id.replace("t-", ""));
    return num > max ? num : max;
  }, 0);
  return `t-${String(maxId + 1).padStart(3, "0")}`;
}
