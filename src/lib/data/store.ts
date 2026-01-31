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

// --- Original PDFs ---

export async function readOriginalPdf(
  relativePath: string
): Promise<Buffer | null> {
  try {
    const filePath = resolvePath(relativePath);
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

export async function writeOriginalPdf(
  filename: string,
  data: Buffer
): Promise<void> {
  const dirPath = resolvePath("originals");
  await ensureDir(dirPath);
  const filePath = path.join(dirPath, filename);
  await fs.writeFile(filePath, data);
}

// --- Vector Store Config (OpenAI) ---

export interface VectorStoreConfig {
  vectorStoreId: string | null;
  assistantId: string | null;
  lastSyncedAt: string | null;
}

const DEFAULT_VECTOR_STORE_CONFIG: VectorStoreConfig = {
  vectorStoreId: null,
  assistantId: null,
  lastSyncedAt: null,
};

const ENV_LOCAL_PATH = path.join(process.cwd(), ".env.local");
const VECTOR_STORE_ID_KEY = "OPENAI_VECTOR_STORE_ID";
const ASSISTANT_ID_KEY = "OPENAI_ASSISTANT_ID";

export async function readVectorStoreConfig(): Promise<VectorStoreConfig> {
  const fromEnv: VectorStoreConfig = {
    vectorStoreId: process.env[VECTOR_STORE_ID_KEY] ?? null,
    assistantId: process.env[ASSISTANT_ID_KEY] ?? null,
    lastSyncedAt: null,
  };
  if (fromEnv.vectorStoreId || fromEnv.assistantId) {
    const filePath = resolvePath("metadata", "vector_store.json");
    const data = await readJSON<VectorStoreConfig>(filePath);
    return {
      vectorStoreId: fromEnv.vectorStoreId ?? data?.vectorStoreId ?? null,
      assistantId: fromEnv.assistantId ?? data?.assistantId ?? null,
      lastSyncedAt: data?.lastSyncedAt ?? null,
    };
  }
  const filePath = resolvePath("metadata", "vector_store.json");
  const data = await readJSON<VectorStoreConfig>(filePath);
  return data ?? DEFAULT_VECTOR_STORE_CONFIG;
}

/** Update .env.local with OPENAI_VECTOR_STORE_ID and OPENAI_ASSISTANT_ID. */
export async function updateEnvLocalWithVectorStoreIds(
  vectorStoreId: string | null,
  assistantId: string | null
): Promise<void> {
  let content = "";
  try {
    content = await fs.readFile(ENV_LOCAL_PATH, "utf-8");
  } catch {
    // File doesn't exist; create with just the two keys (caller may add OPENAI_API_KEY separately)
  }
  const lines = content ? content.split("\n") : [];
  const out: string[] = [];
  let hadVectorStore = false;
  let hadAssistant = false;
  for (const line of lines) {
    const keyMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    const key = keyMatch?.[1];
    if (key === VECTOR_STORE_ID_KEY) {
      out.push(vectorStoreId != null ? `${VECTOR_STORE_ID_KEY}=${vectorStoreId}` : line);
      hadVectorStore = true;
    } else if (key === ASSISTANT_ID_KEY) {
      out.push(assistantId != null ? `${ASSISTANT_ID_KEY}=${assistantId}` : line);
      hadAssistant = true;
    } else {
      out.push(line);
    }
  }
  if (vectorStoreId != null && !hadVectorStore) out.push(`${VECTOR_STORE_ID_KEY}=${vectorStoreId}`);
  if (assistantId != null && !hadAssistant) out.push(`${ASSISTANT_ID_KEY}=${assistantId}`);
  await fs.writeFile(ENV_LOCAL_PATH, out.join("\n").trimEnd() + "\n", "utf-8");
}

export async function writeVectorStoreConfig(
  config: VectorStoreConfig
): Promise<void> {
  const filePath = resolvePath("metadata", "vector_store.json");
  await writeJSON(filePath, config);
  await updateEnvLocalWithVectorStoreIds(config.vectorStoreId, config.assistantId);
}

// --- Utility ---

export function getNextInterviewId(index: MetadataIndex): string {
  const maxId = index.interviews.reduce((max, item) => {
    const num = parseInt(item.id.replace("t-", ""));
    return num > max ? num : max;
  }, 0);
  return `t-${String(maxId + 1).padStart(3, "0")}`;
}
